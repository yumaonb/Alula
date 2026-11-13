// transition.ts — 文章区切页转场：左缘条带（列表页头 ↔ 文章面包屑条）的「模糊变过去」
// 用法：const transition = createTransition({ row, strip, floatCtl, track, stopAnims, ... })
//
// 转场只在文章区界面之间播放，跨区直接落位。搜索框显隐不参与转场：每次切页由
// playTransition 的 settle 直接落位到目标态（显隐即时，无出入场动画）。
import type { AnimationPlaybackControls } from 'motion';

import type { SearchFloatCtl } from './search-float';
import type { Strip } from './strip';
import type { animateLazy } from '../util/motion';

// 条带交换「模糊变过去」（**全部**左缘条带切换——桌面端所有 + 手机端列表↔文章 +
// 手机端列表↔分类/标签；无位移，两端观感一致）：
// 旧带原地渐隐（opacity 1→0；退出侧不写 filter 关键帧——带过滤层的克隆被移除时，
// 下方新标题会因合成层重栅格闪一下）；新带原地渐显（**不挂 filter**——标题行的
// 过滤层是受害者：切页瞬间 N 张玻璃卡的 backdrop 缓冲建立挤占栅格预算时，
// 过滤层重提交丢一帧 = 标题闪一帧，见 TROUBLESHOOTING 第 51 条）+ 静态 blur(4px)
// 模糊副本原地渐隐、淡尽后移除（纯 alpha 交叉）
// 旧条带：渐隐时长（只走 opacity）
const STRIP_BLUR_OUT_MS = 160;
// 新条带：模糊交叉渐显时长（真带渐显 + 模糊副本渐隐，同时长）
const STRIP_BLUR_IN_MS = 260;
// 模糊峰值（px，模糊副本的静态 blur）
const STRIP_BLUR_PX = 4;
// 渐隐加速离场 / 渐显减速落位
const EASE_EXIT: [number, number, number, number] = [0.4, 0, 1, 1];
const EASE_ENTRY: [number, number, number, number] = [0, 0, 0.2, 1];

export interface TransitionEnv {
  /** 当前文章区行（`.page-main`） */
  row: () => HTMLElement | null;
  strip: Strip;
  floatCtl: SearchFloatCtl;
  /** 登记转场动画（切页清场时统一 cancel） */
  track: (a: AnimationPlaybackControls) => AnimationPlaybackControls;
  /** 取消转场动画（captureOld 起手） */
  stopAnims: () => void;
  reduceMotion: boolean;
  /** 切页已提交：早期导航等待作废 */
  cancelEarlyNav: () => void;
  /** 位移动画驱动（posts-shell 注入 motion 懒加载入口，behavior 测试可替换） */
  animate: typeof animateLazy;
}

export interface Transition {
  captureOld(): void;
  playTransition(): void;
}

export function createTransition(env: TransitionEnv): Transition {
  const { row, strip, floatCtl, track, stopAnims, reduceMotion, animate } = env;
  const { cancelEarlyNav } = env;
  let edgeClone: HTMLElement | null = null;

  /** 替换前调用（astro:before-swap，content:replace 前一刻）：清场 + 克隆静止暂存 */
  function captureOld(): void {
    // 只停转场动画；搜索浮层的点击退场独立生命周期，不连带
    stopAnims();
    strip.clearClones();
    edgeClone = null;
    // 切页已提交：早期点击等待结束
    cancelEarlyNav();
    const r = row();
    if (!r) return;
    const main = r.querySelector<HTMLElement>('main#swup');
    // 快速连切保护：上次转场未播完时，旧条带可能带着被 cancel 的动画残留内联
    // transform/opacity（cancel 不清内联样式）——克隆的量盒必须按自然位置来，
    // 先清零。这些元素马上就要被 swup 换掉，清零的这一帧不会被看见
    const old = main?.querySelector<HTMLElement>('.posts-header, .posts-breadcrumb');
    if (old) {
      old.style.transform = '';
      old.style.opacity = '';
      edgeClone = strip.cloneEdge(old, r);
      // 克隆全程钉死 filter: none：带过滤层的克隆被移除时，下方新标题会因合成层重栅格
      // 闪一下（新条带本身已不挂 filter，此为防御性钉死）
      if (edgeClone) edgeClone.style.filter = 'none';
    }
  }

  /** 新内容加载完后调用（swup:content:replace）：判定界面并播放转场 */
  function playTransition(): void {
    const r = row();
    // 新条带只在 main#swup 里找：克隆挂进行内（#swup 之外），若在整行里 querySelector，
    // 离开文章区时唯一命中的会是克隆自己（把动画加到克隆上会与新条带互搏）
    const newEdge =
      r?.querySelector<HTMLElement>('main#swup .posts-header, main#swup .posts-breadcrumb') ?? null;
    // 搜索框不参与转场：直接落位到目标态（列表系界面显示、其他隐藏）；行变体类
    // 已在 syncShellState 里翻完，CSS 的 visibility/pointer-events 已随之生效，
    // 这里只把 opacity 钉到与变体一致（settle 顺带清掉任何残留内联）
    const newHadSearch = !!newEdge?.querySelector('.posts-header-search');

    /* ---- 左缘条带切换（列表页头 ↔ 文章面包屑条）：「模糊变过去」 ---- */
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
      // 新条带**不挂 filter**（防御性钉死：标题行多一层过滤层会增加栅格压力，
      // 见 TROUBLESHOOTING 51）；静态 blur(4px) 模糊副本盖在同位只渐隐 alpha，
      // 260ms 淡尽后**移除**（渐显收尾处移除不可见层，单帧异动被渐变本身掩盖）
      // ——「模糊里变过去、收尾变清晰」观感全保留。
      // 减动效下不建模糊副本，退化为纯 alpha 交叉渐显。
      const rowEl = row();
      blurClone = !reduceMotion && rowEl ? strip.cloneBlur(newEdge, rowEl) : null;
      if (blurClone) blurClone.style.filter = `blur(${STRIP_BLUR_PX}px)`;
      if (blurClone) {
        // 淡尽即移除（~260ms，渐显收尾处、不可见）：移除不可见层，单帧异动被渐变本身掩盖
        const bc = track(
          animate(
            blurClone,
            { opacity: [1, 0] },
            {
              duration: STRIP_BLUR_IN_MS / 1000,
              ease: EASE_ENTRY,
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
            autoplay: false,
          },
        ),
      );
    } else if (edgeClone) {
      // 新界面是普通屏：不播，直接随替换消失
      edgeClone.remove();
      edgeClone = null;
    }

    /* ---- 搜索框落位：目标态直接可见 / 隐藏，无动画 ---- */
    floatCtl.settle(newHadSearch);
  }
  return { captureOld, playTransition };
}
