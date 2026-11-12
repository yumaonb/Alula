// scrollbar.ts — 自定义悬浮滚动条（鼠标拖动 / 点击轨道 / 悬停定位）
// 用法：由 CustomScrollbar.astro 引入：import "../../assets/js/ui/scrollbar"
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

  // 滑块高度（只在尺寸变化时重算）与位移（每帧更新）分开：
  // scroll 回调经 rAF 合并到每帧一次，只探测文档高度并写 transform，
  // 不再每个 scroll 事件都读布局再写样式
  let cachedScrollHeight = 0;
  let cachedViewportHeight = 0;
  let cachedTrackHeight = 0;
  let cachedThumbHeight = 30;
  let isFrameQueued = false;

  const recalcSizes = (): void => {
    cachedScrollHeight = document.documentElement.scrollHeight;
    cachedViewportHeight = window.innerHeight;
    cachedTrackHeight = track.clientHeight;
    // 30px 下限：与 CustomScrollbar.astro 组件 CSS 各一份，同改
    cachedThumbHeight = Math.max(
      30,
      (cachedViewportHeight / cachedScrollHeight) * cachedTrackHeight,
    );
    thumb.style.height = `${cachedThumbHeight}px`;
  };

  const updateScrollbar = (): void => {
    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    if (scrollHeight <= viewportHeight + 2) {
      container.classList.remove('visible');
      return;
    }

    // 文档高度 / 视口高度变了（如图片、评论加载后页面变高）：先重算滑块高度
    if (scrollHeight !== cachedScrollHeight || viewportHeight !== cachedViewportHeight) {
      recalcSizes();
    }

    const docHeight = cachedScrollHeight - cachedViewportHeight;
    const thumbTop = (window.scrollY / docHeight) * (cachedTrackHeight - cachedThumbHeight);
    thumb.style.transform = `translateY(${thumbTop}px)`;

    showScrollbar();
    scheduleHide();
  };

  const queueScrollbarUpdate = (): void => {
    if (isFrameQueued) return;
    isFrameQueued = true;
    requestAnimationFrame(() => {
      isFrameQueued = false;
      updateScrollbar();
    });
  };

  const onMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    isDragging = true;
    startY = e.clientY;
    startScrollTop = window.scrollY;
    document.body.style.userSelect = 'none';
    document.body.classList.add('is-dragging-scrollbar');
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
    document.body.classList.remove('is-dragging-scrollbar');
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
  // 在浏览器窗口外松开鼠标时 mouseup 不会派发，靠失焦兜底清理拖拽态
  window.addEventListener('blur', onMouseUp);

  window.addEventListener('scroll', queueScrollbarUpdate, { passive: true });
  window.addEventListener('resize', queueScrollbarUpdate, { passive: true });

  document.addEventListener('swup:content:replace', queueScrollbarUpdate);

  updateScrollbar();
  setTimeout(updateScrollbar, 600);
})();
