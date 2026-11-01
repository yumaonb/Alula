// category-tree.ts — 分类树开合交互：点箭头切换、量真实内容高度驱动展开动画
// 用法：由 posts-shell.ts 懒加载：import("./category-tree")（文章区页面才加载，模块单例）
//
// 树在 #swup 外的常驻侧栏里、切页不重建，监听仍全挂 document（事件委托 + 幂等守卫），
// 模块加载一次后长期存活。
// 每个节点的窗口高度 --cat-sub-h 由这里量出（与后台侧栏 admin/shell.ts 同一套）：
// 外层 .cat-children-wrap 是 max-height 窗口，内层 .cat-children 是平移的刚体，
// 两者同一条曲线同步进行，子项任何一帧都不被压缩。
// 开合动效由 motion 驱动：CSS 只定义开/关端点状态，窗口与刚体从「飞行中读数」
// 走到端点；本层内容高度不变、变的是上方每层窗口的容纳总高，按 ±本层实高增量
// 更新各祖先的 --cat-sub-h，中途再点上限也保持准确，不用等动画结束再量。
import { animate } from 'motion';

import { cssNum, readTranslate } from '../util/dom';

(() => {
  if (window.__postCatTreeBound) return;
  window.__postCatTreeBound = true;

  // 开合时长（ms）；开合后的窗口期内不重测，避免量到半程高度
  const ANIM_MS = 340;
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

  /** 内层刚体当前的纵向位移（动画进行中时是插值，即此刻在屏幕上的真实位置） */
  function currentY(el: HTMLElement): number {
    return readTranslate(el).y;
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

  /** 全量同步：从最里层往外把每个窗口的实高写进 --cat-sub-h，并按当前开合类把端点高度
   *  落实成内联值（open = 实高、closed = 0）。
   *
   *  为什么必须写内联：motion 的开合动画把 max-height / transform 落在元素内联上，而内联
   *  优先级高于 `.cat-node--open > .cat-children-wrap` 那条端点规则——切页后由
   *  `syncActive()` 补上的自动展开会被「上一轮动画的落点」压住（箭头转了、内容不出来）。
   *  反过来只写内联不同步、或只同步 --cat-sub-h 不写内联，缩放后又会裁掉内容。
   *
   *  最里层先量：内层窗口定到实高后，外层量到的才是含已展开子项的完整高度 */
  function syncSizes(root: HTMLElement): void {
    const wraps = Array.from(root.querySelectorAll<HTMLElement>('.cat-children-wrap'));
    wraps.sort((a, b) => wrapDepth(b) - wrapDepth(a));
    for (const wrap of wraps) {
      // 隐藏态量到 0（手机端抽屉未展开、文章页窄屏侧栏 display:none）：不写——上限归零后
      // 再显示就是「箭头转了、内容不出来」，等可见时 ResizeObserver 重跑本函数
      const h = contentHeight(wrap);
      if (h <= 0) continue;
      setWrapHeight(wrap, h);
      const open = !!wrap.parentElement?.classList.contains('cat-node--open');
      wrap.style.maxHeight = open ? `${h}px` : '0px';
      wrap.querySelector<HTMLElement>(':scope > .cat-children')?.style.removeProperty('transform');
    }
  }

  /** 同步整棵树：先按当前开合类落实端点高度，再把「本轮刚被自动展开」的节点从关播到开。
   *
   *  before / after 两拍：内联端点一写，上一轮的落点就没了——所以量之前先把每个窗口的当前
   *  高度记下来，syncSizes 写完最终值后，把参与动画的窗口退回起点再播。
   *  曲线、时长与点箭头展开完全同一套，两条路走起来是同一个观感。 */
  function syncTree(root: HTMLElement): void {
    const flagged = Array.from(
      root.querySelectorAll<HTMLElement>('.cat-children-wrap[data-cat-open-new]'),
    );
    // 减动效 / 首屏高度还没量完：直接落位（与点箭头的 instant 口径一致）
    const instant = REDUCE_MOTION || root.hasAttribute('data-cat-init');
    const before = new Map<HTMLElement, number>();
    if (flagged.length && !instant) {
      for (const wrap of root.querySelectorAll<HTMLElement>('.cat-children-wrap')) {
        before.set(wrap, cssNum(wrap, 'max-height'));
      }
    }
    syncSizes(root);
    if (instant) {
      for (const wrap of flagged) delete wrap.dataset.catOpenNew;
      return;
    }
    // 容器不可见（手机端抽屉没开、窄屏文章页侧栏 display:none）时量不到高度：标记留着，
    // 等容器可见时 ResizeObserver 再进来补播
    const playing = flagged.filter((wrap) => contentHeight(wrap) > 0);
    if (!playing.length) return;
    // 上一段开合还在飞：直接落位，不与它抢同一批属性
    if (performance.now() - lastToggleAt < ANIM_MS) {
      for (const wrap of playing) delete wrap.dataset.catOpenNew;
      return;
    }
    lastToggleAt = performance.now();
    const duration = ANIM_MS / 1000;
    for (const wrap of playing) {
      delete wrap.dataset.catOpenNew;
      const h = contentHeight(wrap);
      const children = wrap.querySelector<HTMLElement>(':scope > .cat-children');
      // 起点与点箭头的「关」端一致：窗口收成 0、内层刚体上移一整段
      wrap.style.maxHeight = '0px';
      if (children) children.style.transform = `translateY(-${h}px)`;
      animate(wrap, { maxHeight: [0, h] }, { ...RM, duration, ease: EASE });
      if (children) animate(children, { y: [-h, 0] }, { ...RM, duration, ease: EASE });
    }
    // 祖先窗口从展开前的高度长到新高度：同一条曲线、同一个时长，外窗容量恒大于内层要露出的部分
    for (const [wrap, from] of before) {
      if (playing.includes(wrap)) continue;
      const to = cssNum(wrap, 'max-height');
      if (Math.abs(to - from) < 1) continue;
      wrap.style.maxHeight = `${from}px`;
      animate(wrap, { maxHeight: [from, to] }, { ...RM, duration, ease: EASE });
    }
  }

  /** 内容就绪（首屏 / swup 换页）后同步整棵树并放开首帧锁；data-cat-init 在位期间开合不播动画（直接落位） */
  function syncHeights(): void {
    const root = treeRoot();
    if (!root) return;
    syncTree(root);
    requestAnimationFrame(() => root.removeAttribute('data-cat-init'));
    observeRoot(root);
  }

  // 供 posts-shell 侧（row-state.ts 的 syncActive）在补完自动展开的类之后立即同步：
  // 内联端点优先于 CSS，晚一步同步就等于「箭头转了、内容不出来」；同时由这里把展开动效补上
  window.__catTreeSync = (): void => {
    const root = treeRoot();
    if (root) syncTree(root);
  };

  // 树容器尺寸变化（手机端筛选抽屉移入移出、跨 768px 断点显隐、展开后整体变高）时实高会变，同步一遍
  let resizeObserver: ResizeObserver | null = null;
  function observeRoot(root: HTMLElement): void {
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver((entries) => {
      if (!entries.some((entry) => entry.contentRect.height > 0)) return;
      if (performance.now() - lastToggleAt < ANIM_MS) return;
      syncTree(root);
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

  // 换页后的同步由 posts-shell 的 syncActive() → __catTreeSync() 单点驱动（本模块只被它懒加载）。
  // 这里再挂一个 astro:after-swap 会让同一次换页同步两遍：第二遍在本任务里把自动展开动画的
  // 起点直接改写成终值，浏览器先画出一帧「已全展开」再从头播，看着就是闪一下
  syncHeights();
})();
