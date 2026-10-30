// posts-shell.ts — 文章区常驻壳（.page-main 行）的运行时控制器
// 用法：由 BaseLayout 引入：import "../assets/js/posts-shell"
//
// 侧边栏与搜索框都在 #swup 之外、切页不重建，每次切页后本文件负责：
// ① 行变体类（--plain / --listing / --post，驱动侧栏与搜索显隐、内容列收窄）；
// ② 侧栏顶偏移 --posts-side-offset（页锚高度 + 间隙）；
// ③ 侧栏高亮（当前分类路径补展开、当前标签高亮）；
// ④ 搜索浮层按页头占位符的行内坐标定位；
// ⑤ 文章区切页转场（motion 驱动：条带模糊交叉、搜索/目录退场配对、手机端整页推拉）。
//
// 转场只在文章区界面之间播放，跨区直接落位；所有动画延迟到下一个出帧的 rAF 起播，
// 避免主线程繁忙时墙钟空转、动画直接跳到终帧。
// category-tree 脚本按需懒加载（从非文章页进入文章区时），模块单例。
// 完整机制与取舍见 .dsh/docs/ARCHITECTURE.md 与 .dsh/docs/TROUBLESHOOTING.md 第 51–53 条。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

(() => {
  if (window.__postsShellInit) return;
  window.__postsShellInit = true;

  /* ---- 0. 常量与环境 ---- */

  // 左缘滑动 / 内容滑动 / 普通渐隐时长
  const EDGE_MS = 400;
  // 平滑进出
  const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
  // 桌面端搜索/目录配对相位：四个动效（搜索/目录 × 出场/退场）完全统一——同时长、
  // 渐显渐隐与位移同步（四个效果完全一致）；入场减速落位、退场加速离场
  const PHASE_MS = 320;
  const EASE_EXIT: [number, number, number, number] = [0.4, 0, 1, 1];
  const EASE_ENTRY: [number, number, number, number] = [0, 0, 0.2, 1];
  // 搜索「移一段」的位移距离
  const SEARCH_DX = 48;
  // 目录移出屏幕的额外余量（整体在视口右缘之外）
  const TOC_OFFSCREEN_PAD = 40;
  // 手机端（≤768px）：新内容滑动距离 / 搜索框小位移 / 搜索位移与渐隐时长
  // （退场上移与整页推入同缓动（EASE）、时长按位移时长距离等比，
  //  位移必须小于手机端列式页头的标题↔搜索间隙 16px，
  //  否则入场落回会蹭到标题底边闪一下）
  const MOBILE_SLIDE = 48;
  const FLOAT_MOVE = 12;
  // 推入位移 200ms 完成并钉住（后半静止、动画仍 400ms 结束，见 TROUBLESHOOTING 51）：
  // 入场落回时长按位移时长距离等比（12/48 × 200ms = 50ms）——同归一时刻胶囊速度 = 内容
  // 速度，跟着文章上下移；退场 100ms（更短会快得失真、观感「无退场动画」）
  // 退场上移 = 渐隐时长
  const FLOAT_EXIT_MOVE_MS = 100;
  // 入场落回时长（关文章，搜索自上方落回，与位移完成同时落定）
  const FLOAT_ENTRY_MOVE_MS = 50;
  // 入场渐显（110+110=220ms 收尾）
  const FLOAT_ENTRY_FADE_MS = 110;
  // 手机端「关文章」：搜索自上方落回的延迟（避免下移时叠在文章卡片上）。
  // 整页自上方 48px 推下时，列表栅格顶（160.6-48=112.6）起初在搜索框钉住位底边（146.6）
  // 之上；新曲线（200ms 位移）栅格顶 ≈95ms 即越过胶囊底边，保留 110ms 作安全余量
  // （150ms 明显偏慢）；110+50=160ms，先于推入位移完成落定
  const FLOAT_ENTRY_DELAY_MS = 110;
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
  // 文章↔文章新目录入场的「落位等待」上限：滚顶被用户滚动打断/异常停住时不能永久
  // 藏目录，超时直接播（此时目录若在视口上方，滑入不可见、无副作用）
  const TOC_SETTLE_TIMEOUT_MS = 2500;

  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  // 目录滑动只在电脑端显示目录（≥851px；更窄目录是按钮+抽屉，只走普通渐隐）
  const tocSlideGate = () => !REDUCE_MOTION && window.matchMedia('(min-width: 851px)').matches;
  // 白纱关键帧的透明端（与 .glass 的 transparent 等价）
  const BG0 = 'rgba(255, 255, 255, 0)';
  const VEIL = (() => {
    try {
      return (
        getComputedStyle(document.documentElement).getPropertyValue('--glass-veil').trim() ||
        'rgba(255, 255, 255, 0.15)'
      );
    } catch {
      return 'rgba(255, 255, 255, 0.15)';
    }
    // 白纱令牌（variables.css --glass-veil）：移动渐隐的毛玻璃用它替代模糊
  })();

  function row(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.page-main');
  }

  /* ---- 1. 动画登记（两套生命周期） ---- */
  // anims：转场动画——快速二次导航（captureOld）一律 cancel；
  // floatAnims：搜索浮层动画——独立生命周期（不能被转场中断连带杀掉；
  // 只在浮层自己的 settle/新动画前清理）
  let anims: AnimationPlaybackControls[] = [];
  let floatAnims: AnimationPlaybackControls[] = [];
  /** 延迟起播：autoplay: false 创建后时钟冻在首关键帧，
   *  在这里等下一个真正出帧的 rAF 才 play()。rAF 回调只在合成器出帧时运行——首次
   *  切进文章区时 after-swap 后主线程还忙几百 ms（dev 按需编译 + 岛屿水合），此刻
   *  同步起播会让墙钟在卡顿里空转、恢复后一次跳到终帧（「出场没播、直接消失」）；
   *  出帧时才起播，动画的每一帧都会被画出来。起播前元素停在首关键帧，调用方必须
   *  已同任务 pre-pin 起播前位姿（无绘制间隙、不闪）。cancel() 后 state 不再是
   *  paused，延迟 play 自然跳过——不会复活已取消的动画 */
  const deferPlay = (a: AnimationPlaybackControls) => {
    window.requestAnimationFrame(() => {
      if (a.state === 'paused') a.play();
    });
  };
  const track = (a: AnimationPlaybackControls) => {
    anims.push(a);
    deferPlay(a);
    return a;
  };
  const trackFloat = (a: AnimationPlaybackControls) => {
    floatAnims.push(a);
    deferPlay(a);
    return a;
  };
  const stopAnims = () => {
    for (const a of anims) a.cancel();
    anims = [];
  };
  const stopFloatAnims = () => {
    for (const a of floatAnims) a.cancel();
    floatAnims = [];
  };

  /* ---- 2. 行变体 / 侧栏偏移 / 搜索叠放 / 侧栏高亮 ---- */

  /** ① 行变体：按内容标记推导（与 swup-widgets.ts 的页面类型探测同一口径） */
  function syncVariant(): void {
    const r = row();
    if (!r) return;
    const main = r.querySelector<HTMLElement>('main#swup');
    const isPost = !!main?.querySelector('.post-content');
    const isListing = !!main?.querySelector('.posts-page');
    r.classList.toggle('page-main--post', isPost);
    r.classList.toggle('page-main--listing', isListing);
    r.classList.toggle('page-main--plain', !isPost && !isListing);
  }

  /** ② 侧栏顶偏移：锚（页头 / 面包屑条）高度 + 行上的 --posts-offset-gap */
  let resizeObserver: ResizeObserver | null = null;

  function syncOffset(): void {
    const r = row();
    if (!r) return;
    const anchor = r.querySelector<HTMLElement>('[data-posts-anchor]');
    if (!anchor) {
      r.style.removeProperty('--posts-side-offset');
      return;
    }
    const gap = parseFloat(getComputedStyle(r).getPropertyValue('--posts-offset-gap')) || 0;
    r.style.setProperty('--posts-side-offset', `${Math.round(anchor.offsetHeight + gap)}px`);
  }

  /** ④ 行级常驻搜索框的叠放位置：读取页头占位符（.posts-header-search）的行内坐标，
   *  写 .posts-search-float 的内联 top/left/width——占位随标题换行/窗口变，跟着重测。
   *  占位不存在（文章页/普通页）时不动：浮动搜索已被行变体类隐藏。
   *  必须用与 transform 无关的布局坐标：锚的 ResizeObserver 首次回调可能赶在推入/反推动画
   *  途中，getBoundingClientRect 含动画位移，按它量会把错值写进内联且不再被重测
   *  （transform 不改变锚的尺寸）——所以量完要减去 slotAncestorTy（含槽自身反推）还原 */
  /** 槽**自身 + 槽到行之间祖先**的 transform y 位移和：手机端整页推拉移动的是槽的祖先（内容根），
   *  条带模糊变过去里槽自身还会做等距反推（counter）——getBoundingClientRect 含这些位移，
   *  量之前全部减去还原布局坐标，转场途中任意时刻量都是对的；静止时和恒 0（桌面端无副作用） */
  function slotAncestorTy(slot: HTMLElement, r: HTMLElement): number {
    let sum = 0;
    let e: HTMLElement | null = slot;
    while (e && e !== r && e !== document.body) {
      const t = getComputedStyle(e).transform;
      if (t && t !== 'none') {
        const m = /matrix\(([^)]+)\)/.exec(t);
        if (m) sum += parseFloat(m[1].split(',')[5]);
      }
      e = e.parentElement;
    }
    return sum;
  }

  function syncSearchPos(): void {
    const r = row();
    const floatEl = r?.querySelector<HTMLElement>('.posts-search-float');
    // 占位符只认真实页头的：转场克隆条带（edgeClone）带着占位符克隆且播完才移除，
    // RO 回调可能在克隆还在时触发，把它当真实占位会量到克隆位置
    const phs = r ? Array.from(r.querySelectorAll<HTMLElement>('.posts-header-search')) : [];
    const ph = phs.find((el) => !el.closest('.posts-edge-clone')) ?? null;
    // 退场/入场动画期间浮层钉在视口（内联 top/left 是视口坐标）：此刻写行相对值
    // 会把浮层瞬移；unpin 后下一轮重测自然补齐
    if (floatEl?.style.position === 'fixed') return;
    if (!r || !floatEl || !ph) return;
    const b = r.getBoundingClientRect();
    const slot = ph.closest<HTMLElement>('.posts-edge-slot');
    if (slot) {
      const s = slot.getBoundingClientRect();
      const ty = slotAncestorTy(slot, r);
      floatEl.style.top = `${s.top - b.top - ty + ph.offsetTop}px`;
      floatEl.style.left = `${s.left - b.left + ph.offsetLeft}px`;
    } else {
      const a = ph.getBoundingClientRect();
      floatEl.style.top = `${a.top - b.top}px`;
      floatEl.style.left = `${a.left - b.left}px`;
    }
    floatEl.style.width = `${ph.offsetWidth}px`;
  }

  /** 锚是每页元素，切页后重新观察（标题换行 / 窗口缩放都会改它的高度，占位位置跟着变） */
  function observeAnchor(): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    const anchor = row()?.querySelector<HTMLElement>('[data-posts-anchor]');
    if (!anchor) return;
    resizeObserver = new ResizeObserver(() => {
      syncOffset();
      syncSearchPos();
    });
    resizeObserver.observe(anchor);
  }

  /** 断点跨界（768 / 1151）一次样式重算就翻转布局结构（页头行↔列、行 padding 82↔73、
   *  槽负边距全宽化），而 ResizeObserver 在布局**之后**才回调——中间存在占位已换位、
   *  浮层内联值还没重量的帧（断点跨界时搜索框「跳一下/宽度旧值闪一下」）。
   *  MQL 的 change 回调在样式重算翻转的那一刻同步触发，此时重测与布局翻转同帧写入，
   *  消灭错位帧；RO 继续负责跨界后的连续缩放（标题换行 / 宽度变化） */
  for (const mq of [
    window.matchMedia('(max-width: 768px)'),
    window.matchMedia('(min-width: 1151px)'),
  ]) {
    mq.addEventListener('change', () => {
      syncOffset();
      syncSearchPos();
    });
  }

  /** ③ 侧栏高亮态：当前分类（最长前缀命中 data-category）+ 当前标签 */
  function syncActive(): void {
    const sidebar = row()?.querySelector<HTMLElement>('.global-sidebar');
    if (!sidebar) return;

    const segments = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    const rp = segments.indexOf('posts');
    const rest = rp >= 0 ? segments.slice(rp + 1) : [];

    const items = Array.from(sidebar.querySelectorAll<HTMLElement>('.cat-item[data-category]'));
    const paths = new Set(items.map((el) => el.dataset.category));
    let activeCategory = '';
    for (let i = rest.length; i > 0; i--) {
      const candidate = decodeURIComponent(rest.slice(0, i).join('/'));
      if (paths.has(candidate)) {
        activeCategory = candidate;
        break;
      }
    }

    for (const el of items) {
      if (el.dataset.category !== activeCategory) {
        el.classList.remove('cat-item--active');
        continue;
      }
      el.classList.add('cat-item--active');
      // 只补展开、不收起：当前分类的整条路径恒可见，用户手动开的其他节点保留
      let node = el.closest<HTMLElement>('.cat-node');
      while (node) {
        if (!node.classList.contains('cat-node--open')) {
          node.classList.add('cat-node--open');
          node
            .querySelector<HTMLElement>(':scope > .cat-row > .cat-toggle')
            ?.setAttribute('aria-expanded', 'true');
        }
        node = node.parentElement?.closest<HTMLElement>('.cat-node') ?? null;
      }
    }

    // 标签页 /posts/tag/<tag>/：chip 只渲染真实标签，按文本匹配即可。
    // 必须"每次"都跑 toggle（含 activeTag 为空）：否则从标签页切走时旧 chip 的
    // chip--active 不会被摘掉，高亮残留到其他界面
    const activeTag = rest[0] === 'tag' && rest.length === 2 ? decodeURIComponent(rest[1]) : '';
    for (const chip of sidebar.querySelectorAll<HTMLElement>('.chip')) {
      chip.classList.toggle('chip--active', chip.textContent?.trim() === activeTag);
    }
  }

  /* ---- 3. 克隆 ---- */

  /** 把元素的视觉副本贴进容器内（过场用：不参与测量、不可交互、不进可访问性树）。
   *  container = 行（左缘条克隆与目录克隆都直接挂行内，绝对定位按量出的 top/left 摆位）。
   *  克隆是纯静态展示（左缘条与目录里没有 island）。
   *  清除时机：正常转场由 finished 回调移除；快速二次导航由 captureOld 查 DOM 清掉；
   *  5s 兜底只覆盖「visit 被中断、after-swap 永不来」的孤儿 */
  function cloneIntoRow(
    src: HTMLElement,
    container: HTMLElement,
    markerClass?: string,
    noFallback = false,
  ): HTMLElement | null {
    const clone = src.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-posts-anchor');
    if (markerClass) clone.classList.add(markerClass);
    // 克隆按量出的 top/left/width 绝对定位，必须把类继承的 margin 清零：
    // .posts-header / .posts-breadcrumb 宽屏带负 margin-left 压过侧栏区（流内布局手段），
    // 对绝对定位元素这个 margin 仍会生效（left+width+margin-left 过约束时 margin-left 被保留），
    // 不清零整条克隆向左偏 284px，转场时标题「跑到左侧最前面」
    clone.style.margin = '0';
    const a = src.getBoundingClientRect();
    const b = container.getBoundingClientRect();
    clone.style.position = 'absolute';
    clone.style.top = `${a.top - b.top}px`;
    clone.style.left = `${a.left - b.left}px`;
    clone.style.width = `${a.width}px`;
    clone.style.zIndex = '20';
    clone.style.pointerEvents = 'none';
    clone.setAttribute('aria-hidden', 'true');
    container.appendChild(clone);
    // 兜底：孤儿克隆 5s 后移除（visit 被中断、after-swap 永不来）；after-swap 之后才建的克隆
    // （条带模糊副本）不挂兜底——它淡出后恒不可见、随下次 before-swap 的 clearClones 清除，
    // 而 5s 定时移除 = 随机静止时刻拆过滤层，弱内核下标题区会闪
    if (!noFallback) window.setTimeout(() => clone.remove(), 5000);
    return clone;
  }

  /** 查 DOM 清掉所有残留克隆（模块变量可能已被 finished 清空，查 DOM 最可靠） */
  function clearClones(): void {
    row()
      ?.querySelectorAll<HTMLElement>('.posts-edge-clone, .posts-toc-clone')
      .forEach((c) => c.remove());
  }

  /** 目录移出屏幕的距离：整体移到视口右缘之外 + 余量（按元素左缘计算） */
  function tocOffscreenDx(el: HTMLElement): number {
    return Math.max(
      120,
      Math.ceil(window.innerWidth - el.getBoundingClientRect().left + TOC_OFFSCREEN_PAD),
    );
  }

  /** 目录入场动作的构造（相位开始前先钉在屏外/透明，同任务内无绘制间隙、不闪）：
   *  电脑端自屏幕右缘左移渐显——位移与渐显同步（PHASE_MS/EASE_ENTRY），与搜索框
   *  移动切换同节奏；其他只渐显（400ms）。
   *  用于「旧界面没有目录、新界面出现」的进入相位（列表→文章，退出相位由搜索承担；
   *  有旧目录克隆的切页走退场相位或并行交叉渐隐，不经这里） */
  function makeTocEntry(newToc: HTMLElement): () => void {
    if (tocSlideGate()) {
      const dx = tocOffscreenDx(newToc);
      newToc.style.transform = `translateX(${dx}px)`;
      newToc.style.opacity = '0';
      return () => {
        const move = track(
          animate(
            newToc,
            { x: [`${dx}px`, 0] },
            {
              duration: PHASE_MS / 1000,
              ease: EASE_ENTRY,
              reduceMotion: REDUCE_MOTION,
              autoplay: false,
            },
          ),
        );
        const fade = track(
          animate(
            newToc,
            { opacity: [0, 1] },
            {
              duration: PHASE_MS / 1000,
              ease: EASE_ENTRY,
              reduceMotion: REDUCE_MOTION,
              autoplay: false,
            },
          ),
        );
        const cleanup = () => {
          newToc.style.transform = '';
          newToc.style.opacity = '';
        };
        move.finished.then(cleanup).catch(() => {});
        fade.finished.then(cleanup).catch(() => {});
      };
    }
    // 非 gate 只渐显：首关键帧是 opacity 0、元素自然态是 1——延迟起播的空窗帧先
    // 同步钉不可见（同任务、无绘制间隙），出帧后渐显
    newToc.style.opacity = '0';
    return () => {
      track(
        animate(
          newToc,
          { opacity: [0, 1] },
          { duration: EDGE_MS / 1000, ease: EASE, reduceMotion: REDUCE_MOTION, autoplay: false },
        ),
      );
    };
  }

  /** 文章↔文章的新目录入场：落位等待 + 标准右缘滑入。在旧目录退场播完后调用
   *  （先退场再入场）。滚回顶部过程中新目录在视口上方（或正从上方落下）——退场前
   *  已钉不可见（gate 分支 makeTocEntry 构造即钉、非 gate 分支调用方钉内联 opacity
   *  0），等待期不可见，也不露空位（等待期它本来就在视口上方）。等它落到 sticky
   *  钉住位再播滑入：落位后视口位置静止（钉在 82px），入场才是纯水平平移。落位判定
   *  用 scrollY（免逐帧布局读取）：目录文档坐标 yToc 只读一次，滚到 scrollY ≤ yToc
   *  - 82 即到达钉住位（目录视口 top 恒 ≤ 82px，越过即终态）；已在钉住位（短文 /
   *  页面本就在顶部）则下一帧立即播。超时兜底：滚顶被用户滚动打断/异常停住时不能
   *  永久藏目录——超时直接播（目录若在视口上方，滑入不可见）。退出条件：落位或超时
   *  触发入场；captureOld（新一轮切页）清 rAF 与定时器 */
  function startTocEntryWait(newToc: HTMLElement, play: () => void): void {
    cancelTocEntryWait();
    const yToc = newToc.getBoundingClientRect().top + window.scrollY;
    const begin = (): void => {
      tocEntryWait = null;
      play();
    };
    const timerId = window.setTimeout(begin, TOC_SETTLE_TIMEOUT_MS);
    const check = (): void => {
      // 已被 captureOld 清掉
      if (!tocEntryWait) return;
      if (window.scrollY <= yToc - 82) {
        window.clearTimeout(timerId);
        begin();
        return;
      }
      tocEntryWait.rafId = window.requestAnimationFrame(check);
    };
    tocEntryWait = { rafId: 0, timerId };
    tocEntryWait.rafId = window.requestAnimationFrame(check);
  }

  /* ---- 4. 搜索浮层控制（行级常驻单节点） ---- */
  // CSS 只管 visibility/pointer-events（随变体类瞬时翻转）+ 端点 opacity: 0；
  // opacity / 位移 / 白纱全在这里。白纱规则：**淡出与淡入都用**（容器背景 透明 ↔ VEIL）——
  // 移动渐隐的毛玻璃用实体白替代消失的模糊；淡入：入场前先加上半透明白（同任务 pre-pin、无绘制间隙），再随入场全程褪去
  // （白纱/淡变只用于区内动画；跨区边界直接 settle，无动画、无白纱）
  // 浮层钉视口期间的原行相对内联 top/left（unpin 时恢复）
  let floatPinSaved: { top: string; left: string } | null = null;

  /** 浮层钉视口：absolute→fixed 钉到当前视口位置，退场动画期间脱离页面滚动——
   *  切页后 SwupScrollPlugin 平滑滚回顶部，文档坐标里的浮层会被滚动「带走」，
   *  退场变成向右下的斜线（目录克隆也要钉视口）。行及其祖先无
   *  transform/filter，fixed 即视口坐标。用途：退场（桌面/移动）起播前钉、动画播完
   *  （opacity 0）或静态归位（settle）时恢复，恢复不可见；移动端入场先钉、落回延迟
   *  结束（渐显刚起、近不可见）即 unpin（见 enterMobile）。桌面端入场不钉——落回
   *  跟随内容，钉了会在滚顶在途时于动画收尾还原行相对位置处跳一次（见 enterDesktop） */
  function pinFloat(f: HTMLElement): void {
    // 已在钉住态（redirect 中途被改向）
    if (f.style.position === 'fixed') return;
    floatPinSaved = { top: f.style.top, left: f.style.left };
    const r = f.getBoundingClientRect();
    f.style.position = 'fixed';
    f.style.top = `${r.top}px`;
    f.style.left = `${r.left}px`;
  }

  function unpinFloat(f: HTMLElement): void {
    if (f.style.position !== 'fixed') return;
    f.style.position = '';
    f.style.top = floatPinSaved?.top ?? '';
    f.style.left = floatPinSaved?.left ?? '';
    floatPinSaved = null;
  }

  const floatCtl = {
    state: 'shown' as 'shown' | 'hidden' | 'exiting' | 'entering',
    active: null as AnimationPlaybackControls | null,

    el(): HTMLElement | null {
      return row()?.querySelector<HTMLElement>('.posts-search-float') ?? null;
    },

    /** 钉到静态目标态：清掉一切内联（transform/opacity/visibility/背景白纱 + 视口钉） */
    settle(show: boolean): void {
      stopFloatAnims();
      this.active = null;
      this.state = show ? 'shown' : 'hidden';
      const f = this.el();
      if (!f) return;
      unpinFloat(f);
      f.style.transform = '';
      f.style.visibility = '';
      f.style.backgroundColor = '';
      f.style.opacity = show ? '1' : '0';
    },

    /** 幂等收尾：只在所有出入场动画都播完后被调用（allFinished 计数）；
     *  清掉一切内联回到静态目标态。若让先结束者收尾，它清的 visibility/transform 内联
     *  会让变体类（如文章页隐藏浮层）提前生效——后结束动画的尾巴就播给用户看漏了 */
    finish(show: boolean, f: HTMLElement): void {
      this.state = show ? 'shown' : 'hidden';
      this.active = null;
      // 动画播完：脱离视口钉，回到行内绝对定位（两条入场路径此处均 no-op：移动端入场落回延迟中已解除、桌面端入场从不钉；退场以 opacity 0 收尾，还原不可见）
      unpinFloat(f);
      f.style.visibility = '';
      f.style.transform = '';
      f.style.backgroundColor = '';
      f.style.opacity = show ? '1' : '0';
    },

    /** 计数收尾：全部入参动画播完才 finish（被 cancel 的不会计数，收尾交给后续 settle/新动画） */
    allFinished(f: HTMLElement, show: boolean, anims: AnimationPlaybackControls[]): void {
      let done = 0;
      const tick = () => {
        if (++done === anims.length) this.finish(show, f);
      };
      for (const a of anims) a.finished.then(tick).catch(() => {});
    },

    /** 手机端「开文章」退场：上移（同推入速度）+ 渐隐 + 白纱。after-swap 时触发（见 playTransition） */
    exitMobile(): AnimationPlaybackControls | null {
      if (this.state !== 'shown') return this.active;
      const f = this.el();
      if (!f) return null;
      // 清掉任何残留内联（幂等起点）
      this.settle(true);
      this.state = 'exiting';
      // 变体类可能已隐藏容器（swap 先于动画结束）——退出窗口内强制可见
      f.style.visibility = 'visible';
      // 退场动画期间钉视口：滚顶滑行不会把上移+渐隐「带走」成斜线
      pinFloat(f);
      const move = trackFloat(
        animate(
          f,
          { y: [0, `-${FLOAT_MOVE}px`] },
          {
            duration: FLOAT_EXIT_MOVE_MS / 1000,
            ease: EASE,
            reduceMotion: REDUCE_MOTION,
            autoplay: false,
          },
        ),
      );
      const fade = trackFloat(
        animate(
          f,
          { opacity: [1, 0], backgroundColor: [BG0, VEIL] },
          {
            duration: FLOAT_EXIT_MOVE_MS / 1000,
            ease: EASE_EXIT,
            reduceMotion: REDUCE_MOTION,
            autoplay: false,
          },
        ),
      );
      this.active = move;
      this.allFinished(f, false, [move, fade]);
      return move;
    },

    /** 桌面端退场：右移 48px（配对目录入场时）+ 渐隐 + 白纱；无配对只渐隐 */
    exitDesktop(withX: boolean): AnimationPlaybackControls | null {
      if (this.state !== 'shown') return this.active;
      const f = this.el();
      if (!f) return null;
      // 清掉任何残留内联（幂等起点）
      this.settle(true);
      this.state = 'exiting';
      // 变体类已先隐藏容器——退出窗口内强制可见
      f.style.visibility = 'visible';
      // 退场动画期间钉视口：滚顶滑行不会把右移+渐隐「带走」成向右下的斜线
      pinFloat(f);
      const opts = {
        duration: PHASE_MS / 1000,
        ease: EASE_EXIT,
        reduceMotion: REDUCE_MOTION,
        autoplay: false,
      };
      const move = withX ? trackFloat(animate(f, { x: [0, `${SEARCH_DX}px`] }, opts)) : null;
      const fade = trackFloat(animate(f, { opacity: [1, 0], backgroundColor: [BG0, VEIL] }, opts));
      // 相位链到整体退场（位移与渐隐同时长，链谁等效）
      this.active = move ?? fade;
      this.allFinished(f, false, move ? [move, fade] : [fade]);
      return move;
    },

    /** 手机端「关文章」入场：自上方偏移落回 + 渐显 + 白纱（入场前先铺白、随入场全程褪去） */
    enterMobile(): void {
      const f = this.el();
      if (!f || this.state !== 'hidden') return;
      this.settle(false);
      this.state = 'entering';
      // 入场动画期间钉视口（先于 pre-pin transform：量盒须取无位移的自然位）
      pinFloat(f);
      f.style.transform = `translateY(-${FLOAT_MOVE}px)`;
      f.style.opacity = '0';
      // 入场前先加上半透明白，关键帧随入场全程褪去
      f.style.backgroundColor = VEIL;
      // 落回延迟（FLOAT_ENTRY_DELAY_MS）：等整页推下把栅格顶移过胶囊底边再下移，
      // 可见帧不叠卡片（钉住位 opacity 0，延迟期不可见）
      const delay = FLOAT_ENTRY_DELAY_MS / 1000;
      // 延迟一结束即解除视口钉：落回期间浮层行内绝对定位、真正跟着内容走（fixed 钉
      // 不随推入移动，内容快而浮层慢会显得「不跟着文章走」）；unpin 的胶囊重合成落在
      // 渐显进行中，即使挤栅格预算单帧也被 alpha 覆盖（TROUBLESHOOTING 51）
      window.setTimeout(() => {
        if (this.state === 'entering') unpinFloat(f);
      }, FLOAT_ENTRY_DELAY_MS);
      const move = trackFloat(
        animate(
          f,
          { y: [`-${FLOAT_MOVE}px`, 0] },
          {
            duration: FLOAT_ENTRY_MOVE_MS / 1000,
            delay,
            ease: EASE_ENTRY,
            reduceMotion: REDUCE_MOTION,
            autoplay: false,
          },
        ),
      );
      const fade = trackFloat(
        animate(
          f,
          { opacity: [0, 1], backgroundColor: [VEIL, BG0] },
          {
            duration: FLOAT_ENTRY_FADE_MS / 1000,
            delay,
            ease: EASE_ENTRY,
            reduceMotion: REDUCE_MOTION,
            autoplay: false,
          },
        ),
      );
      this.active = move;
      this.allFinished(f, true, [move, fade]);
    },

    /** 桌面端入场：自右偏移 48px 落回（配对目录退场时）+ 渐显 + 白纱（入场前先铺白、随入场全程褪去）；无配对只渐显。
     *  不钉视口：落回跟随内容（行内绝对定位，与移动端入场落回同范式）——切页后滚顶滑行可能
     *  仍在途，钉视口会把胶囊冻结在钉住时刻的视口位、页头随页面落定在视口下移，动画收尾
     *  行相对位置时胶囊会跳一次 */
    enterDesktop(withX: boolean): void {
      const f = this.el();
      if (!f || this.state !== 'hidden') return;
      // 清掉任何残留内联（幂等起点）
      this.settle(false);
      this.state = 'entering';
      const opts = {
        duration: PHASE_MS / 1000,
        ease: EASE_ENTRY,
        reduceMotion: REDUCE_MOTION,
        autoplay: false,
      };
      // 位姿先内联写好再起播（同任务内无绘制间隙，不闪）
      if (withX) f.style.transform = `translateX(${SEARCH_DX}px)`;
      f.style.opacity = '0';
      // 入场前先加上半透明白，关键帧随入场全程褪去
      f.style.backgroundColor = VEIL;
      const move = withX ? trackFloat(animate(f, { x: [`${SEARCH_DX}px`, 0] }, opts)) : null;
      const fade = trackFloat(animate(f, { opacity: [0, 1], backgroundColor: [VEIL, BG0] }, opts));
      this.active = move ?? fade;
      this.allFinished(f, true, move ? [move, fade] : [fade]);
    },

    /** 快速连切：在途相位（退场/入场）被新一轮切页打断时，不静默掐断硬切——
     *  从飞行中位姿改向到本轮目的地的静止态（与目录克隆的中断处理同范式：停下、
     *  再走完整动效）：退场未完就切回列表 → 自当前位置归位（「停下再回去」）；
     *  入场未完就切进文章 → 自当前位置继续离场，补完退场动画。
     *  飞行中位姿只能从 computed style（最后一帧渲染值）读：motion 的 cancel 会把
     *  元素回退到首关键帧（把 keyframes[0] 重写进内联），cancel 之后内联里已不是
     *  在途位姿——与 nav-indicator 快速连点改向同范式（先读 computed 再改向）。
     *  时长按剩余位移/剩余渐隐占全程的比例折算（25%–100%） */
    redirect(show: boolean): AnimationPlaybackControls | null {
      const f = this.el();
      if (!f || (this.state !== 'exiting' && this.state !== 'entering')) return this.active;
      // 先读：cancel 会把内联改写回首关键帧
      const { dx, dy, op, bg } = readFloatPose(f);
      stopFloatAnims();
      // 重钉在途位姿：cancel 改写的首关键帧位姿不可暴露——延迟期 motion 不写帧，
      // 元素会停在内联值上直到动画首帧
      f.style.transform = `translate(${dx}px, ${dy}px)`;
      f.style.opacity = `${op}`;
      f.style.backgroundColor = bg;
      // 行变体已翻走隐藏容器——补完退场窗口内强制可见（同 exitDesktop）
      if (!show) f.style.visibility = 'visible';
      const mobile = isMobile();
      const tx = show ? 0 : mobile ? 0 : SEARCH_DX;
      const ty = show ? 0 : mobile ? -FLOAT_MOVE : 0;
      // 剩余量：主轴位移余量与透明度余量取大，夹在 25%–100% 全程之间
      const axisLeft = show
        ? mobile
          ? Math.abs(dy)
          : Math.abs(dx)
        : mobile
          ? Math.abs(-FLOAT_MOVE - dy)
          : Math.abs(SEARCH_DX - dx);
      const full = mobile ? FLOAT_MOVE : SEARCH_DX;
      const opLeft = show ? 1 - op : op;
      const frac = Math.min(1, Math.max(0.25, Math.max(axisLeft / full, opLeft)));
      // 手机端归位与 enterMobile 同样延迟：等整页推下把栅格顶移过胶囊底边再落回，可见帧不叠卡片
      const delay = mobile && show ? FLOAT_ENTRY_DELAY_MS / 1000 : 0;
      const a = trackFloat(
        animate(
          f,
          {
            x: [`${dx}px`, `${tx}px`],
            y: [`${dy}px`, `${ty}px`],
            opacity: [op, show ? 1 : 0],
            backgroundColor: [bg, show ? BG0 : VEIL],
          },
          {
            duration: (PHASE_MS * frac) / 1000,
            delay,
            ease: show ? EASE_ENTRY : EASE_EXIT,
            reduceMotion: REDUCE_MOTION,
            autoplay: false,
          },
        ),
      );
      this.state = show ? 'entering' : 'exiting';
      this.active = a;
      a.finished.then(() => this.finish(show, f)).catch(() => {});
      return a;
    },
  };

  /** 读浮层当前位姿 = 最后一帧渲染值：在途位姿只能从 computed style 读——
   *  motion 的 cancel 会把元素回退到首关键帧（keyframes[0] 重写进内联），
   *  cancel 之后内联里已不是在途值（nav-indicator 的 currentX 同口径）。
   *  transform 按 matrix 第 5/6 分量解析（translateX/translateY）；opacity 取不到按 1 */
  function readFloatPose(f: HTMLElement): { dx: number; dy: number; op: number; bg: string } {
    const cs = getComputedStyle(f);
    let dx = 0;
    let dy = 0;
    const t = cs.transform;
    if (t && t !== 'none') {
      const m = /matrix\(([^)]+)\)/.exec(t);
      if (m) {
        const p = m[1].split(',');
        dx = parseFloat(p[4]) || 0;
        dy = parseFloat(p[5]) || 0;
      }
    }
    const o = parseFloat(cs.opacity);
    return { dx, dy, op: Number.isFinite(o) ? o : 1, bg: cs.backgroundColor || BG0 };
  }

  /* ---- 5. 转场编排 ---- */
  let edgeClone: HTMLElement | null = null;
  let tocClone: HTMLElement | null = null;
  // 旧页是列表系界面（搜索正在显示）——captureOld 时记录
  let oldHadSearch = false;
  // 旧页是文章详情（面包屑条）——区分「区内」与「跨区」搜索处理
  let oldIsPost = false;
  // 文章↔文章新目录入场的落位等待（rAF + 超时，双退出条件；captureOld 清）
  let tocEntryWait: { rafId: number; timerId: number } | null = null;

  function cancelTocEntryWait(): void {
    if (!tocEntryWait) return;
    window.cancelAnimationFrame(tocEntryWait.rafId);
    window.clearTimeout(tocEntryWait.timerId);
    tocEntryWait = null;
  }

  /** 替换前调用（astro:before-swap，content:replace 前一刻）：清场 + 克隆静止暂存 */
  function captureOld(): void {
    // 只停转场动画；搜索浮层的点击退场独立生命周期，不连带
    stopAnims();
    clearClones();
    edgeClone = null;
    tocClone = null;
    oldHadSearch = false;
    oldIsPost = false;
    // 切页已提交：早期点击等待结束
    pendingEarlyNav = null;
    // 上一轮文章↔文章新目录的落位等待作废（元素即将被换走）
    cancelTocEntryWait();
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
      edgeClone = cloneIntoRow(old, r, 'posts-edge-clone');
      // 克隆全程钉死 filter: none：带过滤层的克隆被移除时，下方新标题会因合成层重栅格
      // 闪一下（新条带本身已不挂 filter，此为防御性钉死）
      if (edgeClone) edgeClone.style.filter = 'none';
    }
    const oldToc = main?.querySelector<HTMLElement>('.post-sidebar');
    if (oldToc && getComputedStyle(oldToc).display !== 'none') {
      oldToc.style.transform = '';
      oldToc.style.opacity = '';
      tocClone = cloneIntoRow(oldToc, r, 'posts-toc-clone');
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
    const mobilePush = isMobile() && !REDUCE_MOTION && (opening || closing);

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
          const dx = slide ? tocOffscreenDx(el) : 0;
          const move = slide
            ? track(
                animate(
                  el,
                  { x: [0, `${dx}px`] },
                  {
                    duration: PHASE_MS / 1000,
                    ease: EASE_EXIT,
                    reduceMotion: REDUCE_MOTION,
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
                reduceMotion: REDUCE_MOTION,
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
      entryAction = makeTocEntry(newTocEl as HTMLElement);
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
            reduceMotion: REDUCE_MOTION,
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
        !REDUCE_MOTION && rowEl ? cloneIntoRow(newEdge, rowEl, 'posts-edge-clone', true) : null;
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
                reduceMotion: REDUCE_MOTION,
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
              reduceMotion: REDUCE_MOTION,
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
            reduceMotion: REDUCE_MOTION,
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
              reduceMotion: REDUCE_MOTION,
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
      const playEntry = makeTocEntry(newToc);
      newToc.style.opacity = '0';
      const rect = fadeEl.getBoundingClientRect();
      fadeEl.style.position = 'fixed';
      fadeEl.style.top = `${rect.top}px`;
      fadeEl.style.left = `${rect.left}px`;
      const slide = tocSlideGate();
      const dx = slide ? tocOffscreenDx(fadeEl) : 0;
      const opts = {
        duration: (slide ? PHASE_MS : EDGE_MS) / 1000,
        ease: slide ? EASE_EXIT : EASE,
        reduceMotion: REDUCE_MOTION,
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
          startTocEntryWait(newToc, playEntry);
        })
        .catch(() => {});
    }
  }

  /* ---- 6. 事件与初始化 ---- */

  // window.swup 在实例赋值前会被 DOM id 回退解析成 <main id="swup"> 元素（truthy），
  // !!window.swup 判不出就绪，必须按实例自身特征甄别
  interface SwupLike {
    hooks: { on: (name: string, handler: () => void) => void };
    navigate: (url: string) => void;
  }
  function realSwup(): SwupLike | null {
    const s = (window as Window & { swup?: unknown }).swup;
    if (!s || typeof s !== 'object') return null;
    const sw = s as Partial<SwupLike>;
    return sw.hooks && typeof sw.navigate === 'function' ? (s as SwupLike) : null;
  }

  // swup 实例钩子：@swup/astro 只在 document 上桥接 astro:before-swap / after-swap / page-load
  // 三个事件，覆盖不了「fetch 失败」——用 astro.config.ts globalInstance: true 暴露的
  // window.swup（swup 在 onIdleAfterLoad 才初始化，实例可能晚于本模块——钩子按需在首次点击时绑）。
  // 用途：fetch 失败（404 / 中断）且仍留在列表系界面时恢复搜索框（兜底：搜索框点击时
  // 不动，失败时通常尚未退场，本回调只覆盖在途被打断的少数情形）。
  let swupHooksBound = false;
  // 首屏实例未就绪时点区内链接：拦截原生全页跳转，等实例就绪后 navigate() 转正场，
  // 超时回退原生跳转（此变量是该轮询的在途状态）
  let pendingEarlyNav: { url: string; timer: number } | null = null;
  // 实例在 load+idle 才创建：慢网/冷缓存下 load 可超 5s（首载场景），时限要覆盖它
  const EARLY_NAV_TIMEOUT_MS = 10000;

  function bindSwupHooks(): void {
    if (swupHooksBound) return;
    const swup = realSwup();
    // 实例未就绪（取到的是 <main> 元素回退）——不打污染标记，下次点击再绑
    if (!swup) return;
    swupHooksBound = true;
    const restoreAfterFail = () => {
      // 导航已失败：早期等待随之作废，走原生兜底结果
      pendingEarlyNav = null;
      // 只在「仍停在列表系界面」时恢复——失败后内容未换，若此刻在详情页，
      // 搜索不该出现
      if (floatCtl.state !== 'shown' && row()?.classList.contains('page-main--listing'))
        floatCtl.settle(true);
    };
    swup.hooks.on('fetch:error', restoreAfterFail);
    swup.hooks.on('visit:abort', restoreAfterFail);
  }

  /** 首屏实例未就绪时点区内链接：swup 点击委托还没挂载，原生跳转 = 整页加载，
   *  落地首屏不播转场（首次访问时点卡片，动效不播）。
   *  拦截点击、等实例就绪后 navigate() 转成正常切页——转场照常播；
   *  超时回退原生跳转（整页加载，与现状一致）。跨区目的地本就无转场，不拦截 */
  function onEarlyClick(e: MouseEvent): void {
    // 实例已就绪：swup 自己的委托接管
    if (REDUCE_MOTION || realSwup()) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    const a = t.closest('a[href]');
    if (!(a instanceof HTMLAnchorElement)) return;
    const href = a.getAttribute('href') ?? '';
    if (!href.startsWith('/posts/') || a.target === '_blank') return;
    if (a.hasAttribute('data-no-swup') || t.closest('[data-no-swup]')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const r = row();
    if (
      !r ||
      (!r.classList.contains('page-main--listing') && !r.classList.contains('page-main--post'))
    )
      return;
    // 同页
    if (href.replace(/\/+$/, '') === location.pathname.replace(/\/+$/, '')) return;
    e.preventDefault();
    if (pendingEarlyNav) window.clearTimeout(pendingEarlyNav.timer);
    const started = Date.now();
    const poll = (): void => {
      const s = realSwup();
      if (s) {
        // 导航已正式发起：早期点击等待结束（before-swap 时统一清掉）
        try {
          s.navigate(href);
        } catch {
          pendingEarlyNav = null;
          location.assign(href);
        }
        return;
      }
      if (Date.now() - started > EARLY_NAV_TIMEOUT_MS) {
        pendingEarlyNav = null;
        location.assign(href);
        return;
      }
      pendingEarlyNav = { url: href, timer: window.setTimeout(poll, 100) };
    };
    pendingEarlyNav = { url: href, timer: window.setTimeout(poll, 100) };
  }

  /** 手机端：点击只绑 swup 钩子（fetch 失败兜底）。搜索框显隐不在点击时动——
   *  点击时动会旧内容仍在屏上，搜索框比新页面加载完先消失；
   *  退场/入场/settle 全部由 playTransition 在 after-swap 统一驱动
   *  （区内「开文章」在那里启动退场、跨区 settle 直接消失/出现） */
  function onDocClick(): void {
    if (REDUCE_MOTION || !isMobile()) return;
    bindSwupHooks();
  }

  /* ---- category-tree 脚本守卫：侧栏常驻，模块只需加载一次 ---- */
  let importing = false;
  function ensureCategoryTree(): void {
    if (window.__postCatTreeBound || importing) return;
    const r = row();
    // 普通页侧栏隐藏、树不需要交互，不加载（省 motion 共享块）
    if (!r || r.classList.contains('page-main--plain')) return;
    if (!document.getElementById('category-tree')) return;
    importing = true;
    import('./category-tree').finally(() => {
      importing = false;
    });
  }

  function onReady(isSwap = false): void {
    syncVariant();
    syncOffset();
    observeAnchor();
    syncSearchPos();
    syncActive();
    ensureCategoryTree();
    if (isSwap) {
      // 首屏整页加载不播转场，只有 swup 切页才播；此刻新内容已加载完，播放不会先于内容
      playTransition();
    } else {
      // 首屏：搜索钉到变体目标态（在首次绘制前，无闪）
      const r = row();
      if (r) floatCtl.settle(r.classList.contains('page-main--listing'));
    }
  }

  // astro:* 事件由 @swup/astro 在 document 上派发且不冒泡（new Event 默认 bubbles:false），必须监听 document
  document.addEventListener('click', onEarlyClick);
  document.addEventListener('click', onDocClick);
  document.addEventListener('astro:before-swap', captureOld);
  document.addEventListener('astro:after-swap', () => onReady(true));
  onReady();
})();

// 标记为模块：文件顶层有 import，TS 模块检查要求显式模块语义
export {};
