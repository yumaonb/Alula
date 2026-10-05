// toc.ts — 文章目录：活动高亮、指示竖线、点击平滑滚动、目录自身滚动隔离
// 用法：由 TableOfContents.astro 引入：import "../../assets/js/toc"
// 共用检测：判定线（line = scrollY + navOffset + 4）与标题位缓存每帧只算
// 一次，活动项下标由高亮、竖线、轨道居中三者共用（同源同帧）。
// 共用过渡：竖线内容与轨道滚动用**同一条进度 p**（0→1、easeOut）推进。
// 列表静止且居中可达时，(竖线位移) == (轨道位移) → 竖线视觉位数学上恒在
// 视口中心：列表流动、中间部分固定（「划过去」感）；中途重定向从当前值
// 续接，竖线视觉位只朝中心单调收敛，无先掉后回的反向抵消、无「旧目标先
// 写回再矫正」的竞态（每帧唯一写入者，无离散 tween）。
// 轨道只在切项 / 首次落位 / 重测重定向时动；手动滚轮关闭跟随（滑走不拉
// 回），下一次切项恢复居中；点击窗口内轨道不动（不抢页面平滑滚动，竖线仍
// 跟高亮）；仅「首次落位」（深链进入 / 切页后）且距离 > SNAP_MAX_PX 才是
// 状态矫正、瞬移就位。
// 过渡循环：单 rAF、滚动驱动、收敛后自动停摆（静止零开销）。
// 标题位缓存会被布局平移（图片加载/占位符替换、字体）打穿：平移当帧先用哨
// 兵（活动项标题单元素 rect，偏差 > 2px）发现并整体重测，再判定；图片/字
// 体/resize 事件也驱动重测。竖线位移走 translateY（合成器通道）而非 top
// （布局通道）。
(() => {
  if (window.__tocInit) return;
  window.__tocInit = true;

  const NAV_HEIGHT = 80;
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

  // ---- 共用检测：标题文档绝对位 + 目录项 offsetTop/height 缓存。页面滚动
  // 不改变它们（内容布局稳定），每帧纯算术比较，不做 getBoundingClientRect
  // × N；缓存只在 init / 重测时重建（布局平移见 requestRemeasure / 哨兵）。 ----
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

  /** 活动项下标 = 最后一个越过判定线的标题（高亮/竖线/轨道共用） */
  function activeIdxFor(line: number): number {
    let idx = -1;
    for (let i = 0; i < headingTops.length; i++) {
      if (headingTops[i] <= line) idx = i;
      else break;
    }
    return idx < 0 ? 0 : idx;
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

  // ---- 布局平移重测：图片 load/error（捕获阶段）、字体 ready、resize 都会
  // 改变标题的文档绝对位；重测放在 rAF（等布局落定），重测后重定向一次
  // 共用过渡（TOC 布局若变化则顺势修正目标，否则是零位移空操作） ----
  let remeasurePending = false;
  function requestRemeasure(): void {
    if (remeasurePending) return;
    remeasurePending = true;
    requestAnimationFrame(() => {
      remeasurePending = false;
      measure();
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

  // ---- 单帧推进：共用判定 → 高亮（变化时）→ 共用过渡推进 ----
  let barPos = 0; // 竖线当前内容位

  function frame(now: number): boolean {
    if (headingTops.length === 0) return false;

    // 哨兵：当前活动项标题的实际文档位 vs 缓存，偏差 > 2px = 内容发生布局
    // 平移（图片/字体），缓存已过期——先整体重测再判定。单元素读取（非 × N），
    // 滚动本身不改样式，不会造成逐帧强制布局。
    if (lastActiveIdx >= 0 && lastActiveIdx < slugs.length) {
      const h = document.getElementById(slugs[lastActiveIdx]);
      if (h) {
        const actual = h.getBoundingClientRect().top + window.scrollY;
        if (Math.abs(actual - headingTops[lastActiveIdx]) > 2) measure();
      }
    }

    // 判定线：高亮、竖线、轨道共用（每帧一次）
    const line = window.scrollY + navOffset + 4;
    const idx = activeIdxFor(line);

    if (idx !== lastActiveIdx) {
      // 高亮实时跟线（纯类切换，无动画）
      document.querySelectorAll('.toc-item').forEach((item, i) => {
        item.classList.toggle('active', i === idx);
      });
      // 竖线高度恒贴合活动项
      const bar = document.getElementById('toc-bar');
      if (bar) bar.style.height = `${itemHeights[idx]}px`;
      // 切项是显式意图：恢复轨道居中（含手动滑走后的下次切项矫正；
      // 点击窗口内不恢复——页面平滑滚动进行中，轨道不动）
      if (!isClickMode) trackFollow = true;
      // 共用过渡重定向（窗口内只动竖线通道）
      retarget(idx, trackFollow ? document.getElementById('toc-list') : null);
      lastActiveIdx = idx;
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
    ensureLoop();
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
