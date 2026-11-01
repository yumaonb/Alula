// posts-shell.ts — 文章区常驻壳（.page-main 行）的运行时控制器
// 用法：由 BaseLayout 引入：import "../assets/js/posts/posts-shell"
//
// 侧边栏与搜索框都在 #swup 之外、切页不重建，每次切页后本文件负责：
// ① 行变体类（--plain / --listing / --post，驱动侧栏与搜索显隐、内容列收窄）；
// ② 侧栏顶偏移 --posts-side-offset（页锚高度 + 间隙）；
// ③ 侧栏高亮（当前分类路径补展开、当前标签高亮）；
// ④ 搜索浮层按页头占位符的行内坐标定位；
// ⑤ 文章区切页转场（motion 驱动：条带模糊交叉、搜索/目录退场配对、手机端整页推拉）。
// ①–③ 在 posts/row-state.ts，④ 的摆位与浮层状态机在 posts/search-float.ts，⑤ 在
// posts/transition.ts（过场件在 posts/strip.ts）；本文件只做环境探测、动画登记与接线。
//
// 转场只在文章区界面之间播放，跨区直接落位；所有动画延迟到下一个出帧的 rAF 起播，
// 避免主线程繁忙时墙钟空转、动画直接跳到终帧。
// category-tree 脚本按需懒加载（从非文章页进入文章区时），模块单例。
// 完整机制与取舍见 .dsh/docs/ARCHITECTURE.md 与 .dsh/docs/TROUBLESHOOTING.md 第 51–53 条。
import type { AnimationPlaybackControls } from 'motion';

import { createEarlyNav } from './early-nav';
import { createRowState } from './row-state';
import { createSearchFloat, placeFloat } from './search-float';
import { createStrip } from './strip';
import { createTransition } from './transition';

(() => {
  if (window.__postsShellInit) return;
  window.__postsShellInit = true;

  /* ---- 0. 常量与环境 ---- */

  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  // 目录滑动只在电脑端显示目录（≥851px；更窄目录是按钮+抽屉，只走普通渐隐）
  const tocSlideGate = () => !REDUCE_MOTION && window.matchMedia('(min-width: 851px)').matches;

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
    const ph = phs.find((el) => !el.closest('.posts-edge-clone')) ?? null;
    // 退场/入场动画期间浮层钉在视口（内联 top/left 是视口坐标）：此刻写行相对值
    // 会把浮层瞬移；unpin 后下一轮重测自然补齐
    if (floatEl?.style.position === 'fixed') return;
    if (!r || !floatEl || !ph) return;
    placeFloat(r, ph, floatEl);
  }

  // 行变体 / 侧栏偏移 / 侧栏高亮 + 锚观察与断点跨界重测（几何一变就回调 onLayoutChange）
  const { syncVariant, syncOffset, syncActive, observeAnchor } = createRowState({
    row,
    onLayoutChange: syncSearchPos,
  });

  /* ---- 3. 克隆与目录入场（实现在 posts/strip.ts） ---- */
  const strip = createStrip({
    row,
    track,
    reduceMotion: REDUCE_MOTION,
    tocSlideGate,
  });

  /* ---- 4. 搜索浮层控制（行级常驻单节点） ---- */
  // 摆位几何（placeFloat）与出入场状态机都在 posts/search-float.ts；这里只接上本文件的
  // 动画登记与环境，行为与拆分前一致
  const floatCtl = createSearchFloat({
    row,
    track: trackFloat,
    stopAnims: stopFloatAnims,
    isMobile,
    reduceMotion: REDUCE_MOTION,
  });

  /* ---- 5. 首屏早期导航与 fetch 失败兜底（实现在 posts/early-nav.ts） ---- */
  const earlyNav = createEarlyNav({ row, reduceMotion: REDUCE_MOTION, isMobile, floatCtl });

  /* ---- 6. 转场编排（实现在 posts/transition.ts） ---- */
  const transition = createTransition({
    row,
    strip,
    floatCtl,
    track,
    stopAnims,
    isMobile,
    reduceMotion: REDUCE_MOTION,
    tocSlideGate,
    cancelEarlyNav: () => earlyNav.cancel(),
  });

  /* ---- 7. 事件与初始化 ---- */

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
      transition.playTransition();
    } else {
      // 首屏：搜索钉到变体目标态（在首次绘制前，无闪）
      const r = row();
      if (r) floatCtl.settle(r.classList.contains('page-main--listing'));
    }
  }

  // astro:* 事件由 @swup/astro 在 document 上派发且不冒泡（new Event 默认 bubbles:false），必须监听 document
  document.addEventListener('click', (e) => earlyNav.onEarlyClick(e));
  document.addEventListener('click', () => earlyNav.onDocClick());
  document.addEventListener('astro:before-swap', () => transition.captureOld());
  document.addEventListener('astro:after-swap', () => onReady(true));
  onReady();
})();

// 标记为模块：文件顶层有 import，TS 模块检查要求显式模块语义
export {};
