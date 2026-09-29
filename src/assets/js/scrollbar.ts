// scrollbar.ts — 自定义悬浮滚动条（鼠标拖动 / 点击轨道 / hover 定位）
// 用法：由 CustomScrollbar.astro 引入：import "../../assets/js/scrollbar"
(() => {
  const container = document.getElementById('custom-scrollbar');
  const track = document.getElementById('scrollbar-track');
  const thumb = document.getElementById('scrollbar-thumb');
  const hoverZone = document.getElementById('scrollbar-hover-zone');
  if (!container || !track || !thumb) return;

  let isDragging = false;
  let startY = 0;
  let startScrollTop = 0;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const HIDE_DELAY = 1500;

  const hasScroll = (): boolean => document.documentElement.scrollHeight > window.innerHeight + 2;

  const showScrollbar = (): void => {
    container.classList.add('visible');
  };

  const scheduleHide = (): void => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isDragging) container.classList.remove('visible');
    }, HIDE_DELAY);
  };

  const updateScrollbar = (): void => {
    if (!hasScroll()) {
      container.classList.remove('visible');
      return;
    }

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.max(
      30,
      (window.innerHeight / document.documentElement.scrollHeight) * trackHeight,
    );
    const thumbTop = (scrollTop / docHeight) * (trackHeight - thumbHeight);

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${thumbTop}px)`;

    showScrollbar();
    scheduleHide();
  };

  const onMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    isDragging = true;
    startY = e.clientY;
    startScrollTop = window.scrollY;
    document.body.style.userSelect = 'none';
    thumb.classList.add('active');
    clearTimeout(hideTimer);
  };

  const onMouseMove = (e: MouseEvent): void => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const trackHeight = track.clientHeight;
    const thumbHeight = thumb.clientHeight;
    const scrollDelta = (deltaY / (trackHeight - thumbHeight)) * docHeight;
    window.scrollTo(0, startScrollTop + scrollDelta);
  };

  const onMouseUp = (): void => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = '';
    thumb.classList.remove('active');
    scheduleHide();
  };

  // 用不可见的悬停触发区替代全局 mousemove 监听
  if (hoverZone) {
    hoverZone.addEventListener('mouseenter', () => {
      if (!isDragging && hasScroll()) {
        clearTimeout(hideTimer);
        showScrollbar();
      }
    });
    hoverZone.addEventListener('mouseleave', () => {
      if (!isDragging) scheduleHide();
    });
  }

  container.addEventListener('mouseenter', () => {
    if (!isDragging) {
      clearTimeout(hideTimer);
      showScrollbar();
    }
  });

  container.addEventListener('mouseleave', () => {
    if (!isDragging) scheduleHide();
  });

  track.addEventListener('click', (e: MouseEvent) => {
    if (e.target === thumb) return;
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const trackHeight = track.clientHeight;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollTarget = (clickY / trackHeight) * docHeight;
    window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  });

  thumb.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  window.addEventListener('scroll', updateScrollbar, { passive: true });
  window.addEventListener('resize', updateScrollbar, { passive: true });

  document.addEventListener('swup:content:replace', () => {
    requestAnimationFrame(updateScrollbar);
  });

  updateScrollbar();
  setTimeout(updateScrollbar, 600);
})();
