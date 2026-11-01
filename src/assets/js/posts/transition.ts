// transition.ts — 文章区切页转场：替换前清场暂存（captureOld）与替换后编排（playTransition）
// 用法：const transition = createTransition({ row, strip, floatCtl, track, stopAnims, ... })
//
// 转场只在文章区界面之间播放，跨区直接落位：左缘条带「模糊变过去」、搜索/目录退场与入场
// 配对（先退场再入场）、手机端整页推拉的反向抵消。四个配对动效共用
// posts/transition-tokens.ts 的相位令牌。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

import type { SearchFloatCtl } from './search-float';
import type { Strip } from './strip';
import { EASE, EASE_ENTRY, EASE_EXIT, EDGE_MS, PHASE_MS } from './transition-tokens';

// 手机端（≤768px）：新内容滑动距离（退场上移与整页推入同缓动（EASE）、时长按位移
// 距离等比，位移必须小于手机端列式页头的标题↔搜索间隙 16px，否则入场落回会蹭到
// 标题底边闪一下）；搜索框自身的位移与时长见 posts/search-float.ts
const MOBILE_SLIDE = 48;
// 条带交换「模糊变过去」（**全部**左缘条带切换——桌面端所有 + 手机端列表↔文章 + 手机端
// 列表↔分类/标签；桌面端同样用模糊，不再滑动）：
// 旧带原地渐隐（opacity 1→0；退出侧不写 filter 关键帧——带过滤层的克隆被移除时，
// 下方新标题会因合成层重栅格闪一下）；新带原地渐显（**不挂 filter**——标题行的
// 过滤层是受害者：推入收尾 N 张玻璃卡的 backdrop 最终重采样挤占栅格预算时，
// 过滤层重提交丢一帧 = 标题闪一帧，见 TROUBLESHOOTING 第 51 条）+ 静态 blur(4px)
// 模糊副本原地渐隐、淡尽后移除（纯 alpha 交叉）
// 旧条带：渐隐时长（只走 opacity）
const STRIP_BLUR_OUT_MS = 160;
// 新条带：模糊交叉渐显时长（真带渐显 + 模糊副本渐隐，同时长）
const STRIP_BLUR_IN_MS = 260;
// 模糊峰值（px，模糊副本的静态 blur）
const STRIP_BLUR_PX = 4;

export interface TransitionEnv {
  /** 当前文章区行（`.page-main`） */
  row: () => HTMLElement | null;
  strip: Strip;
  floatCtl: SearchFloatCtl;
  /** 登记转场动画（切页清场时统一 cancel） */
  track: (a: AnimationPlaybackControls) => AnimationPlaybackControls;
  /** 取消转场动画（captureOld 起手） */
  stopAnims: () => void;
  isMobile: () => boolean;
  reduceMotion: boolean;
  /** 目录滑动是否可用（电脑端显示目录时才走位移） */
  tocSlideGate: () => boolean;
  /** 切页已提交：早期导航等待作废 */
  cancelEarlyNav: () => void;
}

export interface Transition {
  captureOld(): void;
  playTransition(): void;
}

