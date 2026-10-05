// category-tree.ts — 分类树开合交互：点箭头切换、量真实内容高度驱动展开动画
// 用法：由 PostCategoryTree 引入：import "../../assets/js/category-tree"
//
// 树在 #swup 内，切页整块重建，所以监听全挂 document（事件委托 + 幂等守卫）。
// 每个节点的窗口高度 --cat-sub-h 由这里量出（与后台侧栏 admin/shell.ts 同一套）：
// 外层 .cat-children-wrap 是 max-height 窗口，内层 .cat-children 是平移的刚体，
// 两者同一条曲线同步进行，子项任何一帧都不被压缩。
// 开合动效由 motion 驱动：CSS 只定义开/关端点状态，窗口与刚体从「飞行中读数」
// 走到端点；本层内容高度不变、变的是上方每层窗口的容纳总高，按 ±本层实高增量
// 更新各祖先的 --cat-sub-h，中途再点上限也保持准确，不用等动画结束再量。
import { animate } from 'motion';

(() => {
  if (window.__postCatTreeBound) return;
  window.__postCatTreeBound = true;

  const ANIM_MS = 340; // 开合时长（ms）；开合后的窗口期内不重测，避免量到半程高度
  const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RM = { reduceMotion: REDUCE_MOTION };
  let lastToggleAt = 0;

  function treeRoot(): HTMLElement | null {
    return document.getElementById('category-tree');
  }

  /**
   * 窗口内容实高：量内层 ul 自身高度——恒等于内容天然高度，
   * 不受外层窗口 max-height 裁切影响，随时量都准。
   */
  function contentHeight(wrap: HTMLElement): number {
    const list = wrap.querySelector<HTMLElement>(':scope > .cat-children');
    return list ? list.offsetHeight : 0;
  }

  function setWrapHeight(wrap: HTMLElement, h: number): void {
    const value = Math.max(0, Math.round(h));
    wrap.dataset.subH = String(value);
    wrap.style.setProperty('--cat-sub-h', `${value}px`);
  }

  function currentWrapHeight(wrap: HTMLElement): number {
    const value = Number(wrap.dataset.subH || 0);
    return Number.isFinite(value) ? value : 0;
  }

  /** 当前生效值（含动画进行中 / 已提交的值），作为下一段动画的起点 */
  function cssNum(el: HTMLElement, prop: string): number {
    return parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
  }

  /** 内层刚体当前的纵向位移（动画进行中时是插值，即此刻在屏幕上的真实位置） */
  function currentY(el: HTMLElement): number {
    const t = getComputedStyle(el).transform;
    if (t === 'none') return 0;
    const m = t.match(/matrix\(([^)]+)\)/);
    return m ? parseFloat(m[1].split(',')[5]) || 0 : 0;
  }

  /** 窗口所属节点的嵌套深度，供重测时从最里层开始排序 */
  function wrapDepth(wrap: HTMLElement): number {
    let depth = 0;
    let li = wrap.closest<HTMLElement>('.cat-node');
    while (li) {
      depth += 1;
      li = li.parentElement?.closest<HTMLElement>('.cat-node') ?? null;
    }
    return depth;
  }

  /** 全量重测：最里层先量——内层窗口定到实高后，外层量到的才是完整内容高度 */
  function measureAll(root: HTMLElement): void {
    const wraps = Array.from(root.querySelectorAll<HTMLElement>('.cat-children-wrap'));
    wraps.sort((a, b) => wrapDepth(b) - wrapDepth(a));
    for (const wrap of wraps) setWrapHeight(wrap, contentHeight(wrap));
  }

  /** 内容就绪（首屏 / swup 换页）后量高度并放开首帧锁；data-cat-init 在位期间开合不播动画（直接落位） */
  function syncHeights(): void {
    const root = treeRoot();
    if (!root) return;
    measureAll(root);
    requestAnimationFrame(() => root.removeAttribute('data-cat-init'));
    observeRoot(root);
  }

  // 树容器尺寸变化（手机端筛选抽屉移入移出、跨 768px 断点显隐）时实高会变，重测一遍
  let resizeObserver: ResizeObserver | null = null;
  function observeRoot(root: HTMLElement): void {
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver((entries) => {
      if (!entries.some((entry) => entry.contentRect.height > 0)) return;
      if (performance.now() - lastToggleAt < ANIM_MS) return;
      measureAll(root);
    });
    resizeObserver.observe(root);
  }

  // 点击右侧展开按钮切换子分类，不影响分类名链接的导航
  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as Element | null;
    const btn = target?.closest ? target.closest('button.cat-toggle') : null;
    if (!btn || !document.contains(btn)) return;
    const node = btn.closest<HTMLElement>('.cat-node');
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();

    lastToggleAt = performance.now();
    const open = !node.classList.contains('cat-node--open');

    const wrap = node.querySelector<HTMLElement>(':scope > .cat-children-wrap');
    const delta = wrap ? contentHeight(wrap) : 0;
    const fromHeight = wrap ? cssNum(wrap, 'max-height') : 0;
    const children = wrap ? wrap.querySelector<HTMLElement>(':scope > .cat-children') : null;
    const fromY = children ? currentY(children) : 0;

    // 本层内容高度不变，变的是上方每一层窗口要容纳的总高：按 ±本层实高增减各祖先的
    // --cat-sub-h。先读飞行中值、再翻类改上限：翻类后 computed 会变成端点值，
    // 飞行中的位置就丢了；中途再点上限也保持准确，不用等动画结束再量
    const ancestors: Array<{ wrap: HTMLElement; from: number; to: number }> = [];
    let parent = node.parentElement;
    while (parent) {
      const parentWrap = parent.querySelector<HTMLElement>(':scope > .cat-children-wrap');
      if (parentWrap) {
        const to = currentWrapHeight(parentWrap) + (open ? delta : -delta);
        ancestors.push({ wrap: parentWrap, from: cssNum(parentWrap, 'max-height'), to });
        setWrapHeight(parentWrap, to);
      }
      parent = parent.parentElement;
    }

    node.classList.toggle('cat-node--open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');

    // 首屏（高度未量完，data-cat-init 在位）直接落位，不按兜底高度播半程
    const instant = !!treeRoot()?.hasAttribute('data-cat-init');
    const duration = instant ? 0 : ANIM_MS / 1000;
    if (wrap) {
      animate(wrap, { maxHeight: [fromHeight, open ? delta : 0] }, { ...RM, duration, ease: EASE });
    }
    if (children) {
      animate(children, { y: [fromY, open ? 0 : -delta] }, { ...RM, duration, ease: EASE });
    }
    for (const { wrap: ancestorWrap, from, to } of ancestors) {
      animate(ancestorWrap, { maxHeight: [from, to] }, { ...RM, duration, ease: EASE });
    }
  });

  document.addEventListener('astro:after-swap', syncHeights);
  syncHeights();
})();
