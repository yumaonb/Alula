// hamburger.ts — 汉堡菜单交互（移动端下拉菜单开/关）
// 用法：由 NavBar.astro 在移动端按需动态 import：import "../../assets/js/hamburger"
// 开合动效由 motion 驱动：CSS 只定义开/关两个端点状态（.is-open），每段动画以
// 「飞行中读数」为起点，中断后从屏幕实际位置续接，快速开合不跳变；
// 收回时顶线先保持、再随尾部淡出（时长/延迟见 CLOSE_TIMING）。
import { animate, stagger } from 'motion';
import type { AnimationPlaybackControls } from 'motion';
import { navMatch } from '../../lib/nav-match';
import { onEnterDesktop } from './breakpoint';

const OPEN = 'is-open';

type MenuMode = 'normal' | 'nav' | 'instant';

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

const LINE_OPEN = 'rgba(255, 255, 255, 0.12)';
const LINE_CLOSED = 'rgba(255, 255, 255, 0)';

// 三种收起模式：常规 / 切页前快速收起 / 内容替换时直接落位
const CLOSE_TIMING: Record<
  MenuMode,
  { dropdown: number; overlay: number; border: { duration: number; delay: number } }
> = {
  normal: { dropdown: 0.4, overlay: 0.3, border: { duration: 0.2, delay: 0.2 } },
  nav: { dropdown: 0.2, overlay: 0.2, border: { duration: 0.1, delay: 0.1 } },
  instant: { dropdown: 0, overlay: 0, border: { duration: 0, delay: 0 } },
};

const OPEN_TIMING = {
  dropdown: 0.4,
  overlay: 0.3,
  border: 0.25,
  inner: 0.35,
  items: 0.3,
  itemsStagger: 0.04,
};

const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const RM = { reduceMotion: REDUCE_MOTION };

/** 当前生效值（含动画进行中 / 已提交的值），作为下一段动画的起点 */
function cssNum(el: HTMLElement, prop: string): number {
  return parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
}

let controls: AnimationPlaybackControls[] = [];

function cancelAll(): void {
  for (const control of controls) control.cancel();
  controls = [];
}

function getEls() {
  return {
    btn: document.querySelector<HTMLElement>('.hamburger-btn'),
    dropdown: document.getElementById('mobile-dropdown'),
    overlay: document.querySelector<HTMLElement>('.mobile-overlay'),
  };
}

/**
 * 开合编排：dropdown 高度与遮罩从「飞行中读数」走到端点，端点值与 CSS 终态一致，
 * 动画结束（motion 提交最终值）后与 .is-open / 基础态无缝交接；
 * inner / items 每次展开都从收起姿态重播（显式 [0,1] 关键帧）
 */
function runChoreography(
  opening: boolean,
  mode: MenuMode,
  from: { maxHeight: number; overlay: number }
): void {
  const { dropdown, overlay } = getEls();
  if (!dropdown || !overlay) return;
  cancelAll();

  const inner = dropdown.querySelector<HTMLElement>('.mobile-dropdown-inner');
  const items = Array.from(dropdown.querySelectorAll<HTMLElement>('.mobile-item'));
  // scrollHeight 不受 max-height 裁切影响，何时量都准；+1px 是 border-top（全局 border-box）
  const height = (inner?.scrollHeight ?? 380) + 1;

  if (opening) {
    // 展开前把内层实高写进 --dd-h，CSS 端点状态用它（窗口上限贴实高，大字体缩放不截断）
    dropdown.style.setProperty('--dd-h', `${inner?.scrollHeight ?? 380}px`);
    controls.push(
      animate(dropdown, { maxHeight: [from.maxHeight, height] }, {
        ...RM,
        duration: OPEN_TIMING.dropdown,
        ease: EASE_OUT,
      }),
      animate(dropdown, { borderTopColor: LINE_OPEN }, {
        ...RM,
        duration: OPEN_TIMING.border,
        ease: EASE,
      }),
      animate(overlay, { opacity: [from.overlay, 1] }, {
        ...RM,
        duration: OPEN_TIMING.overlay,
        ease: EASE,
      }),
      animate(inner, { opacity: [0, 1], y: [-8, 0] }, {
        ...RM,
        duration: OPEN_TIMING.inner,
        ease: EASE_OUT,
      })
    );
    if (items.length) {
      controls.push(
        animate(items, { opacity: [0, 1], y: [-12, 0] }, {
          ...RM,
          duration: OPEN_TIMING.items,
          delay: stagger(OPEN_TIMING.itemsStagger, { startDelay: OPEN_TIMING.itemsStagger }),
          ease: EASE,
        })
      );
    }
    return;
  }

  const timing = CLOSE_TIMING[mode];
  controls.push(
    animate(dropdown, { maxHeight: [from.maxHeight, 0] }, {
      ...RM,
      duration: timing.dropdown,
      ease: mode === 'nav' ? EASE : EASE_OUT,
    }),
    animate(dropdown, { borderTopColor: LINE_CLOSED }, {
      ...RM,
      duration: timing.border.duration,
      delay: timing.border.delay,
      ease: EASE,
    }),
    animate(overlay, { opacity: [from.overlay, 0] }, {
      ...RM,
      duration: timing.overlay,
      ease: EASE,
    })
  );
}

