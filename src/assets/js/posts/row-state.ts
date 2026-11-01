// row-state.ts — 文章区行（`.page-main`）的状态同步：行变体类、侧栏顶偏移、侧栏高亮
// 用法：const rowState = createRowState({ row, onLayoutChange })
//
// 三件事的共同点：都只读当前 DOM 的标记与实测尺寸、只写行上的类与内联变量，
// 不碰动画。切页后必须整体重跑一次（行是常驻壳，内容却是新的）。
import { detectPageKind } from '../util/page-kind';
import { activeCategoryOf, activeTagOf, postPathSegments } from '../../../lib/category';

export interface RowStateEnv {
  /** 当前文章区行（`.page-main`） */
  row: () => HTMLElement | null;
  /** 几何变化（锚高度 / 断点跨界）时的重测钩子：搜索浮层摆位由调用方负责 */
  onLayoutChange: () => void;
}

export interface RowState {
  syncVariant(): void;
  syncOffset(): void;
  syncActive(): void;
  observeAnchor(): void;
}

export function createRowState(env: RowStateEnv): RowState {
  let resizeObserver: ResizeObserver | null = null;

  /** ① 行变体：按内容标记推导（探测口径见 assets/js/util/page-kind.ts） */
  function syncVariant(): void {
    const r = env.row();
    if (!r) return;
    const main = r.querySelector<HTMLElement>('main#swup');
    const kind = main ? detectPageKind(main) : { detail: false, list: false };
    r.classList.toggle('page-main--post', kind.detail);
    r.classList.toggle('page-main--listing', kind.list);
    r.classList.toggle('page-main--plain', !kind.detail && !kind.list);
  }

  /** ② 侧栏顶偏移：锚（页头 / 面包屑条）高度 + 行上的 --posts-offset-gap */
  function syncOffset(): void {
    const r = env.row();
    if (!r) return;
    const anchor = r.querySelector<HTMLElement>('[data-posts-anchor]');
    if (!anchor) {
      r.style.removeProperty('--posts-side-offset');
      return;
    }
    const gap = parseFloat(getComputedStyle(r).getPropertyValue('--posts-offset-gap')) || 0;
    r.style.setProperty('--posts-side-offset', `${Math.round(anchor.offsetHeight + gap)}px`);
  }

  /** ③ 侧栏高亮态：当前分类（最长前缀命中 data-category）+ 当前标签 */
  function syncActive(): void {
    const sidebar = env.row()?.querySelector<HTMLElement>('.global-sidebar');
    if (!sidebar) return;

    const rest = postPathSegments(location.pathname);

    const items = Array.from(sidebar.querySelectorAll<HTMLElement>('.cat-item[data-category]'));
    const paths = new Set(items.map((el) => el.dataset.category ?? ''));
    const activeCategory = activeCategoryOf(rest, paths);

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
          // 打上「刚自动展开」的标记：category-tree 同步时据此把这一段从关播到开（与点箭头同一曲线）
          const wrap = node.querySelector<HTMLElement>(':scope > .cat-children-wrap');
          if (wrap) wrap.dataset.catOpenNew = '';
        }
        node = node.parentElement?.closest<HTMLElement>('.cat-node') ?? null;
      }
    }

    // 补上的开合类要立刻落实成窗口高度并补上展开动效：内联端点优先于 CSS，晚一步就是「箭头转了、内容不出来」
    window.__catTreeSync?.();

    // 标签页 /posts/tag/<tag>/：chip 只渲染真实标签，按文本匹配即可。
    // 必须"每次"都跑 toggle（含 activeTag 为空）：否则从标签页切走时旧 chip 的
    // chip--active 不会被摘掉，高亮残留到其他界面
    const activeTag = activeTagOf(rest);
    for (const chip of sidebar.querySelectorAll<HTMLElement>('.chip')) {
      chip.classList.toggle('chip--active', chip.textContent?.trim() === activeTag);
    }
  }

  /** 锚是每页元素，切页后重新观察（标题换行 / 窗口缩放都会改它的高度，占位位置跟着变） */
  function observeAnchor(): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    const anchor = env.row()?.querySelector<HTMLElement>('[data-posts-anchor]');
    if (!anchor) return;
    resizeObserver = new ResizeObserver(() => {
      syncOffset();
      env.onLayoutChange();
    });
    resizeObserver.observe(anchor);
  }

  // 断点跨界（768 / 1151）一次样式重算就翻转布局结构（页头行↔列、行 padding 82↔73、
  // 槽负边距全宽化），而 ResizeObserver 在布局**之后**才回调——中间存在占位已换位、
  // 浮层内联值还没重量的帧（断点跨界时搜索框「跳一下/宽度旧值闪一下」）。
  // MQL 的 change 回调在样式重算翻转的那一刻同步触发，此时重测与布局翻转同帧写入，
  // 消灭错位帧；RO 继续负责跨界后的连续缩放（标题换行 / 宽度变化）
  for (const mq of [
    window.matchMedia('(max-width: 768px)'),
    window.matchMedia('(min-width: 1151px)'),
  ]) {
    mq.addEventListener('change', () => {
      syncOffset();
      env.onLayoutChange();
    });
  }

  return { syncVariant, syncOffset, syncActive, observeAnchor };
}
