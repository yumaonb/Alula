// scrollbar.js — 自定义悬浮滚动条（鼠标拖动 / 点击轨道 / hover 定位）
// 用法：由 CustomScrollbar.astro 引入：import "../../assets/js/scrollbar.js"
(function () {
  const container = document.getElementById('custom-scrollbar');
  const track = document.getElementById('scrollbar-track');
  const thumb = document.getElementById('scrollbar-thumb');
  const hoverZone = document.getElementById('scrollbar-hover-zone');
  if (!container || !track || !thumb) return;

  let isDragging = false;
  let startY = 0;
  let startScrollTop = 0;
  let hideTimer = null;
  const HIDE_DELAY = 1500;

  function hasScroll() {
    return document.documentElement.scrollHeight > window.innerHeight + 2;
  }

  function showScrollbar() {
    container.classList.add('visible');
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (!isDragging) container.classList.remove('visible');
    }, HIDE_DELAY);
  }

  function updateScrollbar() {
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

    thumb.style.height = thumbHeight + 'px';
    thumb.style.transform = 'translateY(' + thumbTop + 'px)';

    showScrollbar();
    scheduleHide();
  }

  function onMouseDown(e) {
    e.preventDefault();
    isDragging = true;
    startY = e.clientY;
    startScrollTop = window.scrollY;
    document.body.style.userSelect = 'none';
    thumb.classList.add('active');
    clearTimeout(hideTimer);
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const trackHeight = track.clientHeight;
    const thumbHeight = thumb.clientHeight;
    const scrollDelta = (deltaY / (trackHeight - thumbHeight)) * docHeight;
    window.scrollTo(0, startScrollTop + scrollDelta);
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = '';
    thumb.classList.remove('active');
    scheduleHide();
  }

  // 用不可见的悬停触发区替代全局 mousemove 监听
  if (hoverZone) {
    hoverZone.addEventListener('mouseenter', function () {
      if (!isDragging && hasScroll()) {
        clearTimeout(hideTimer);
        showScrollbar();
      }
    });
    hoverZone.addEventListener('mouseleave', function () {
      if (!isDragging) scheduleHide();
    });
  }

  container.addEventListener('mouseenter', function () {
    if (!isDragging) {
      clearTimeout(hideTimer);
      showScrollbar();
    }
  });

  container.addEventListener('mouseleave', function () {
    if (!isDragging) scheduleHide();
  });

  track.addEventListener('click', function (e) {
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

  document.addEventListener('swup:content:replace', function () {
    requestAnimationFrame(updateScrollbar);
  });

  updateScrollbar();
  setTimeout(updateScrollbar, 600);
})();