function setOpen(opening: boolean, { mode = 'normal' }: { mode?: MenuMode } = {}): void {
  const { btn, dropdown, overlay } = getEls();
  if (!btn) return;

  const wasOpen = btn.classList.contains(OPEN);
  if (opening === wasOpen) return;

  // 先读飞行中值再翻类：翻类后 computed 会变成端点态，飞行中的位置就丢了
  const from = {
    maxHeight: dropdown ? cssNum(dropdown, 'max-height') : 0,
    overlay: overlay ? cssNum(overlay, 'opacity') : 0,
  };

  btn.classList.toggle(OPEN, opening);
  dropdown?.classList.toggle(OPEN, opening);
  overlay?.classList.toggle(OPEN, opening);
  btn.setAttribute('aria-expanded', String(opening));
  dropdown?.setAttribute('aria-hidden', String(!opening));
  overlay?.setAttribute('aria-hidden', String(!opening));
  dropdown?.querySelectorAll('.mobile-link').forEach((link) => {
    link.setAttribute('tabindex', opening ? '0' : '-1');
  });
  document.body.style.overflow = opening ? 'hidden' : '';

  runChoreography(opening, mode, from);
}

function toggle(): void {
  const { btn } = getEls();
  if (!btn) return;
  setOpen(!btn.classList.contains(OPEN));
}

function closeIfOpen(mode: MenuMode = 'normal'): void {
  const { btn } = getEls();
  if (btn?.classList.contains(OPEN)) {
    (document.activeElement as HTMLElement | null)?.blur();
    setOpen(false, { mode });
  }
}

function onClick(e: Event): void {
  // e.target 可能是文本节点（点正踩在菜单项文字上），它没有 closest，直接调会抛错
  const raw = e.target as Node | null;
  const target = raw instanceof Element ? raw : raw?.parentElement ?? null;
  if (!target) return;
  if (target.closest('.hamburger-btn') || target.closest('.mobile-overlay')) {
    toggle();
  } else if (target.closest('.nav-logo')) {
    closeIfOpen();
  } else if (target.closest('.mobile-link')) {
    closeIfOpen('nav');
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeIfOpen();
}

function onSwupVisitStart(): void {
  closeIfOpen('nav');
}

function onSwupReplace(): void {
  closeIfOpen('instant');
}

/** 菜单项当前页高亮：首屏由服务端渲染（SSR 的 is-active），swup 切页后重算 */
function syncActive(): void {
  document.querySelectorAll<HTMLAnchorElement>('.mobile-link').forEach((link) => {
    const active = navMatch(link.getAttribute('href') ?? '', window.location.pathname);
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

/* 拖宽窗口越过断点进入桌面端时，自动收起汉堡菜单 */
onEnterDesktop(closeIfOpen);

syncActive();
document.addEventListener('click', onClick);
document.addEventListener('keydown', onKeydown);
document.addEventListener('swup:visit:start', onSwupVisitStart);
document.addEventListener('swup:content:replace', onSwupReplace);
document.addEventListener('astro:after-swap', syncActive);
