// category-tree.ts — 分类树开合交互：点箭头切换、量真实内容高度驱动展开动画
// 用法：由 PostCategoryTree 引入：import "../../assets/js/category-tree"
//
// 树在 #swup 内，切页整块重建，所以监听全挂 document（事件委托 + 幂等守卫）。
// 每个节点的窗口高度 --cat-sub-h 由这里量出（与后台侧栏 admin/shell.ts 同一套）：
// 外层 .cat-children-wrap 是 max-height 窗口，内层 .cat-children 是平移的刚体，
// 两者同一条 0.34s 曲线同步进行，子项任何一帧都不被压缩。
(() => {
  if (window.__postCatTreeBound) return;
  window.__postCatTreeBound = true;

  const ANIM_MS = 340; // 与 PostCategoryNode 样式里的开合时长一致；开合后的窗口期内不重测，避免量到半程高度
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

  /** 锁动画重测：先锁再量、下一帧放开，避免窗口按旧上限播一半再跳 */
  function measureAllLocked(root: HTMLElement): void {
    root.classList.add('cat-measuring');
    measureAll(root);
    requestAnimationFrame(() => root.classList.remove('cat-measuring'));
  }

  /** 内容就绪（首屏 / swup 换页）后量高度并放开首帧锁；data-cat-init 在位期间 transition 全关 */
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
      measureAllLocked(root);
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
    node.classList.toggle('cat-node--open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');

    // 本层内容高度不变，变的是上方每一层窗口要容纳的总高。
    // 直接按 ±本层实高增减各祖先的 --cat-sub-h：窗口与内容走同一条曲线同步开合，
    // 中途再点上限也保持准确，不用等动画结束再量
    const wrap = node.querySelector<HTMLElement>(':scope > .cat-children-wrap');
    const delta = wrap ? contentHeight(wrap) : 0;
    let parent = node.parentElement;
    while (parent) {
      const parentWrap = parent.querySelector<HTMLElement>(':scope > .cat-children-wrap');
      if (parentWrap) {
        setWrapHeight(parentWrap, currentWrapHeight(parentWrap) + (open ? delta : -delta));
      }
      parent = parent.parentElement;
    }
  });

  document.addEventListener('astro:after-swap', syncHeights);
  syncHeights();
})();
