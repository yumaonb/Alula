// swup-widgets.js — 侧边悬浮按钮列运行时控制器（可用性 / 显隐 / 进度环 / 点击）
// 用法：由 BaseLayout 引入：import "../assets/js/swup-widgets.js"
// 职责：可用性按页面类型+视口重估（.unavailable/.compact）；滚动驱动显隐（.visible）；
//       进度环更新（stroke-dashoffset + 百分比文本）；向上/向下/到评论跳转。
//       目录（#toc-fab）与筛选（#posts-filter-fab）按钮分别由 TocModal / PostsFilterModal 监听。
// 切页放行：切页开始即压制按钮，新内容就绪后保持压制，直到页面滚回顶部、
//       平滑滚动结束（swup:scroll:end），或新内容渲染后 250ms 兜底超时为止。
const container = document.getElementById('side-widgets');
if (container) initSideWidgets(container);

function initSideWidgets(container) {
  const SHOW_AT = 100; // 滚动超过该值才显示按钮
  const IDLE_RELEASE_MS = 250; // 新内容就绪后等滚动动画启动的窗口，超时按当前位置放行
  const WIDGET_ORDER = ['top', 'toc', 'filter', 'progress', 'comments', 'bottom'];

  const buttons = {};
  container.querySelectorAll('.back-to-widget').forEach((btn) => {
    const key = btn.dataset.widget;
    if (key) buttons[key] = btn;
  });

  const progressBtn = buttons['progress'];
  const progressBar = progressBtn ? progressBtn.querySelector('.progress-ring-bar') : null;
  const progressText = progressBtn ? progressBtn.querySelector('.progress-text') : null;
  const available = WIDGET_ORDER.map((k) => buttons[k]).filter(Boolean);

  let busy = false; // swup 切页挂起：切页开始 → 页面回到顶部/滚动结束 期间为 true
  let scrolling = false; // swup 平滑滚动（scroll plugin）进行中
  let settleTimer = 0; // 兜底定时器（见职责划分③）
  let rafId = 0;

  function markUnavailable(key, flag) {
    const btn = buttons[key];
    if (btn) btn.classList.toggle('unavailable', !!flag);
  }

  /** 探测当前页面类型（文章详情 / 文章列表·分类 / 普通页） */
  function pageContext() {
    return {
      detail: !!document.querySelector('.post-content'),
      list: !!document.querySelector('.posts-page, .category-page'),
      toc: !!document.querySelector('.toc-nav .toc-link'),
      comments: !!document.getElementById('comments-section'),
    };
  }

  /** 按页面类型 + 视口宽度重估每个按钮的可用性 */
  function probe() {
    const { detail, list, toc, comments } = pageContext();
    const w = window.innerWidth;

    // 筛选按钮：详情页 ≤1000px / 列表·分类页 ≤768px 才需要；桌面端侧栏常驻则隐藏
    let filterMode = 'none';
    if (detail) filterMode = w <= 1000 ? 'detail' : 'none';
    else if (list) filterMode = w <= 768 ? 'list' : 'none';

    markUnavailable('toc', !toc);
    markUnavailable('comments', !comments);
    markUnavailable('filter', filterMode === 'none');
    buttons['filter']?.classList.toggle('compact', filterMode === 'list');
  }

  /** 挂起结束：恢复由滚动驱动的正常显隐 */
  function release() {
    busy = false;
    scrolling = false;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = 0;
    }
    container.classList.remove('navigating');
    render(); // 立即按当前滚动位置刷新显隐，避免兜底放行后按钮状态滞后
  }

  /** 渲染滚动位置相关的状态：按钮显隐 + 阅读进度环 */
  function render(scrollY) {
    const y = typeof scrollY === 'number' ? scrollY : window.scrollY;

    // 页面已滚回顶部 → 挂起结束（哪怕平滑滚动只剩收尾，顶部即视为"完全到顶"）
    if (busy && y <= SHOW_AT) release();

    // 挂起期间不驱动显隐（按钮已在切页时被压制成隐藏）
    const show = y > SHOW_AT && !busy;
    for (const btn of available) {
      const usable = show && !btn.classList.contains('unavailable');
      btn.classList.toggle('visible', usable);
    }

    const doc = document.documentElement;
    const max = Math.max(0, doc.scrollHeight - window.innerHeight);
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    if (progressBar) progressBar.setAttribute('stroke-dashoffset', String(100 * (1 - p)));
    if (progressText) progressText.textContent = `${Math.round(p * 100)}%`;
  }

  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      render();
    });
  }

  function onResize() {
    probe();
    render();
  }

  // ---- 点击：目录 / 筛选由抽屉组件监听，这里只处理直接跳转类 ----
  container.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('.back-to-widget') : null;
    if (!btn || btn.classList.contains('unavailable')) return;
    const key = btn.dataset.widget;
    if (key === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (key === 'bottom') {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    } else if (key === 'comments') {
      const target = document.getElementById('comments-section');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /** 内容替换完成后：可用性按新页面重估，但保持压制，
      直到页面滚回顶部 / 滚动动画结束 / 兜底超时，再交还滚动逻辑 */
  function onContentReplaced() {
    container.classList.add('navigating');
    available.forEach((btn) => btn.classList.remove('visible'));
    probe();
    busy = true;
    scrolling = false;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = 0;
    }
    // 兜底：若 250ms 内平滑滚动尚未开始（切到短页/滚动直接重置等），按当前位置放行，
    // 避免无滚动事件可等时永久挂起；一旦 scroll:start 到来会取消本定时器。
    settleTimer = setTimeout(() => {
      settleTimer = 0;
      if (busy && !scrolling) release();
    }, IDLE_RELEASE_MS);
    render();
  }

  // ---- swup 切页：开始即压制，等页面真正回到顶部后再交还 ----
  document.addEventListener('swup:visit:start', () => {
    busy = true;
    scrolling = false;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = 0;
    }
    container.classList.add('navigating');
    available.forEach((btn) => btn.classList.remove('visible'));
  });

  // scroll plugin 的平滑滚动开始/结束（scrl）。以 scroll:end 为"落定"信号：
  // 平滑回顶可能耗时数秒，只有它真正结束（或滚动事件到顶）才放行按钮。
  document.addEventListener('swup:scroll:start', () => {
    if (!busy) return;
    scrolling = true;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = 0;
    } // 已有滚动动画，取消兜底
  });

  document.addEventListener('swup:scroll:end', () => {
    scrolling = false;
    // 滚动已结束：按落点恢复正常显隐（回到顶部则隐藏，停在中段则显示可用按钮）
    if (busy) release();
  });

  // 访问可能提前结束（例如返回上一页缓存直跳、无平滑滚动路径）：兜底放行
  document.addEventListener('swup:visit:end', () => {
    if (busy && !scrolling) release();
  });

  document.addEventListener('swup:content:replace', onContentReplaced);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  probe();
  render();
}
