// toc.ts — 文章目录：活动高亮、指示竖线移动动画、点击平滑滚动、目录自身滚动隔离
// 用法：由 TableOfContents.astro 引入：import "../../assets/js/toc"
// 竖线由 motion 驱动：高度恒贴合活动项（不做变长/变短动画），位置 top 平滑上下滑动、
// 改向从飞行中位置续接，不依赖 rAF / setTimeout 编排。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

(() => {
  if (window.__tocInit) return;
  window.__tocInit = true;

  const NAV_HEIGHT = 80;
  let isClickMode = false;

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

  /**
   * 竖线跟活动项：高度恒等于活动项、直接贴合（不做变长/变短动画——拉伸覆盖式动画
   * 在快速滚动时会被逐帧重拉，表现为抖动的长条）；位置 top 从飞行中值平滑滑到新位，
   * 改向从当前位置续接、不重放。竖线随目录内容一起滚动，手动滑目录时不重新定位。
   */
  function positionBar(): void {
    const bar = document.getElementById('toc-bar');
    const activeEl = document.querySelector('.toc-item.active');
    const trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return;
    const linkEl = activeEl.querySelector<HTMLElement>('.toc-link');
    if (!linkEl) return;

    const newTop = linkEl.offsetTop;
    bar.style.height = `${linkEl.offsetHeight}px`;

    // 先读飞行中值（动画进行中时是插值）；top 为 auto（首屏 / 换页后的新竖线）则直接落位
    const inFlightTop = parseFloat(getComputedStyle(bar).top);
    if (Number.isNaN(inFlightTop) || snapBarNext) {
      snapBarNext = false;
      cancelBar();
      bar.style.top = `${newTop}px`;
      return;
    }

    if (Math.abs(newTop - inFlightTop) < 1) return;
    barControls.push(animate(bar, { top: newTop }, { duration: 0.2, ease: 'easeOut' }));
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

  // 目录内容自身滚动（滚轮 / 触摸）：只接管滚动行为，不碰竖线——
  // 竖线随内容一起滚动，活动项由页面滚动决定，目录滚轮不改变它
  document.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      const track = document.getElementById('toc-list');
      if (!track || !(e.target instanceof Node) || !track.contains(e.target)) return;

      e.preventDefault();

      track.scrollTop += e.deltaY;
    },
    { passive: false },
  );

  window.__tocSnap = () => {
    snapBarNext = true;
    updateToc();
  };
})();
