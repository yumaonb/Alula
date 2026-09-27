// toc.js — 文章目录：活动高亮、指示竖线移动动画、点击平滑滚动、目录自身滚动隔离
// 用法：由 TableOfContents.astro 引入：import "../../assets/js/toc.js"
(function () {
  if (window.__tocInit) return;
  window.__tocInit = true;

  const NAV_HEIGHT = 80;
  let isClickMode = false;
  let isTrackScrolling = false;

  function getNavOffset() {
    const nav = document.querySelector('.navbar');
    return nav ? nav.offsetHeight + 12 : NAV_HEIGHT;
  }

  function smoothScrollTo(target) {
    const top = target.getBoundingClientRect().top + window.scrollY - getNavOffset();
    if (Math.abs(top - window.scrollY) < 1) return;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  let snapBarNext = false;

  function positionBar(useTransition) {
    const bar = document.getElementById('toc-bar');
    const activeEl = document.querySelector('.toc-item.active');
    const trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return;
    const linkEl = activeEl.querySelector('.toc-link');
    if (!linkEl) return;

    const newTop = linkEl.offsetTop;
    const newH = linkEl.offsetHeight;
    const oldTop = bar.style.top ? parseFloat(bar.style.top) : null;
    const oldH = bar.style.height ? parseFloat(bar.style.height) : null;
    const animating = bar._animating === true;

    if (oldTop === null || snapBarNext) {
      snapBarNext = false;
      bar.style.transition = 'none';
      bar.style.top = newTop + 'px';
      bar.style.height = newH + 'px';
      bar.style.opacity = '1';
      return;
    }

    if (Math.abs(newTop - oldTop) < 1 && Math.abs(newH - oldH) < 1) return;
    if (animating && !useTransition) return;

    if (isClickMode && !isTrackScrolling) {
      bar.style.transition = 'top 0.15s ease-out, height 0.15s ease-out, opacity 0.2s ease';
      bar.style.top = newTop + 'px';
      bar.style.height = newH + 'px';
      bar.style.opacity = '1';
    } else if (Math.abs(newTop - oldTop) > 1) {
      bar._animating = true;
      bar.style.transition = 'none';

      if (newTop > oldTop) {
        bar.style.top = oldTop + 'px';
        bar.style.height = newTop + newH - oldTop + 'px';
      } else {
        bar.style.top = newTop + 'px';
        bar.style.height = oldTop + oldH - newTop + 'px';
      }
      bar.style.opacity = '1';

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          bar.style.transition = 'top 0.12s ease-out, height 0.12s ease-out';
          bar.style.top = newTop + 'px';
          bar.style.height = newH + 'px';
          setTimeout(function () {
            bar._animating = false;
          }, 130);
        });
      });
    } else if (!animating) {
      bar.style.transition = 'none';
      bar.style.top = newTop + 'px';
      bar.style.height = newH + 'px';
      bar.style.opacity = '1';
    }
  }

  document.addEventListener('click', function (e) {
    const link = e.target.closest('.toc-link');
    if (!link) return;
    e.preventDefault();
    const item = link.closest('.toc-item');
    if (!item) return;
    const id = item.getAttribute('data-target');
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    isClickMode = true;
    smoothScrollTo(el);
    setTimeout(function () {
      isClickMode = false;
    }, 800);
  });

  let lastActiveSlug = null;
  let lastScrolledSlug = null;

  function updateToc() {
    const items = document.querySelectorAll('.toc-item');
    if (items.length === 0) return;

    const offset = getNavOffset();
    const sy = window.scrollY;
    let bestSlug = null;

    items.forEach(function (item) {
      const slug = item.getAttribute('data-target');
      if (!slug) return;
      const h = document.getElementById(slug);
      if (!h) return;
      if (h.getBoundingClientRect().top + sy <= sy + offset + 4) {
        bestSlug = slug;
      }
    });

    if (!bestSlug) bestSlug = items[0].getAttribute('data-target');

    if (bestSlug !== lastActiveSlug) {
      lastActiveSlug = bestSlug;
      items.forEach(function (item) {
        item.classList.toggle('active', item.getAttribute('data-target') === bestSlug);
      });
    }

    const bar = document.getElementById('toc-bar');
    const activeEl = document.querySelector('.toc-item.active');
    const trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return;

    const linkEl = activeEl.querySelector('.toc-link');
    if (!linkEl) return;

    const trackH = trackEl.clientHeight;
    const midY = trackH / 2;
    const linkH = linkEl.offsetHeight;
    const contentTop = linkEl.offsetTop;
    const maxScroll = trackEl.scrollHeight - trackH;

    if (!isClickMode && maxScroll > 0) {
      let desiredScroll = contentTop - midY + linkH / 2;
      desiredScroll = Math.max(0, Math.min(desiredScroll, maxScroll));
      const scrollDiff = Math.abs(desiredScroll - trackEl.scrollTop);
      const shouldScroll = scrollDiff > 2 && bestSlug !== lastScrolledSlug;
      if (shouldScroll) {
        lastScrolledSlug = bestSlug;
        trackEl.scrollTo({ top: desiredScroll, behavior: 'smooth' });
      }
    }

    positionBar(isClickMode || maxScroll <= 0);
  }

  let raf = false;
  window.addEventListener(
    'scroll',
    function () {
      if (!raf) {
        requestAnimationFrame(function () {
          updateToc();
          raf = false;
        });
        raf = true;
      }
    },
    { passive: true },
  );

  document.addEventListener('DOMContentLoaded', updateToc);
  document.addEventListener('swup:content:replace', function () {
    lastActiveSlug = null;
    requestAnimationFrame(updateToc);
  });
  updateToc();

  document.addEventListener(
    'scroll',
    function (e) {
      const track = document.getElementById('toc-list');
      if (!track || e.target !== track) return;
      isTrackScrolling = true;
      positionBar(false);
      setTimeout(function () {
        isTrackScrolling = false;
      }, 50);
    },
    true,
  );

  document.addEventListener(
    'wheel',
    function (e) {
      const track = document.getElementById('toc-list');
      if (!track || !track.contains(e.target)) return;

      e.preventDefault();

      track.scrollTop += e.deltaY;
      isTrackScrolling = true;
      positionBar(false);
      setTimeout(function () {
        isTrackScrolling = false;
      }, 50);
    },
    { passive: false },
  );

  window.__tocSnap = function () {
    snapBarNext = true;
    updateToc();
  };
})();
