// page-widgets.ts — 侧边按钮滚动显隐、阅读进度与切页挂起
// 用法：由 PageExtras 引入：import '../../assets/js/nav/page-widgets'

const SHOW_AT = 100;
const IDLE_RELEASE_MS = 250;
const RETURN_TOP_MAX_MS = 2000;

function initPageWidgets(): void {
  const controller = new AbortController();
  const { signal } = controller;
  let isBusy = false;
  let isScrolling = false;
  let isReturningTop = false;
  let returnTopFrom = 0;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let returnTopTimer: ReturnType<typeof setTimeout> | null = null;
  let rafId = 0;

  function clearSettleTimer(): void {
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
  }

  function stopReturnTop(): void {
    isReturningTop = false;
    if (returnTopTimer !== null) clearTimeout(returnTopTimer);
    returnTopTimer = null;
  }

  function stopNavigation(): void {
    isBusy = false;
    isScrolling = false;
    clearSettleTimer();
    document.getElementById('side-widgets')?.classList.remove('navigating');
  }

  function cancelRender(): void {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function render(): void {
    const container = document.getElementById('side-widgets');
    if (!container) return;
    const y = window.scrollY;
    if (isBusy && y <= SHOW_AT) stopNavigation();
    if (isReturningTop && (y <= SHOW_AT || y > returnTopFrom)) stopReturnTop();

    const shouldShow = y > SHOW_AT && !isBusy && !isReturningTop;
    container.querySelectorAll<HTMLElement>('.back-to-widget').forEach((button) => {
      button.classList.toggle('visible', shouldShow && !button.classList.contains('unavailable'));
    });

    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    const progressButton = container.querySelector('[data-widget="progress"]');
    const progressBar = progressButton?.querySelector('.progress-ring-bar');
    const progressText = progressButton?.querySelector('.progress-text');
    // 刻度与 SideWidgets.astro 的进度环 pathLength="100" 两处同改。
    progressBar?.setAttribute('stroke-dashoffset', String(100 * (1 - progress)));
    if (progressText) progressText.textContent = String(Math.round(progress * 100)) + '%';
  }

  function scheduleRender(): void {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      render();
    });
  }

  function onRefresh(): void {
    cancelRender();
    render();
  }

  function release(): void {
    stopNavigation();
    onRefresh();
  }

  function hideButtons(): void {
    document
      .querySelectorAll('#side-widgets .back-to-widget')
      .forEach((button) => button.classList.remove('visible'));
  }

  function startReturnTop(): void {
    stopReturnTop();
    isReturningTop = true;
    returnTopFrom = window.scrollY;
    hideButtons();
    // 回顶被打断或没有滚动事件时，按当前位置放行。
    returnTopTimer = setTimeout(() => {
      returnTopTimer = null;
      stopReturnTop();
      onRefresh();
    }, RETURN_TOP_MAX_MS);
  }

  function onClick(event: MouseEvent): void {
    const target = event.target;
    const element =
      target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
    const button = element?.closest<HTMLElement>('#side-widgets .back-to-widget');
    if (!button || button.classList.contains('unavailable')) return;
    if (button.dataset.widget === 'top') {
      startReturnTop();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (button.dataset.widget === 'bottom') {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }
  }

  function suspend(): void {
    isBusy = true;
    isScrolling = false;
    stopReturnTop();
    clearSettleTimer();
    cancelRender();
    document.getElementById('side-widgets')?.classList.add('navigating');
    hideButtons();
  }

  function onContentReplaced(): void {
    suspend();
    // 新内容就绪后等待滚动启动；没有滚动时按当前位置放行。
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (isBusy && !isScrolling) release();
    }, IDLE_RELEASE_MS);
    // 同一轮内容替换的可用性探测先完成，再绘制按钮。
    scheduleRender();
  }

  function onScrollStart(): void {
    if (!isBusy) return;
    isScrolling = true;
    clearSettleTimer();
  }

  function onScrollEnd(): void {
    isScrolling = false;
    if (isBusy) release();
  }

  function onVisitEnd(): void {
    if (isBusy && !isScrolling) release();
  }

  function onPageHide(event: PageTransitionEvent): void {
    cancelRender();
    stopReturnTop();
    stopNavigation();
    // 往返缓存保留监听器，恢复时按新位置刷新。
    if (!event.persisted) controller.abort();
  }

  document.addEventListener('click', onClick, { signal });
  document.addEventListener('swup:visit:start', suspend, { signal });
  document.addEventListener('swup:content:replace', onContentReplaced, { signal });
  document.addEventListener('swup:scroll:start', onScrollStart, { signal });
  document.addEventListener('swup:scroll:end', onScrollEnd, { signal });
  document.addEventListener('swup:visit:end', onVisitEnd, { signal });
  // 可用性更新后同帧重绘；事件名与 swup-widgets.ts 两处同改。
  document.addEventListener('page-widgets:refresh', onRefresh, { signal });
  window.addEventListener('scroll', scheduleRender, { passive: true, signal });
  window.addEventListener('resize', scheduleRender, { signal });
  window.addEventListener('pageshow', scheduleRender, { signal });
  window.addEventListener('pagehide', onPageHide, { signal });
  scheduleRender();
}

initPageWidgets();

export {};
