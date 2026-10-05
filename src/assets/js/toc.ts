// toc.ts — 文章目录：活动高亮、指示竖线、点击平滑滚动、目录自身滚动隔离
// 用法：由 TableOfContents.astro 引入：import "../../assets/js/toc"
// 竖线与目录自动居中走同一条 tween（同时长、同缓动）：竖线的视觉位置是「旧中心位 →
// 新中心位」的一次平滑滑行，条目在下方流过；改向从两通道的当前实际值续接、不重放。
// 两条通道若用各自时长的独立动画驱动，曲线对消不干净，竖线会在中点附近抖动。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

(() => {
  if (window.__tocInit) return;
  window.__tocInit = true;

  const NAV_HEIGHT = 80;
  const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
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

  let barTween: AnimationPlaybackControls | null = null;

  /** 让活动项居中于目录视口的目标 scrollTop（夹在可滚范围内） */
  function centerScrollFor(linkEl: HTMLElement, trackEl: HTMLElement): number {
    const maxScroll = trackEl.scrollHeight - trackEl.clientHeight;
    const desired = linkEl.offsetTop - trackEl.clientHeight / 2 + linkEl.offsetHeight / 2;
    return Math.max(0, Math.min(desired, maxScroll));
  }

  /** 掐掉在飞的 tween（改向 / 瞬移前调用） */
  function stopBarTween(): void {
    barTween?.cancel();
    barTween = null;
  }

  /**
   * 竖线跟活动项，与目录自动居中同一条 tween：
   *   bar.top         当前值 → 活动项 offsetTop（内容坐标系）
   *   trackEl.scrollTop 当前值 → 活动项居中位
   * 两通道同时长同缓动，竖线视觉位置（top - scrollTop）在数学上退化为从当前视觉位到
   * 新中心位的一次平滑滑行，条目从旁边流过——「竖线固定在中间、丝滑上下」的效果。
   * 返回居中通道是否真的移动了（供「每项只居中一次」标记，之后用户手动滑走不回拉）。
   */
  function glideBar(centering: boolean): boolean {
    const bar = document.getElementById('toc-bar');
    const activeEl = document.querySelector('.toc-item.active');
    const trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return false;
    const linkEl = activeEl.querySelector<HTMLElement>('.toc-link');
    if (!linkEl) return false;

    // 高度恒贴合活动项，不做变长/变短动画
    bar.style.height = `${linkEl.offsetHeight}px`;
    const targetTop = linkEl.offsetTop;
    const startTop = bar.style.top ? parseFloat(bar.style.top) : targetTop;
    const startScroll = trackEl.scrollTop;
    const targetScroll = centering ? centerScrollFor(linkEl, trackEl) : startScroll;
    const didCenter = Math.abs(targetScroll - startScroll) > 2;

    const dist = Math.max(Math.abs(targetTop - startTop), Math.abs(targetScroll - startScroll));
    if (dist < 1) {
      bar.style.top = `${targetTop}px`;
      return didCenter;
    }

    // 时长按两通道位移成比例（0.3–0.55s），与导航下划线「远慢近快」同一原则
    const duration = Math.min(0.55, Math.max(0.3, 0.25 + dist * 0.0012));
    stopBarTween();
    const controls = animate(0, 1, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v: number) => {
        bar.style.top = `${startTop + (targetTop - startTop) * v}px`;
        trackEl.scrollTop = startScroll + (targetScroll - startScroll) * v;
      },
      onComplete: () => {
        if (barTween === controls) barTween = null;
      },
    });
    barTween = controls;
    return didCenter;
  }

  /** 瞬移落位（首屏量完高度 / 切页后 / 目录抽屉打开）：停 tween、直接写值 */
  function snapBar(): void {
    const bar = document.getElementById('toc-bar');
    const activeEl = document.querySelector('.toc-item.active');
    const trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return;
    const linkEl = activeEl.querySelector<HTMLElement>('.toc-link');
    if (!linkEl) return;
    stopBarTween();
    bar.style.height = `${linkEl.offsetHeight}px`;
    bar.style.top = `${linkEl.offsetTop}px`;
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
      // 点击窗口内不抢页面平滑滚动的居中（竖线本身仍跟活动项）；
      // 居中真的跑了才标记，之后用户手动把目录滑走不再拉回
      if (glideBar(!isClickMode)) lastScrolledSlug = bestSlug;
      return;
    }

    // 活动项未变：只补居中（典型是点击窗口结束、页面平滑滚动落定后把目录拉回该项中间）
    if (!isClickMode && !barTween && bestSlug !== lastScrolledSlug) {
      if (glideBar(true)) lastScrolledSlug = bestSlug;
    }
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
    snapBar();
  };
})();
