// toc.js — 文章目录：活动高亮、指示竖线移动动画、点击平滑滚动、目录自身滚动隔离
// 用法：由 TableOfContents.astro 引入：import "../../assets/js/toc.js"
(function() {
  if (window.__tocInit) return;
  window.__tocInit = true;

  var NAV_HEIGHT = 80;
  var isClickMode = false;
  var isTrackScrolling = false;

  function getNavOffset() {
    var nav = document.querySelector('.navbar');
    return nav ? nav.offsetHeight + 12 : NAV_HEIGHT;
  }

  function smoothScrollTo(target) {
    var top = target.getBoundingClientRect().top + window.scrollY - getNavOffset();
    if (Math.abs(top - window.scrollY) < 1) return;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  var snapBarNext = false;

  function positionBar(useTransition) {
    var bar = document.getElementById('toc-bar');
    var activeEl = document.querySelector('.toc-item.active');
    var trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return;
    var linkEl = activeEl.querySelector('.toc-link');
    if (!linkEl) return;

    var newTop = linkEl.offsetTop;
    var newH = linkEl.offsetHeight;
    var oldTop = bar.style.top ? parseFloat(bar.style.top) : null;
    var oldH = bar.style.height ? parseFloat(bar.style.height) : null;
    var animating = bar._animating === true;

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
        bar.style.height = (newTop + newH - oldTop) + 'px';
      } else {
        bar.style.top = newTop + 'px';
        bar.style.height = (oldTop + oldH - newTop) + 'px';
      }
      bar.style.opacity = '1';

      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          bar.style.transition = 'top 0.12s ease-out, height 0.12s ease-out';
          bar.style.top = newTop + 'px';
          bar.style.height = newH + 'px';
          setTimeout(function() { bar._animating = false; }, 130);
        });
      });
    } else if (!animating) {
      bar.style.transition = 'none';
      bar.style.top = newTop + 'px';
      bar.style.height = newH + 'px';
      bar.style.opacity = '1';
    }
  }

  document.addEventListener('click', function(e) {
    var link = e.target.closest('.toc-link');
    if (!link) return;
    e.preventDefault();
    var item = link.closest('.toc-item');
    if (!item) return;
    var id = item.getAttribute('data-target');
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    isClickMode = true;
    smoothScrollTo(el);
    setTimeout(function() { isClickMode = false; }, 800);
  });

  var lastActiveSlug = null;
  var lastScrolledSlug = null;

  function updateToc() {
    var items = document.querySelectorAll('.toc-item');
    if (items.length === 0) return;

    var offset = getNavOffset();
    var sy = window.scrollY;
    var bestSlug = null;

    items.forEach(function(item) {
      var slug = item.getAttribute('data-target');
      if (!slug) return;
      var h = document.getElementById(slug);
      if (!h) return;
      if (h.getBoundingClientRect().top + sy <= sy + offset + 4) {
        bestSlug = slug;
      }
    });

    if (!bestSlug) bestSlug = items[0].getAttribute('data-target');

    if (bestSlug !== lastActiveSlug) {
      lastActiveSlug = bestSlug;
      items.forEach(function(item) {
        item.classList.toggle('active', item.getAttribute('data-target') === bestSlug);
      });
    }

    var bar = document.getElementById('toc-bar');
    var activeEl = document.querySelector('.toc-item.active');
    var trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return;

    var linkEl = activeEl.querySelector('.toc-link');
    if (!linkEl) return;

    var trackH = trackEl.clientHeight;
    var midY = trackH / 2;
    var linkH = linkEl.offsetHeight;
    var contentTop = linkEl.offsetTop;
    var maxScroll = trackEl.scrollHeight - trackH;

    if (!isClickMode && maxScroll > 0) {
      var desiredScroll = contentTop - midY + linkH / 2;
      desiredScroll = Math.max(0, Math.min(desiredScroll, maxScroll));
      var scrollDiff = Math.abs(desiredScroll - trackEl.scrollTop);
      var shouldScroll = scrollDiff > 2 && bestSlug !== lastScrolledSlug;
      if (shouldScroll) {
        lastScrolledSlug = bestSlug;
        trackEl.scrollTo({ top: desiredScroll, behavior: 'smooth' });
      }
    }

    positionBar(isClickMode || maxScroll <= 0);
  }

  var raf = false;
  window.addEventListener('scroll', function() {
    if (!raf) {
      requestAnimationFrame(function() {
        updateToc();
        raf = false;
      });
      raf = true;
    }
  }, { passive: true });

  document.addEventListener('DOMContentLoaded', updateToc);
  document.addEventListener('swup:content:replace', function() {
    lastActiveSlug = null;
    requestAnimationFrame(updateToc);
  });
  updateToc();

  document.addEventListener('scroll', function(e) {
    var track = document.getElementById('toc-list');
    if (!track || e.target !== track) return;
    isTrackScrolling = true;
    positionBar(false);
    setTimeout(function() { isTrackScrolling = false; }, 50);
  }, true);

  document.addEventListener('wheel', function(e) {
    var track = document.getElementById('toc-list');
    if (!track || !track.contains(e.target)) return;

    e.preventDefault();

    track.scrollTop += e.deltaY;
    isTrackScrolling = true;
    positionBar(false);
    setTimeout(function() { isTrackScrolling = false; }, 50);
  }, { passive: false });

  window.__tocSnap = function() {
    snapBarNext = true;
    updateToc();
  };
})();
