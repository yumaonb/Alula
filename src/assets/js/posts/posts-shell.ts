// posts-shell.ts — 文章区常驻壳（.page-main 行）的运行时控制器
// 用法：由 BaseLayout 引入：import "../assets/js/posts/posts-shell"
//
// 侧边栏与搜索框都在 #swup 之外、切页不重建，切页后要据此重跑一遍。具体实现在各分件：
// 行变体类 / 侧栏顶偏移 / 侧栏高亮 → posts/row-state.ts
// 搜索浮层摆位与显隐落位 → posts/search-float.ts
// 转场编排 → posts/transition.ts（过场件在 posts/strip.ts）
// 本文件只做环境探测、动画登记与接线。
//
// 转场只在文章区界面之间播放，跨区直接落位；所有动画延迟到下一个出帧的 rAF 起播，
// 避免主线程繁忙时墙钟空转、动画直接跳到终帧。
// category-tree 脚本按需懒加载（从非文章页进入文章区时），模块单例。
// 完整机制与取舍见 docs/reference/ARCHITECTURE.md 与 docs/reference/TROUBLESHOOTING.md 第 51–53 条。
import type { AnimationPlaybackControls } from 'motion';

import { createEarlyNav } from './early-nav';
import { EDGE_CLONE_CLASS } from '../util/post-sidebar';
import { createRowState } from './row-state';
import { createSearchFloat, placeFloat } from './search-float';
import { createStrip } from './strip';
import { createTransition } from './transition';
import { animateLazy, preloadMotion } from '../util/motion';

(() => {
  if (window.__postsShellInit) return;
  window.__postsShellInit = true;

  /* ---- 0. 常量与环境 ---- */

  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function row(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.page-main');
  }

  /* ---- 1. 动画登记 ---- */
  // 转场动画——快速二次导航（captureOld）一律 cancel
  let anims: AnimationPlaybackControls[] = [];
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
  const stopAnims = () => {
    for (const a of anims) a.cancel();
    anims = [];
  };

  /* ---- 2. 行状态（变体类 / 侧栏偏移 / 侧栏高亮实现在 posts/row-state.ts） ---- */

  /** ④ 行级常驻搜索框的叠放位置：找出真实占位符，摆位交给 posts/search-float.ts
   *  （占位随标题换行 / 窗口变，跟着重测；量的是布局坐标，转场途中也准）。
   *  占位不存在（文章页 / 普通页）时不动：浮动搜索已被行变体类隐藏。 */
  function syncSearchPos(): void {
    const r = row();
    const floatEl = r?.querySelector<HTMLElement>('.posts-search-float');
    // 占位符只认真实页头的：转场克隆条带（edgeClone）带着占位符克隆且播完才移除，
    // RO 回调可能在克隆还在时触发，把它当真实占位会量到克隆位置
    const phs = r ? Array.from(r.querySelectorAll<HTMLElement>('.posts-header-search')) : [];
    const ph = phs.find((el) => !el.closest(`.${EDGE_CLONE_CLASS}`)) ?? null;
    if (!r || !floatEl || !ph) return;
    placeFloat(r, ph, floatEl);
  }

  // 行变体 / 侧栏偏移 / 侧栏高亮 + 锚观察与断点跨界重测（几何一变就回调 onLayoutChange）
  const { syncVariant, syncOffset, syncActive, observeAnchor } = createRowState({
    row,
    onLayoutChange: syncSearchPos,
  });

  /* ---- 3. 条带克隆（实现在 posts/strip.ts） ---- */
  const strip = createStrip({
    row,
  });

  /* ---- 4. 搜索浮层控制（行级常驻单节点） ---- */
  // 摆位几何（placeFloat）与显隐落位都在 posts/search-float.ts
  const floatCtl = createSearchFloat({
    row,
  });

  /* ---- 5. 首屏早期导航与 fetch 失败兜底（实现在 posts/early-nav.ts） ---- */
  const earlyNav = createEarlyNav({ row, reduceMotion: REDUCE_MOTION, floatCtl });

  /* ---- 6. 转场编排（实现在 posts/transition.ts） ---- */
  const transition = createTransition({
    row,
    strip,
    floatCtl,
    track,
    stopAnims,
    reduceMotion: REDUCE_MOTION,
    cancelEarlyNav: () => earlyNav.cancel(),
    animate: animateLazy,
  });

  /* ---- 7. 事件与初始化 ---- */

  /* ---- category-tree 脚本守卫：侧栏常驻，模块只需加载一次 ---- */
  let categoryTreeLoad: Promise<void> | null = null;
  function ensureCategoryTree(): Promise<void> {
    if (window.__postCatTreeBound) return Promise.resolve();
    if (categoryTreeLoad) return categoryTreeLoad;
    const r = row();
    // 普通页侧栏隐藏、树不需要交互，不加载（省 motion 共享块）
    if (!r || r.classList.contains('page-main--plain')) return Promise.resolve();
    if (!document.getElementById('category-tree')) return Promise.resolve();
    categoryTreeLoad = import('./category-tree')
      .then(() => undefined)
      .catch((err: unknown) => {
        console.error('[posts-shell] category-tree 懒加载失败，分类树将无交互', err);
      })
      .finally(() => {
        categoryTreeLoad = null;
      });
    return categoryTreeLoad;
  }

  // 两个生命周期共用的同步步骤：按新内容重测行变体、侧栏偏移与高亮
  function syncShellState(): void {
    syncVariant();
    syncOffset();
    observeAnchor();
    syncSearchPos();
    syncActive();
    void ensureCategoryTree().then(() => syncActive());
  }

  // 首屏整页加载：同步后把搜索钉到变体目标态（在首次绘制前，无闪）
  function initializeShell(): void {
    syncShellState();
    const r = row();
    if (r) floatCtl.settle(r.classList.contains('page-main--listing'));
  }

  // swup 切页：同步后播转场——此刻新内容已加载完，播放不会先于内容
  function refreshAfterNavigation(): void {
    syncShellState();
    transition.playTransition();
  }

  // astro:* 事件由 @swup/astro 在 document 上派发且不冒泡（new Event 默认 bubbles:false），必须监听 document
  document.addEventListener('click', (e) => earlyNav.onEarlyClick(e));
  document.addEventListener('click', () => earlyNav.onDocClick());
  document.addEventListener('astro:before-swap', () => transition.captureOld());
  document.addEventListener('swup:content:replace', refreshAfterNavigation);
  initializeShell();

  // motion 懒加载：首屏不拉这个 54 KB 的共享块，等首帧画完再取。
  // 用户真正点击通常在几百毫秒之后，到那时动画引擎已就绪；
  // 万一还没就绪，animateLazy 会把元素直接落到终态，不会卡住。
  const warmMotion = (): void => void preloadMotion();
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmMotion, { timeout: 2000 });
  } else {
    globalThis.setTimeout(warmMotion, 200);
  }
})();
