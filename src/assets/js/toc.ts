// toc.ts — 文章目录：活动高亮、指示竖线移动动画、点击平滑滚动、目录自身滚动隔离
// 用法：由 TableOfContents.astro 引入：import "../../assets/js/toc"
// 竖线位移由 motion 驱动：点击短距直移；滚动跟随的大位移先拉伸覆盖「旧 ∪ 新」、
// 再滑到原位；中断时从飞行中位置续接，不依赖 rAF / setTimeout 编排。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

(() => {
  if (window.__tocInit) return;
  window.__tocInit = true;

  const NAV_HEIGHT = 80;
  const EASE_CSS: [number, number, number, number] = [0.25, 0.1, 0.25, 1]; // CSS 的 ease
  let isClickMode = false;
  let isTrackScrolling = false;

  function getNavOffset(): number {
    const nav = document.querySelector<HTMLElement>('.navbar');
    return nav ? nav.offsetHeight + 12 : NAV_HEIGHT;
  }

  function smoothScrollTo(target: HTMLElement): void {
    const top = target.getBoundingClientRect().top + window.scrollY - getNavOffset();
    if (Math.abs(top - window.scrollY) < 1) return;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  let snapBarNext = false;
  let barControls: AnimationPlaybackControls[] = [];

  /** 掐掉竖线上在飞的动画（直写内联前必须先撤 WAAPI，否则动画效果会盖过内联） */
  function cancelBar(): void {
    for (const control of barControls) control.cancel();
    barControls = [];
  }

  function positionBar(): void {
    const bar = document.getElementById('toc-bar');
    const activeEl = document.querySelector('.toc-item.active');
    const trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return;
    const linkEl = activeEl.querySelector<HTMLElement>('.toc-link');
    if (!linkEl) return;

    const newTop = linkEl.offsetTop;
    const newH = linkEl.offsetHeight;
    // 先读飞行中值（动画进行中时是插值）；top 为 auto（首屏 / 换页后的新竖线）则直接落位
    const inFlightTop = parseFloat(getComputedStyle(bar).top);
    const inFlightH = parseFloat(getComputedStyle(bar).height);

    if (Number.isNaN(inFlightTop) || Number.isNaN(inFlightH) || snapBarNext) {
      snapBarNext = false;
      cancelBar();
      bar.style.top = `${newTop}px`;
      bar.style.height = `${newH}px`;
      bar.style.opacity = '1';
      return;
    }

    if (Math.abs(newTop - inFlightTop) < 1 && Math.abs(newH - inFlightH) < 1) return;

    if (isClickMode && !isTrackScrolling) {
      // 点击跳转：短距直移，位置与透明度各自跑原来的时长
      barControls.push(
        animate(bar, { top: newTop, height: newH }, { duration: 0.15, ease: 'easeOut' }),
        animate(bar, { opacity: 1 }, { duration: 0.2, ease: EASE_CSS })
      );
      return;
    }

    if (Math.abs(newTop - inFlightTop) > 1) {
      // 滚动跟随的大位移：先直写拉伸到覆盖「旧 ∪ 新」，再滑 + 收缩到新位——
      // 两段手感保留；改向 / 连续滚动时从飞行中位置续接，不中断重放
      cancelBar();
      const unionTop = Math.min(inFlightTop, newTop);
      const unionH = Math.max(inFlightTop + inFlightH, newTop + newH) - unionTop;
      bar.style.top = `${unionTop}px`;
      bar.style.height = `${unionH}px`;
      bar.style.opacity = '1';
      barControls.push(
        animate(bar, { top: newTop, height: newH }, { duration: 0.12, ease: 'easeOut' })
      );
      return;
    }

    // 小位移：直接滑过去
    barControls.push(animate(bar, { top: newTop, height: newH }, { duration: 0.12, ease: 'easeOut' }));
  }

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
    smoothScrollTo(el);
    setTimeout(() => {
      isClickMode = false;
    }, 800);
  });

  let lastActiveSlug: string | null = null;
  let lastScrolledSlug: string | null = null;

  function updateToc(): void {
    const items = document.querySelectorAll('.toc-item');
    if (items.length === 0) return;

    const offset = getNavOffset();
    const sy = window.scrollY;
    let bestSlug: string | null = null;

    items.forEach((item) => {
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
      items.forEach((item) => {
        item.classList.toggle('active', item.getAttribute('data-target') === bestSlug);
      });
    }

    const bar = document.getElementById('toc-bar');
    const activeEl = document.querySelector('.toc-item.active');
    const trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return;

    const linkEl = activeEl.querySelector<HTMLElement>('.toc-link');
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

    positionBar();
  }

  let raf = false;
  window.addEventListener(
    'scroll',
    () => {
      if (!raf) {
        requestAnimationFrame(() => {
          updateToc();
          raf = false;
        });
        raf = true;
      }
    },
    { passive: true },
  );

  document.addEventListener('DOMContentLoaded', updateToc);
  document.addEventListener('swup:content:replace', () => {
    lastActiveSlug = null;
    requestAnimationFrame(updateToc);
  });
  updateToc();

  document.addEventListener(
    'scroll',
    (e: Event) => {
      const track = document.getElementById('toc-list');
      if (!track || e.target !== track) return;
      isTrackScrolling = true;
      positionBar();
      setTimeout(() => {
        isTrackScrolling = false;
      }, 50);
    },
    true,
  );

  document.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      const track = document.getElementById('toc-list');
      if (!track || !(e.target instanceof Node) || !track.contains(e.target)) return;

      e.preventDefault();

      track.scrollTop += e.deltaY;
      isTrackScrolling = true;
      positionBar();
      setTimeout(() => {
        isTrackScrolling = false;
      }, 50);
    },
    { passive: false },
  );

  window.__tocSnap = () => {
    snapBarNext = true;
    updateToc();
  };
})();
