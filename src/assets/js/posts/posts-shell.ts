// posts-shell.ts — 文章区常驻壳（.page-main 行）的运行时控制器
// 用法：由 BaseLayout 引入：import "../assets/js/posts/posts-shell"
//
// 侧边栏与搜索框都在 #swup 之外、切页不重建，切页后要据此重跑一遍。具体实现在各分件：
// 左缘条常驻盒（.posts-edge-float）克隆换入 → posts/edge-float.ts
// 行变体类 / 侧栏顶偏移 / 侧栏高亮 → posts/row-state.ts
// 搜索浮层摆位与显隐落位 → posts/search-float.ts
// 转场仍标记 is-transition-still → 本文件（swup:visit:start 标、visit:end 摘）
// 本文件只做环境探测、motion 预取与接线。切页转场本身是 CSS（html 的
// is-leaving / is-rendering 类 + .transition-page，见 global.css「切页转场」），
// 无需 JS 编排；swup 换内容后这里落位壳（左缘克隆换入 + 搜索框到目标态）。
// category-tree 脚本按需懒加载（从非文章页进入文章区时），模块单例。
// 完整机制与取舍见 docs/reference/ARCHITECTURE.md 与 docs/reference/TROUBLESHOOTING.md。

import { createEdgeFloat } from './edge-float';
import { createEarlyNav } from './early-nav';
import { createRowState } from './row-state';
import { createSearchFloat, placeFloat } from './search-float';
import { preloadMotion } from '../util/motion';
import { isPostAreaPath, postPathSegments } from '../../../lib/category';

(() => {
  if (window.__postsShellInit) return;
  window.__postsShellInit = true;

  /* ---- 0. 常量与环境 ---- */

  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function row(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.page-main');
  }

  /* ---- 1. 行状态（变体类 / 侧栏偏移 / 侧栏高亮实现在 posts/row-state.ts） ---- */

  /** ④ 行级常驻搜索框的叠放位置：找出真实占位符，摆位交给 posts/search-float.ts
   *  （占位随标题换行 / 窗口变，跟着重测；转场途中容器的位移由 placeFloat 减掉，仍准）。
   *  占位不存在（文章页 / 普通页）时不动：浮动搜索已被行变体类隐藏。 */
  function syncSearchPos(): void {
    const r = row();
    const floatEl = r?.querySelector<HTMLElement>('.posts-search-float');
    const ph = r?.querySelector<HTMLElement>('.posts-header-search') ?? null;
    if (!r || !floatEl || !ph) return;
    placeFloat(r, ph, floatEl);
  }

  // 行变体 / 侧栏偏移 / 侧栏高亮 + 锚观察与断点跨界重测（几何一变就回调 onLayoutChange）
  const { syncVariant, syncOffset, syncActive, observeAnchor } = createRowState({
    row,
    onLayoutChange: syncSearchPos,
  });

  /* ---- 2. 搜索浮层控制（行级常驻单节点） ---- */
  // 摆位几何（placeFloat）与显隐落位都在 posts/search-float.ts
  const floatCtl = createSearchFloat({
    row,
  });

  /* ---- 3. 左缘条常驻盒（行级 .posts-edge-float，实现在 posts/edge-float.ts） ---- */
  const edgeFloat = createEdgeFloat({ row });

  /* ---- 4. 首屏早期导航与 fetch 失败兜底（实现在 posts/early-nav.ts） ---- */
  const earlyNav = createEarlyNav({ row, reduceMotion: REDUCE_MOTION, floatCtl });

  /* ---- 5. 事件与初始化 ---- */

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

  // 两个生命周期共用的同步步骤：按新内容重测行变体、左缘克隆、侧栏偏移与高亮
  function syncShellState(): void {
    syncVariant();
    edgeFloat.sync();
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

  // swup 切页：同步后把搜索框即时落位到目标态
  //（行变体类已翻完，CSS 的 visibility / pointer-events 已生效，settle 只钉 opacity）
  function refreshAfterNavigation(): void {
    syncShellState();
    const r = row();
    if (r) floatCtl.settle(!!r.querySelector('.posts-header-search'));
  }

  /* ---- 6. 转场仍标记（is-transition-still，动效见 global.css「切页转场」） ---- */
  // 本次切换中应原地站住的元素标 still，visit:end 一并摘除，生命周期与一次转场
  // 窗口对齐。visit:start 时行变体类还是源页的（翻变体在 content:replace），源页
  // 按变体判、目标页按 URL 判。标记真值表：
  //   源页在文章区 × 目标页在文章区 → 侧栏 + 左缘常驻盒（盒不位移，盒内车道按同一
  //     标记播原地模糊渐隐渐显）
  //   再叠加：源页是列表变体 × 目标页是列表页（isListingUrl）→ 搜索框也标（只有
  //     列表↔详情才隐显）
  //   其余组合不标：常驻元素随整块同曲线。转场块的词汇表由质检 check-transition
  //  焊死：新增「站住」的情况在这里加标记，不在 CSS 加一组选择器。
  function onVisitStart(e: Event): void {
    const r = row();
    if (!r) return;
    const detail = (e as CustomEvent).detail as { visit?: { to?: { url: string } } } | undefined;
    const targetUrl = detail?.visit?.to?.url ?? '';
    const fromInPosts =
      r.classList.contains('page-main--listing') || r.classList.contains('page-main--post');
    if (!fromInPosts || !isPostAreaPath(targetUrl)) return;
    const mark = (selector: string): void => {
      r.querySelector<HTMLElement>(selector)?.classList.add('is-transition-still');
    };
    mark('.global-sidebar');
    mark('.posts-edge-float');
    if (r.classList.contains('page-main--listing') && isListingUrl(targetUrl)) {
      mark('.posts-search-float');
    }
  }

  function onVisitEnd(): void {
    for (const el of document.querySelectorAll<HTMLElement>('.is-transition-still')) {
      el.classList.remove('is-transition-still');
    }
  }

  /** 目标 URL 是不是文章列表页（根 / 分类 / 标签）。visit:start 只有源页变体 + 目标 URL，
   *  单看 URL 形状分不出「分类页」和「同名路径下的文章页」，借常驻侧栏分类树取已知
   *  分类集判：整条路径（文章区之后各段）精确命中某分类路径才算列表页。
   *  不能用最长前缀 activeCategoryOf——文章 URL 前缀必命中所属分类，会被误判成列表页。
   *  分类目录名恒为小写连字符 ASCII（§7 硬约束），各段 join 直接比，无需解码。 */
  function isListingUrl(url: string): boolean {
    const segs = postPathSegments(url);
    if (segs.length === 0) return true;
    if (segs[0] === 'tag' && segs.length === 2) return true;
    const items = Array.from(
      document.querySelectorAll<HTMLElement>('.global-sidebar .cat-item[data-category]'),
    );
    return new Set(items.map((el) => el.dataset.category ?? '')).has(segs.join('/'));
  }

  // astro:* 事件由 @swup/astro 在 document 上派发且不冒泡（new Event 默认 bubbles:false），必须监听 document
  document.addEventListener('click', (e) => earlyNav.onEarlyClick(e));
  document.addEventListener('click', () => earlyNav.onDocClick());
  document.addEventListener('swup:content:replace', refreshAfterNavigation);
  // swup 自身的事件由 swup 在 document 上派发（bubbles: true）
  document.addEventListener('swup:visit:start', onVisitStart);
  document.addEventListener('swup:visit:end', onVisitEnd);
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