export function createTransition(env: TransitionEnv): Transition {
  const { row, strip, floatCtl, track, stopAnims, isMobile, reduceMotion, tocSlideGate } = env;
  const { cancelEarlyNav } = env;
  let edgeClone: HTMLElement | null = null;
  let tocClone: HTMLElement | null = null;
  // 旧页是列表系界面（搜索正在显示）——captureOld 时记录
  let oldHadSearch = false;
  // 旧页是文章详情（面包屑条）——区分「区内」与「跨区」搜索处理
  let oldIsPost = false;

  /** 替换前调用（astro:before-swap，content:replace 前一刻）：清场 + 克隆静止暂存 */
  function captureOld(): void {
    // 只停转场动画；搜索浮层的点击退场独立生命周期，不连带
    stopAnims();
    strip.clearClones();
    edgeClone = null;
    tocClone = null;
    oldHadSearch = false;
    oldIsPost = false;
    // 切页已提交：早期点击等待结束
    cancelEarlyNav();
    // 上一轮文章↔文章新目录的落位等待作废（元素即将被换走）
    strip.cancelTocEntryWait();
    const r = row();
    if (!r) return;
    const main = r.querySelector<HTMLElement>('main#swup');
    // 快速连切保护：上次转场未播完时，旧内容根 / 旧条带 / 旧目录可能带着被 cancel 的
    // 动画残留内联 transform/opacity（cancel 不清内联样式）——克隆的量盒必须按
    // 自然位置来，先清零。这些元素马上就要被 swup 换掉，清零的这一帧不会被看见
    main
      ?.querySelector<HTMLElement>('.posts-article, .posts-page')
      ?.style.removeProperty('transform');
    const old = main?.querySelector<HTMLElement>('.posts-header, .posts-breadcrumb');
    if (old) {
      old.style.transform = '';
      old.style.opacity = '';
      // 手机端整页推入的反推 pre-pin 位移可能残留在槽上（未及 finished 写回）——量克隆前清零
      const slot = old.parentElement;
      if (slot?.classList.contains('posts-edge-slot')) slot.style.transform = '';
      oldHadSearch = !!old.querySelector('.posts-header-search');
      oldIsPost = old.classList.contains('posts-breadcrumb');
      edgeClone = strip.cloneIntoRow(old, r, 'posts-edge-clone');
      // 克隆全程钉死 filter: none：带过滤层的克隆被移除时，下方新标题会因合成层重栅格
      // 闪一下（新条带本身已不挂 filter，此为防御性钉死）
      if (edgeClone) edgeClone.style.filter = 'none';
    }
    const oldToc = main?.querySelector<HTMLElement>('.post-sidebar');
    if (oldToc && getComputedStyle(oldToc).display !== 'none') {
      oldToc.style.transform = '';
      oldToc.style.opacity = '';
      tocClone = strip.cloneIntoRow(oldToc, r, 'posts-toc-clone');
      // 创建即钉视口：before-swap 早于滚顶启动与切页文档高度塌缩，
      // 克隆从此 fixed 不被任何布局变化带走；退场/交叉渐隐块里的再钉变为 no-op
      if (tocClone) {
        const cr = tocClone.getBoundingClientRect();
        tocClone.style.position = 'fixed';
        tocClone.style.top = `${cr.top}px`;
        tocClone.style.left = `${cr.left}px`;
      }
    }
  }

  /** 新内容加载完后调用（astro:after-swap）：判定界面并播放转场 */
  function playTransition(): void {
    const r = row();
    // 新元素只在 main#swup 里找：克隆挂进行内（#swup 之外），若在整行里 querySelector，
    // 离开文章区时唯一命中的会是克隆自己（两个动画加到同一节点互相覆盖）
    const main = r?.querySelector<HTMLElement>('main#swup');
    const newEdge = main?.querySelector<HTMLElement>('.posts-header, .posts-breadcrumb') ?? null;
    const newTocEl = main?.querySelector<HTMLElement>('.post-sidebar') ?? null;
    // ≤850px 目录 display:none，不参与
    const hasNewToc = !!newTocEl && getComputedStyle(newTocEl).display !== 'none';
    const newHadSearch = !!newEdge?.querySelector('.posts-header-search');
    // 新页是文章详情（区分区内/跨区）
    const newIsPost = !!main?.querySelector<HTMLElement>('.post-content');
    // 列表→文章（旧页必为列表系）
    const opening = oldHadSearch && !newHadSearch;
    // 文章→列表（旧页必为文章详情）
    const closing = !oldHadSearch && newHadSearch && oldIsPost;
    // 手机端（≤768px）列表↔文章：固定方向整页推拉（开=上 / 关=下）；
    // opening/closing 均要求旧页在文章区内——跨区（普通页→列表）旧屏无条带可配对、
    // 常驻搜索框直接 settle 落位，整页滑入会出现内容滑动而搜索框原地不动的割裂
    const mobilePush = isMobile() && !reduceMotion && (opening || closing);

    // 快速连切收口：浮层带着上一轮的在途相位、与本轮目的地冲突时，不静默掐断硬切
    // 直接硬切会表现为「点快了搜索框没有退场动画」——从飞行中位姿改向到本轮目的地的
    // 静止态（与目录克隆的中断处理同范式：停下、再走完整动效）：退场未完就切回列表 →
    // 自当前位置归位（「停下再回去」）；入场未完就切进文章 → 自当前位置继续离场、
    // 补完退场动画。跨区（→ 普通页）不改向：按「切到其他界面不渐隐」
    // settle(false) 直接消失。否则 state 卡在 exiting/entering，入场 gate
    // （state==='hidden'）不成立、目录动作又占着相位链，settle 兜底跑不到，
    // 搜索框会永久停在 opacity 0
    if (floatCtl.state === 'exiting' && newHadSearch) floatCtl.redirect(true);
    if (floatCtl.state === 'entering' && !newHadSearch) {
      if (newIsPost) floatCtl.redirect(false);
      else floatCtl.settle(false);
    }

    /* ---- 搜索/目录相位：退出相位走完才播进入相位（先退场再入场） ---- */
    let exitAction: (() => AnimationPlaybackControls | null) | null = null;
    let entryAction: (() => void) | null = null;

    if (mobilePush) {
      // 手机端（≤768px）列表↔文章：搜索走独立的上下位移（开=after-swap 启动退场，点击时不动；关=自上方落回渐显）；
      // 目录在 ≤768px 不存在（按钮+抽屉），不参与。
      // 跨区（列表↔普通页）不做搜索淡变：无退场/入场动作，搜索随 after-swap settle 直接消失/出现
      if (opening && newIsPost) {
        // 区内「开文章」：在这里启动退场（点击时不动，见 onDocClick）；上一轮退场仍在途则沿用
        exitAction = () =>
          floatCtl.state === 'exiting'
            ? floatCtl.active
            : floatCtl.state === 'shown'
              ? floatCtl.exitMobile()
              : null;
      } else if (closing && oldIsPost) {
        // 区内「关文章」：自上方落回渐显
        entryAction = () => floatCtl.enterMobile();
      }
    } else if (tocClone) {
      // 文章↔文章：两侧都有目录 → 并行交叉渐隐（不参与相位，见下）
      const crossfade = hasNewToc;
      if (!crossfade) {
        // 目录退场：电脑端右移移出屏渐隐——位移与渐隐同步（PHASE_MS/EASE_EXIT），
        // 与搜索框移动切换同节奏；其他只渐隐
        exitAction = () => {
          const el = tocClone as HTMLElement;
          // 先钉到当前视口位置（同文章↔文章分支）：克隆挂行内（文档坐标），深滚动位
          // 出发时退场窗口内页面正高速回顶（SwupScrollPlugin）——不钉的话右滑 + 渐隐
          // 会被滚动「带走」（视口 top 随 scrollY 减小而增大，退场读作向右下漂）；
          // 减动效只渐隐不位移时也钉（原地渐隐同样会被带走）。rect 必须在任何
          // transform 写入之前量
          const rect = el.getBoundingClientRect();
          el.style.position = 'fixed';
          el.style.top = `${rect.top}px`;
          el.style.left = `${rect.left}px`;
          const slide = tocSlideGate();
          const dx = slide ? strip.tocOffscreenDx(el) : 0;
          const move = slide
            ? track(
                animate(
                  el,
                  { x: [0, `${dx}px`] },
                  {
                    duration: PHASE_MS / 1000,
                    ease: EASE_EXIT,
                    reduceMotion,
                    autoplay: false,
                  },
                ),
              )
            : null;
          const fade = track(
            animate(
              el,
              { opacity: [1, 0] },
              {
                duration: (slide ? PHASE_MS : EDGE_MS) / 1000,
                ease: slide ? EASE_EXIT : EASE,
                reduceMotion,
                autoplay: false,
              },
            ),
          );
          // 相位链：有位移时位移与渐隐同时长、等它走完；无位移时等渐隐
          const last = move ?? fade;
          last.finished
            .then(() => {
              el.remove();
              tocClone = null;
            })
            .catch(() => {});
          return last;
        };
      }
    } else if (hasNewToc) {
      // 新界面有目录、旧界面没有（列表→文章）：只有进入相位——退出相位由搜索承担（见下）
      entryAction = strip.makeTocEntry(newTocEl as HTMLElement);
    }
    // 搜索退场/入场：只在文章区内（列表↔详情）配对播放；
    // 跨区（列表↔普通页）不设动作——走下方 settle 直接消失/出现（跨区不渐隐、不渐显）
    if (!mobilePush) {
      if (
        oldHadSearch &&
        !newHadSearch &&
        newIsPost &&
        (floatCtl.state === 'shown' || floatCtl.state === 'exiting')
      ) {
        // 与新目录入场配对时才右移
        const withX = tocSlideGate() && hasNewToc;
        // 在途退场（redirect 改向「进文章」而来）：相位链等它播完再播目录入场（先退场再入场）
        exitAction = () =>
          floatCtl.state === 'exiting' ? floatCtl.active : floatCtl.exitDesktop(withX);
      } else if (newHadSearch && !oldHadSearch && floatCtl.state === 'hidden' && oldIsPost) {
        // 与旧目录退场配对时才自右移入
        const withX = tocSlideGate() && !!tocClone;
        entryAction = () => floatCtl.enterDesktop(withX);
      }
    }

    /* ---- 相位调度：退出相位走完才播进入相位（cancel = 快速二次导航，进入不启动） ---- */
    if (exitAction) {
      const a = exitAction();
      if (a) a.finished.then(() => entryAction?.()).catch(() => {});
      // 已在终态（如手机端点击退场已播完）→ 直接进入相位
      else entryAction?.();
    } else {
      entryAction?.();
    }
    // 本轮无搜索退场/入场（列表↔列表互切、首屏、**跨区边界**——区内才做淡变）：钉回目标态，零闪；
    // 浮层在途（redirect 改向中）不碰——它自己会收尾到目标态
    if (
      !exitAction &&
      !entryAction &&
      (floatCtl.state === 'shown' || floatCtl.state === 'hidden')
    ) {
      floatCtl.settle(newHadSearch);
    }

    /* ---- 左缘条带切换（列表页头 ↔ 文章面包屑条）：全部走「模糊变过去」 ---- */
    // 旧带原地模糊渐隐、新带原地模糊渐显，无位移（电脑端同样用模糊；手机端
    // 列表↔分类/标签也不再滑动）。手机端列表↔文章另做整页推入的
    // 反向抵消（counter）：根自 ±MOBILE_SLIDE 推到 0 时槽走反方向同距离（同任务启动、
    // 同时长同缓动，见下方推拉块），新条带在屏幕上原地不动——读起来是「标题模糊成
    // 面包屑」，不是「面包屑浮上来」
    if (edgeClone && newEdge) {
      let blurClone: HTMLElement | null = null;
      const exitEl = edgeClone;
      // 退出侧不写 filter 关键帧：blur 会在首帧就把过滤层挂回克隆，渐隐完成移除克隆时
      // 下方新标题会因合成层重栅格闪一下（与 captureOld 的 filter: none 钉死同因）
      const out = track(
        animate(
          exitEl,
          { opacity: [1, 0] },
          {
            duration: STRIP_BLUR_OUT_MS / 1000,
            ease: EASE_EXIT,
            reduceMotion,
            autoplay: false,
          },
        ),
      );
      out.finished
        .then(() => {
          exitEl.remove();
          edgeClone = null;
        })
        .catch(() => {});
      // 进入侧「模糊变过去」：纯 alpha 交叉（TROUBLESHOOTING 51 完整机制）：
      // 新条带**不挂 filter**（防御性钉死：标题行多一层过滤层会增加栅格压力，见 TROUBLESHOOTING 51）；
      // 静态 blur(4px) 模糊副本盖在同位只渐隐 alpha，260ms 淡尽后**移除**（渐显收尾处
      // 移除不可见层，单帧异动被渐变本身掩盖）——「模糊里变过去、收尾变清晰」观感全保留。
      // 副本必须在 counter/推入启动前量盒（槽与根都还无位移，量到的是终位）。
      // 减动效下不建模糊副本，退化为纯 alpha 交叉渐显。
      const rowEl = row();
      blurClone =
        !reduceMotion && rowEl
          ? strip.cloneIntoRow(newEdge, rowEl, 'posts-edge-clone', true)
          : null;
      if (blurClone) blurClone.style.filter = `blur(${STRIP_BLUR_PX}px)`;
      if (mobilePush) {
        const newSlot = newEdge.parentElement;
        if (newSlot) {
          const y0 = opening ? -MOBILE_SLIDE : MOBILE_SLIDE;
          // 延迟起播的空窗帧先同步钉到起始位移（同任务、无绘制间隙），出帧后反推回位
          newSlot.style.transform = `translateY(${y0}px)`;
          // 与推入根同步：位移 200ms 达 0 并钉住（终帧位移不得晚于标题渐显收尾，见 TROUBLESHOOTING 51）
          const cnt = track(
            animate(
              newSlot,
              { y: [`${y0}px`, '0px', '0px'] },
              {
                duration: EDGE_MS / 1000,
                ease: EASE,
                times: [0, 0.5, 1],
                reduceMotion,
                autoplay: false,
              },
            ),
          );
          cnt.finished
            .then(() => {
              // 与推入根同样保活不拆层：槽是标题条的父元素，拆层会重栅格化标题区
              // （弱内核下标题闪一帧）——写回非 none 恒等，层随节点下次切页移除回收
              if (newSlot.isConnected) newSlot.style.transform = 'translateY(0)';
            })
            .catch(() => {});
        }
      }
      if (blurClone) {
        // 淡尽即移除（~260ms，渐显收尾处、不可见）：移除不可见层，单帧异动被渐变本身掩盖
        const bc = track(
          animate(
            blurClone,
            { opacity: [1, 0] },
            {
              duration: STRIP_BLUR_IN_MS / 1000,
              ease: EASE_ENTRY,
              reduceMotion,
              autoplay: false,
            },
          ),
        );
        bc.finished
          .then(() => {
            blurClone.remove();
          })
          .catch(() => {});
      }
      // 延迟起播的空窗帧先同步钉不可见（同位模糊副本盖着），出帧后渐显
      newEdge.style.opacity = '0';
      track(
        animate(
          newEdge,
          { opacity: [0, 1] },
          {
            duration: STRIP_BLUR_IN_MS / 1000,
            ease: EASE_ENTRY,
            reduceMotion,
            autoplay: false,
          },
        ),
      );
    } else if (edgeClone) {
      // 新界面是普通屏：不播，直接随替换消失
      edgeClone.remove();
      edgeClone = null;
    }

    /* ---- 手机端整页推拉：新内容自下方/上方滑入（开=上滑入 / 关=下滑入） ---- */
    // 推入根播完不拆合成层：拆层触发整列玻璃卡重栅格化（弱内核下标题闪一下）——finished 后显式写回
    // 非 none 的恒等，层保活到节点随下次切页移除
    if (mobilePush) {
      const root = opening
        ? (main?.querySelector<HTMLElement>('.posts-article') ?? null)
        : (main?.querySelector<HTMLElement>('.posts-page') ?? null);
      if (root) {
        const y0 = opening ? MOBILE_SLIDE : -MOBILE_SLIDE;
        // 延迟起播的空窗帧先同步钉到起始位移（同任务、无绘制间隙），出帧后推入
        root.style.transform = `translateY(${y0}px)`;
        // 位移必须赶在渐显收尾（260ms）前完成：终帧位移（N 卡 backdrop 最终重采样）落在
        // 标题定格之后会让标题闪一帧（见 TROUBLESHOOTING 51）——关键帧 200ms 达 0
        // 并钉住（ease-out 前段已走完 ~90% 路程，观感不变），动画仍在 400ms 结束
        const a = track(
          animate(
            root,
            { y: [`${y0}px`, '0px', '0px'] },
            {
              duration: EDGE_MS / 1000,
              ease: EASE,
              times: [0, 0.5, 1],
              reduceMotion,
              autoplay: false,
            },
          ),
        );
        a.finished
          .then(() => {
            if (root.isConnected) root.style.transform = 'translateY(0)';
          })
          .catch(() => {});
      }
    }

    /* ---- 目录出入场（文章↔文章，两侧都有目录）：先退场再入场，与滚顶解耦 ---- */
    // 切页后 SwupScrollPlugin 平滑滚回顶部（时长按距离，长文可达 ~2s），旧目录克隆
    // 绝对定位挂在行内（文档坐标）——原地渐隐会被滚顶「带走」：视口 top 从 181px
    // 一路漂出屏幕，退场读作向右下漂移。先把克隆钉到它当前的视口
    // 位置（position: fixed，行及其祖先无 transform，fixed 即视口坐标），脱离页面
    // 滚动，再右移移出屏幕渐隐（PHASE_MS/EASE_EXIT，与文章→列表目录退场同节奏）。
    // 新目录在退场前就钉不可见（gate 分支构造即钉屏外右 + 透明；非 gate 分支靠显式
    // 内联 opacity 0 兜住退场 + 等待窗口），退场播完才开始落位等待、落到 sticky 钉
    // 住位才自右缘滑入（startTocEntryWait）——两拍对滑若并行会在途中交叉重叠成
    // 「重影」，顺序执行则退场结束时入场还没开始，任何时刻只有一个目录可见
    if (tocClone && hasNewToc) {
      const fadeEl = tocClone;
      const newToc = newTocEl as HTMLElement;
      const playEntry = strip.makeTocEntry(newToc);
      newToc.style.opacity = '0';
      const rect = fadeEl.getBoundingClientRect();
      fadeEl.style.position = 'fixed';
      fadeEl.style.top = `${rect.top}px`;
      fadeEl.style.left = `${rect.left}px`;
      const slide = tocSlideGate();
      const dx = slide ? strip.tocOffscreenDx(fadeEl) : 0;
      const opts = {
        duration: (slide ? PHASE_MS : EDGE_MS) / 1000,
        ease: slide ? EASE_EXIT : EASE,
        reduceMotion,
        autoplay: false,
      };
      const move = slide ? track(animate(fadeEl, { x: [0, `${dx}px`] }, opts)) : null;
      const fade = track(animate(fadeEl, { opacity: [1, 0] }, opts));
      // 有位移时位移与渐隐同时长、等它走完；无位移（减动效）等渐隐
      const last = move ?? fade;
      last.finished
        .then(() => {
          fadeEl.remove();
          tocClone = null;
          // 先退场再入场：退场播完才启动新目录的落位等待 + 右缘滑入（通常落位已
          // 到达、下一帧即播）。若退场被 cancel（快速连切，captureOld 已清落位等待
          // 与动画），这里走 catch、入场不启动——钉不可见的新目录随本轮 DOM 交换被
          // 换走，不残留
          strip.startTocEntryWait(newToc, playEntry);
        })
        .catch(() => {});
    }
  }
  return { captureOld, playTransition };
}
