// toc.ts — 文章目录：活动高亮、指示竖线、点击平滑滚动、目录自身滚动隔离
// 用法：由 TableOfContents.astro 引入：import "../../assets/js/toc"
// 检测：IntersectionObserver + 段标记。每个目录条目在正文里放一个不可见的
// 1px 宽绝对定位 div，覆盖「本标题 → 下一标题」的整段区域（最后一条到文档
// 末尾）；区域无缝铺满全文，判定线恒在恰好一个区域内。浏览器用 rootMargin
// 把视口缩成中心在 navOffset + 4 的 2px 判定线带，活动项 = 与带相交的段
// 标记。**按段（而非标题盒）是正确性的关键**：快速滑动一帧能跳过多个标题
// 盒（盒不相交状态 false→false、浏览器不通知，高亮会滞后数项），而线落入
// 的段必然 false→true，必被通知，高亮不会滞后（见 TROUBLESHOOTING #30 ④）。
// 回调候选再按标题实时几何步行校正（前向/后向各走到与判定线一致，覆盖段位
// 置暂过期偏差数项的情形；线在首标题之上 → 首项；每回调仅少数几步、静止零
// 开销）。
// 标记位置按标题位缓存显式写入（top/height），布局平移（图片加载/字体）时
// 由 rAF 重测 + 哨兵（活动项标题单元素 rect 校验缓存，偏差 > 2px 重测）保
// 持新鲜；单元素读取（非 × N），纯滚动不改样式、不强制布局。
// 共用过渡：竖线内容与轨道滚动用**同一条进度 p**（0→1、easeOut）推进。
// 列表静止且居中可达时，(竖线位移) == (轨道位移) → 竖线视觉位数学上恒在
// 视口中心：列表流动、中间部分固定（「划过去」感）；中途重定向从当前值
// 续接，竖线视觉位只朝中心单调收敛，无先掉后回的反向抵消、无「旧目标先
// 写回再矫正」的竞态（每帧唯一写入者，无离散 tween）。
// 轨道只在切项 / 首次落位 / 重测重定向时动；手动滚轮关闭跟随（滑走不拉
// 回），下一次切项恢复居中；点击窗口内轨道不动（不抢页面平滑滚动，竖线仍
// 跟高亮）；仅「首次落位」（深链进入 / 切页后）且距离 > SNAP_MAX_PX 才是
// 状态矫正、瞬移就位。
// 帧循环：单 rAF、滚动驱动（哨兵与过渡同通道）、收敛后自动停摆（静止零开
// 销）。竖线位移走 translateY（合成器通道）而非 top（布局通道）。
(() => {
  if (window.__tocInit) return;
  window.__tocInit = true;

  const NAV_HEIGHT = 80;
  const MARK_CLASS = 'toc-io-mark'; // 段标记（toc.ts 创建/销毁的不可见元素）
  let isClickMode = false;
  // 大距离阈值：只用于「首次落位」——状态矫正（深链进入 / 切页后），瞬移就位
  const SNAP_MAX_PX = 120;
  // 点击窗口：期间轨道不动（不抢页面平滑滚动），窗口后由下一次切项矫正
  const CLICK_WINDOW_MS = 800;

  function getNavOffset(): number {
    const nav = document.querySelector<HTMLElement>('.navbar');
    return nav ? nav.offsetHeight + 12 : NAV_HEIGHT;
  }

  function smoothScrollTo(target: HTMLElement): void {
    const top = target.getBoundingClientRect().top + window.scrollY - getNavOffset();
    if (Math.abs(top - window.scrollY) < 1) return;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  // ---- 缓存：标题文档绝对位 + 目录项 offsetTop/height。页面滚动不改变它
  // 们；只在 init / 重测时重建（重测频率低：init / 切页 / 图片 / 字体 /
  // resize / 哨兵命中）。 ----
  let slugs: string[] = [];
  let headingTops: number[] = [];
  let itemTops: number[] = [];
  let itemHeights: number[] = [];
  let navOffset = NAV_HEIGHT;

  function measure(): void {
    const items = document.querySelectorAll('.toc-item');
    slugs = [];
    headingTops = [];
    itemTops = [];
    itemHeights = [];
    if (items.length === 0) return;
    const sy = window.scrollY;
    items.forEach((item) => {
      const slug = item.getAttribute('data-target');
      if (!slug) return;
      const h = document.getElementById(slug);
      const link = item.querySelector<HTMLElement>('.toc-link');
      if (!h || !link) return;
      slugs.push(slug);
      headingTops.push(h.getBoundingClientRect().top + sy);
      itemTops.push(link.offsetTop);
      itemHeights.push(link.offsetHeight);
    });
    navOffset = getNavOffset();
  }

  /** 让活动项居中于目录视口的目标 scrollTop（夹在可滚范围内） */
  function centerScrollFor(idx: number, trackEl: HTMLElement): number {
    const maxScroll = trackEl.scrollHeight - trackEl.clientHeight;
    const desired = itemTops[idx] - trackEl.clientHeight / 2 + itemHeights[idx] / 2;
    return Math.max(0, Math.min(desired, maxScroll));
  }

  // ---- 共用过渡：单进度 p 同时驱动竖线内容与轨道滚动 ----
  let p = 1; // 过渡进度（1 = 完成）
  let dur = 0.12; // 过渡时长（s，按位移成比例）
  let barFrom = 0;
  let barTo = 0;
  let trackFrom = 0;
  let trackTo = 0;
  let lastT = 0; // 上一帧时间戳
  let barPos = 0; // 竖线当前内容位
  let barPlaced = false; // 竖线是否完成首次落位
  let trackPlaced = false; // 轨道是否完成首次落位
  let trackFollow = true; // 轨道居中是否生效（手动滚轮关闭，切项恢复）
  let lastActiveIdx = -1;
  let rafId = 0;

  // 先快后缓（≈ easeOutQuart）：切项时列表快速起滑、轻柔落位
  const EASE_OUT = (t: number): number => 1 - Math.pow(1 - t, 4);

  /**
   * 重定向共用过渡（从当前位置续接）：trackEl 为 null 时只动竖线通道
   * （点击窗口内轨道不动）。首落且大距离 = 状态矫正，瞬移。
   */
  function retarget(idx: number, trackEl: HTMLElement | null): void {
    barFrom = barPos;
    barTo = itemTops[idx];
    let dist = Math.abs(barTo - barFrom);
    if (trackEl) {
      trackFrom = trackEl.scrollTop;
      trackTo = centerScrollFor(idx, trackEl);
      dist = Math.max(dist, Math.abs(trackTo - trackFrom));
    }
    if ((!barPlaced || !trackPlaced) && dist > SNAP_MAX_PX) {
      // 状态矫正：仅首次落位且距离大（深链进入 / 切页后）——立刻对齐
      barPos = barTo;
      if (trackEl) trackEl.scrollTop = trackTo;
      p = 1;
      return;
    }
    if (dist < 0.5) {
      p = 1; // 已在位，无过渡
      return;
    }
    dur = Math.min(0.35, Math.max(0.12, 0.1 + dist * 0.0006));
    p = 0;
    lastT = performance.now();
  }

  /** 切项：高亮类 + 竖线高度 + 共用过渡重定向 */
  function activate(idx: number): void {
    if (idx === lastActiveIdx) return;
    document.querySelectorAll('.toc-item').forEach((item, i) => {
      item.classList.toggle('active', i === idx);
    });
    const bar = document.getElementById('toc-bar');
    if (bar) bar.style.height = `${itemHeights[idx]}px`;
    // 切项是显式意图：恢复轨道居中（含手动滑走后的下次切项矫正；
    // 点击窗口内不恢复——页面平滑滚动进行中，轨道不动）
    if (!isClickMode) trackFollow = true;
    retarget(idx, trackFollow ? document.getElementById('toc-list') : null);
    lastActiveIdx = idx;
    ensureLoop();
  }

  // ---- 段标记 + IntersectionObserver（检测层） ----
  let marks: (HTMLElement | null)[] = [];
  let markOf = new WeakMap<Element, number>();
  let io: IntersectionObserver | null = null;

  /**
   * 为每个标题建一段标记：正文容器内 1px 宽、透明、绝对定位的 div，覆盖
   * 「本标题 → 下一标题」（最后一段到文档末尾），无缝铺满。标记位置按标题
   * 位缓存显式写入；布局平移后由重测 + 哨兵重算。
   */
  function layoutMarks(): void {
    const container = document.querySelector<HTMLElement>('.markdown-body');
    document.querySelectorAll('.' + MARK_CLASS).forEach((m) => m.remove());
    marks = [];
    if (!container || slugs.length === 0) {
      io?.disconnect();
      io = null;
      return;
    }
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative'; // 段标记绝对定位的锚
    }
    // 容器 padding-box 原点（文档绝对位）：标记的 top 相对 padding-box
    const cTop = container.getBoundingClientRect().top + window.scrollY - container.clientTop;
    const docEnd = document.documentElement.scrollHeight;
    for (let i = 0; i < slugs.length; i++) {
      const h = document.getElementById(slugs[i]);
      if (!h || !container.contains(h)) {
        marks.push(null);
        continue;
      }
      const m = document.createElement('div');
      m.className = MARK_CLASS;
      const top = headingTops[i] - cTop;
      const end = i + 1 < slugs.length ? headingTops[i + 1] : docEnd;
      m.style.cssText =
        'position:absolute;width:1px;top:' +
        top.toFixed(2) +
        'px;height:' +
        Math.max(2, end - headingTops[i]).toFixed(2) +
        'px;background:transparent;pointer-events:none;';
      container.appendChild(m);
      marks.push(m);
    }
    setupObserver();
  }

  /**
   * 观察器：视口缩成判定线带（中心 navOffset + 4、高 2px）。活动项 = 与带
   * 相交的段标记；区域无缝铺满全文，线落入的段必然从不相交变为相交（快速
   * 滑动跨越多标题也必被通知），高亮不会滞后数项。兜底：无相交条目（线处
   * 于段尾过期空隙）→ 取刚退出且 top ≤ 线的段（必为上一段）。
   */
  function setupObserver(): void {
    io?.disconnect();
    markOf = new WeakMap();
    const targets: Element[] = [];
    marks.forEach((m, i) => {
      if (m) {
        markOf.set(m, i);
        targets.push(m);
      }
    });
    if (targets.length === 0) {
      io = null;
      return;
    }
    const bandTop = navOffset + 3;
    const bandBottom = Math.max(1, window.innerHeight - navOffset - 5);
    const observer = new IntersectionObserver(
      (entries) => {
        const ly = navOffset + 4;
        let hitIdx = -1;
        let hitTop = -Infinity;
        let fallIdx = -1;
        let fallTop = -Infinity;
        for (const e of entries) {
          const idx = markOf.get(e.target);
          if (idx === undefined) continue;
          const top = e.boundingClientRect.top; // 视口坐标，实时几何
          if (e.isIntersecting) {
            if (top >= hitTop) {
              hitTop = top;
              hitIdx = idx;
            }
          } else if (top <= ly && top >= fallTop) {
            fallTop = top;
            fallIdx = idx;
          }
        }
        const idx0 = hitIdx >= 0 ? hitIdx : fallIdx;
        // 线在首标题之上（引言区 / 页首）→ 首项（与旧版语义一致）
        let idx = idx0 >= 0 ? idx0 : 0;
        // 步行校正：快速甩动跨段、或段位置暂过期（布局平移未及重测）时候选
        // 可能偏差数项——按标题实时几何前向补「向下跳过」、后向补「向上跳
        // 过」（步数 ∝ 偏差，仅回调时发生，静止零开销）；缺失标题即停
        for (;;) {
          const nextIdx = idx + 1;
          if (nextIdx >= slugs.length) break;
          const h = document.getElementById(slugs[nextIdx]);
          if (!h) break;
          if (h.getBoundingClientRect().top <= ly) idx = nextIdx;
          else break;
        }
        for (;;) {
          const h = document.getElementById(slugs[idx]);
          if (!h) break;
          if (h.getBoundingClientRect().top > ly) idx = Math.max(0, idx - 1);
          else break;
        }
        activate(idx);
      },
      { root: null, rootMargin: `-${bandTop}px 0px -${bandBottom}px 0px`, threshold: 0 },
    );
    io = observer;
    targets.forEach((t) => observer.observe(t));
  }

  // ---- 布局平移重测：图片 load/error（捕获阶段）、字体 ready、resize 都
  // 会平移标题、打穿标记的显式位置；重测放 rAF（等布局落定），重测 + 重写
  // 标记 + 重定向一次共用过渡（目录几何若变化则顺势修正，否则空操作） ----
  let remeasurePending = false;
  function requestRemeasure(): void {
    if (remeasurePending) return;
    remeasurePending = true;
    requestAnimationFrame(() => {
      remeasurePending = false;
      measure();
      layoutMarks();
      if (lastActiveIdx >= 0 && lastActiveIdx < slugs.length) {
        retarget(lastActiveIdx, trackFollow ? document.getElementById('toc-list') : null);
      }
      ensureLoop();
    });
  }

  function onContentMediaEvent(e: Event): void {
    const t = e.target as Element | null;
    if (t && t.tagName === 'IMG' && t.closest('.markdown-body')) requestRemeasure();
  }
  document.addEventListener('load', onContentMediaEvent, true);
  document.addEventListener('error', onContentMediaEvent, true);
  document.fonts?.ready.then(requestRemeasure).catch(() => {});
  window.addEventListener('resize', requestRemeasure, { passive: true });

  // ---- 单帧推进：哨兵（保标记位置新鲜）→ 共用过渡推进。检测本身由 IO 事
  // 件驱动，此循环只在滚动时跑（哨兵需要逐帧看），静止且过渡收敛后停摆。 ----
  function frame(now: number): boolean {
    if (slugs.length === 0) return false;

    // 哨兵：当前活动项标题的实际文档位 vs 缓存，偏差 > 2px = 内容发生布局
    // 平移（事件未覆盖的图片/公式等），标记的显式位置已过期——先重测 + 重写
    // 标记再继续。单元素读取（非 × N），滚动本身不改样式，不逐帧强制布局。
    if (lastActiveIdx >= 0 && lastActiveIdx < slugs.length) {
      const h = document.getElementById(slugs[lastActiveIdx]);
      if (h) {
        const actual = h.getBoundingClientRect().top + window.scrollY;
        if (Math.abs(actual - headingTops[lastActiveIdx]) > 2) {
          measure();
          layoutMarks();
        }
      }
    }

    // 推进共用过渡：同一条 p 驱动竖线内容与轨道滚动——静止居中时两条位移
    // 相等，竖线视觉位恒在中心（中间固定）；轨道关闭跟随时只推进竖线通道
    if (p < 1) {
      const dt = Math.min(64, Math.max(1, now - lastT));
      lastT = now;
      p = Math.min(1, p + dt / (dur * 1000));
      const v = EASE_OUT(p);
      barPos = barFrom + (barTo - barFrom) * v;
      const bar = document.getElementById('toc-bar');
      if (bar) bar.style.transform = `translateY(${barPos}px)`;
      const trackEl = document.getElementById('toc-list');
      if (trackEl && trackFollow) trackEl.scrollTop = trackFrom + (trackTo - trackFrom) * v;
      if (p >= 1) {
        barPlaced = true;
        trackPlaced = true;
      }
    }
    return p < 1;
  }

  function ensureLoop(): void {
    if (rafId) return;
    const tick = (): void => {
      rafId = 0;
      const now = performance.now();
      if (frame(now)) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  // ---- 点击：页面平滑滚动 + 800ms 窗口（窗口内轨道不动）----
  document.addEventListener('click', (e: MouseEvent) => {
    const link = e.target instanceof Element ? e.target.closest('.toc-link') : null;
    if (!link) return;
    e.preventDefault();
    const item = link.closest('.toc-item');
    if (!item) return;
    const id = item.getAttribute('data-target');
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    isClickMode = true;
    trackFollow = false; // 窗口内轨道不居中，不抢页面平滑滚动
    smoothScrollTo(el);
    setTimeout(() => {
      isClickMode = false;
    }, CLICK_WINDOW_MS);
  });

  window.addEventListener('scroll', ensureLoop, { passive: true });

  // 目录内容自身滚动（滚轮 / 触摸）：只接管滚动行为，活动项由页面滚动决定，
  // 目录滚轮不改变它。手动滚轮 = 显式意图接管轨道：关闭跟随（滑走不拉回），
  // 下一次切项恢复居中。竖线每帧由活动项现算，天然不失步。
  document.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      const track = document.getElementById('toc-list');
      if (!track || !(e.target instanceof Node) || !track.contains(e.target)) return;

      e.preventDefault();
      trackFollow = false;
      track.scrollTop += e.deltaY;
    },
    { passive: false },
  );

  const initToc = (): void => {
    measure();
    layoutMarks(); // 观察器首次回调即落位初始活动项（深链时触发状态矫正瞬移）
  };

  document.addEventListener('swup:content:replace', () => {
    lastActiveIdx = -1;
    barPlaced = false; // 目录整块重建，竖线是全新元素
    trackPlaced = false;
    trackFollow = true;
    p = 1;
    requestAnimationFrame(initToc);
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToc);
  } else {
    initToc();
  }

  /** 瞬移落位（目录抽屉打开）：竖线直接贴活动项（状态矫正），并让列表按
   * 抽屉新高度流向居中 */
  window.__tocSnap = () => {
    if (lastActiveIdx < 0 || lastActiveIdx >= slugs.length) return;
    measure(); // 抽屉已把 .toc-nav 移入新容器：目录项 offsetTop/高度需重测
    const bar = document.getElementById('toc-bar');
    if (!bar) return;
    barPlaced = true;
    barPos = itemTops[lastActiveIdx];
    bar.style.height = `${itemHeights[lastActiveIdx]}px`;
    bar.style.transform = `translateY(${barPos}px)`;
    p = 1;
    trackFollow = true;
    retarget(lastActiveIdx, document.getElementById('toc-list'));
    ensureLoop();
  };
})();
