// toc.ts — 文章目录：活动高亮、指示竖线、点击平滑滚动、目录自身滚动隔离
// 用法：由 TableOfContents.astro 引入：import "../../assets/js/toc"
// 竖线与目录自动居中走同一条 motion tween（同时长、同缓动）：视觉位置是「旧中心位 →
// 新中心位」的一次平滑滑行，条目在下方流过；改向从两通道当前实际值续接。
// 竖线位移走 translateY（合成器通道）而非 top（布局通道）——两通道同帧驱动时，
// 只要一条走布局，低性能机器上会错开一帧，表现为细微抖动。
// 居中只发生在活动项切换时；竖线到位后不再移动目录（手动滑走不拉回，
// 点击后由下一次切项自然矫正）。
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

  // ---- 活动判定：标题文档绝对位缓存。页面滚动不改变它们（内容布局稳定），
  // 每帧纯算术比较，不做 getBoundingClientRect × N 的强制布局读取 ----
  let headingTops: Array<{ slug: string; top: number }> = [];
  let navOffset = NAV_HEIGHT;

  function measureHeadings(): void {
    const items = document.querySelectorAll('.toc-item');
    if (items.length === 0) {
      headingTops = [];
      return;
    }
    const sy = window.scrollY;
    const tops: Array<{ slug: string; top: number }> = [];
    items.forEach((item) => {
      const slug = item.getAttribute('data-target');
      if (!slug) return;
      const h = document.getElementById(slug);
      if (h) tops.push({ slug: slug, top: h.getBoundingClientRect().top + sy });
    });
    headingTops = tops;
    navOffset = getNavOffset();
  }

  // ---- 竖线与自动居中：同一条 tween 的两通道 ----
  let barTween: AnimationPlaybackControls | null = null;
  let barTop = 0; // 竖线当前位置（内容坐标系）；本脚本是唯一写入方，读变量不读样式
  let barTopReady = false;

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

  function glideBar(centering: boolean): void {
    const bar = document.getElementById('toc-bar');
    const activeEl = document.querySelector('.toc-item.active');
    const trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return;
    const linkEl = activeEl.querySelector<HTMLElement>('.toc-link');
    if (!linkEl) return;

    // 高度恒贴合活动项，不做变长/变短动画
    bar.style.height = `${linkEl.offsetHeight}px`;
    const targetTop = linkEl.offsetTop;
    const startTop = barTopReady ? barTop : targetTop;
    const startScroll = trackEl.scrollTop;
    const targetScroll = centering ? centerScrollFor(linkEl, trackEl) : startScroll;

    const dist = Math.max(Math.abs(targetTop - startTop), Math.abs(targetScroll - startScroll));
    if (dist < 1) {
      barTop = targetTop;
      barTopReady = true;
      bar.style.transform = `translateY(${targetTop}px)`;
      return;
    }

    // 时长按两通道位移成比例（0.3–0.55s），与导航下划线「远慢近快」同一原则
    const duration = Math.min(0.55, Math.max(0.3, 0.25 + dist * 0.0012));
    stopBarTween();
    const controls = animate(0, 1, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v: number) => {
        barTop = startTop + (targetTop - startTop) * v;
        bar.style.transform = `translateY(${barTop}px)`;
        trackEl.scrollTop = startScroll + (targetScroll - startScroll) * v;
      },
      onComplete: () => {
        if (barTween === controls) barTween = null;
      },
    });
    barTween = controls;
  }

  /** 瞬移落位（切页后 / 目录抽屉打开）：停 tween、直接写值 */
  function snapBar(): void {
    const bar = document.getElementById('toc-bar');
    const activeEl = document.querySelector('.toc-item.active');
    const trackEl = document.getElementById('toc-list');
    if (!bar || !activeEl || !trackEl) return;
    const linkEl = activeEl.querySelector<HTMLElement>('.toc-link');
    if (!linkEl) return;
    stopBarTween();
    barTop = linkEl.offsetTop;
    barTopReady = true;
    bar.style.height = `${linkEl.offsetHeight}px`;
    bar.style.transform = `translateY(${barTop}px)`;
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

  function updateToc(): void {
    if (headingTops.length === 0) return;

    // 活动项 = 最后一个越过判定线的标题（纯算术）
    const line = window.scrollY + navOffset + 4;
    let bestSlug: string | null = null;
    for (const { slug, top } of headingTops) {
      if (top <= line) bestSlug = slug;
      else break;
    }
    if (!bestSlug) bestSlug = headingTops[0].slug;

    if (bestSlug === lastActiveSlug) return;
    lastActiveSlug = bestSlug;

    document.querySelectorAll('.toc-item').forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-target') === bestSlug);
    });
    // 点击窗口内不抢页面平滑滚动的居中（竖线本身仍跟活动项）；
    // 居中只在这一次切项时发生，到位后不再移动目录
    glideBar(!isClickMode);
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

  // 视口尺寸变化可能改变布局（断点显隐、侧栏宽度），重测一次
  let resizeRaf = false;
  window.addEventListener(
    'resize',
    () => {
      if (!resizeRaf) {
        resizeRaf = true;
        requestAnimationFrame(() => {
          resizeRaf = false;
          measureHeadings();
          updateToc();
        });
      }
    },
    { passive: true },
  );

  const initToc = (): void => {
    measureHeadings();
    updateToc();
  };

  document.addEventListener('DOMContentLoaded', initToc);
  document.addEventListener('swup:content:replace', () => {
    lastActiveSlug = null;
    barTopReady = false; // 目录整块重建，竖线是全新元素
    requestAnimationFrame(initToc);
  });
  initToc();

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
