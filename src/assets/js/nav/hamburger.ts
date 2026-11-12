// hamburger.ts — 汉堡菜单交互（移动端下拉菜单开/关）
// 用法：由 NavBar.astro 在移动端按需动态 import：import "../../assets/js/nav/hamburger"
// 开合动效由 motion 驱动：CSS 只定义开/关两个端点状态（.is-open），每段动画以
// 「飞行中读数」为起点，中断后从屏幕实际位置续接，快速开合不跳变；
// .is-open 是与 NavBar.astro 样式的状态契约（菜单开合视觉全看它），改类名两处同改；
// 收回时顶线先保持、再随尾部淡出（各场景时长见 CLOSE_NORMAL / CLOSE_FOR_NAVIGATION / CLOSE_INSTANT）。
import type { AnimationPlaybackControls } from 'motion';
import { navMatch } from '../../../lib/nav-match';
import { onEnterDesktop } from './breakpoint';
import { lockBodyScroll, unlockBodyScroll } from '../util/body-scroll-lock';
import { cssNum } from '../util/dom';
import { animateLazy as animate, staggerLazy as stagger } from '../util/motion';

const OPEN = 'is-open';

type Ease = [number, number, number, number];

const EASE_OUT: Ease = [0.22, 1, 0.36, 1];
const EASE_MENU: Ease = [0.25, 0.1, 0.25, 1];

const LINE_OPEN = 'rgba(255, 255, 255, 0.12)';
const LINE_CLOSED = 'rgba(255, 255, 255, 0)';

// 三种收起场景：常规 / 切页前快速收起 / 内容替换时直接落位，差异只是时长与缓动
type CloseTiming = {
  dropdown: { duration: number; ease: Ease };
  overlay: number;
  border: { duration: number; delay: number };
};

const CLOSE_NORMAL: CloseTiming = {
  dropdown: { duration: 0.4, ease: EASE_OUT },
  overlay: 0.3,
  border: { duration: 0.2, delay: 0.2 },
};

const CLOSE_FOR_NAVIGATION: CloseTiming = {
  dropdown: { duration: 0.2, ease: EASE_MENU },
  overlay: 0.2,
  border: { duration: 0.1, delay: 0.1 },
};

const CLOSE_INSTANT: CloseTiming = {
  dropdown: { duration: 0, ease: EASE_OUT },
  overlay: 0,
  border: { duration: 0, delay: 0 },
};

const OPEN_TIMING = {
  dropdown: 0.4,
  overlay: 0.3,
  border: 0.25,
  inner: 0.35,
  items: 0.3,
  itemsStagger: 0.04,
};

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

type FromState = { maxHeight: number; overlay: number };

/**
 * 展开编排：dropdown 高度与遮罩从「飞行中读数」走到端点，端点值与 CSS 终态一致，
 * 动画结束（motion 提交最终值）后与 .is-open / 基础态无缝交接；
 * inner / items 每次展开都从收起姿态重播（显式 [0,1] 关键帧）
 */
function openChoreography(from: FromState): void {
  const { dropdown, overlay } = getEls();
  if (!dropdown || !overlay) return;
  cancelAll();

  const inner = dropdown.querySelector<HTMLElement>('.mobile-dropdown-inner');
  // 内层容器缺失就整段编排不做：measure 用可选链能兜底，但动画把它直接传进 animate()
  // 会被 motion 静默跳过（null 主体直接返回），结果是内容直接出现、没有过渡
  if (!inner) {
    console.error('[hamburger] 找不到 .mobile-dropdown-inner，跳过菜单动画');
    return;
  }
  const items = Array.from(dropdown.querySelectorAll<HTMLElement>('.mobile-item'));
  // scrollHeight 不受 max-height 裁切影响，何时量都准；+1px 是 border-top（全局 border-box）
  const height = inner.scrollHeight + 1;

  // 展开前把内层实高写进 --dd-h，CSS 端点状态用它（窗口上限贴实高，大字体缩放不截断）
  dropdown.style.setProperty('--dd-h', `${inner.scrollHeight}px`);
  controls.push(
    animate(
      dropdown,
      { maxHeight: [from.maxHeight, height] },
      {
        duration: OPEN_TIMING.dropdown,
        ease: EASE_OUT,
      },
    ),
    animate(
      dropdown,
      { borderTopColor: LINE_OPEN },
      {
        duration: OPEN_TIMING.border,
        ease: EASE_MENU,
      },
    ),
    animate(
      overlay,
      { opacity: [from.overlay, 1] },
      {
        duration: OPEN_TIMING.overlay,
        ease: EASE_MENU,
      },
    ),
    animate(
      inner,
      { opacity: [0, 1], y: [-8, 0] },
      {
        duration: OPEN_TIMING.inner,
        ease: EASE_OUT,
      },
    ),
  );
  if (items.length) {
    controls.push(
      animate(
        items,
        { opacity: [0, 1], y: [-12, 0] },
        {
          duration: OPEN_TIMING.items,
          delay: stagger(OPEN_TIMING.itemsStagger, { startDelay: OPEN_TIMING.itemsStagger }),
          ease: EASE_MENU,
        },
      ),
    );
  }
}

/** 收起编排：dropdown 高度与遮罩从「飞行中读数」落到关闭端点，场景差异只在时长 */
function closeChoreography(from: FromState, timing: CloseTiming): void {
  const { dropdown, overlay } = getEls();
  if (!dropdown || !overlay) return;
  cancelAll();
  controls.push(
    animate(
      dropdown,
      { maxHeight: [from.maxHeight, 0] },
      {
        duration: timing.dropdown.duration,
        ease: timing.dropdown.ease,
      },
    ),
    animate(
      dropdown,
      { borderTopColor: LINE_CLOSED },
      {
        duration: timing.border.duration,
        delay: timing.border.delay,
        ease: EASE_MENU,
      },
    ),
    animate(
      overlay,
      { opacity: [from.overlay, 0] },
      {
        duration: timing.overlay,
        ease: EASE_MENU,
      },
    ),
  );
}

/** 翻类 + aria + tabindex + 滚动锁；三层缺一就整体放弃 */
function applyMenuState(opening: boolean): boolean {
  const { btn, dropdown, overlay } = getEls();
  // 三层缺一就整件事不做：只翻按钮类而不写面板 / 遮罩，会留下
  // 「按钮显示已开、页面被锁、却没有菜单」的错乱态
  if (!btn || !dropdown || !overlay) {
    console.error('[hamburger] 汉堡菜单三层不全，放弃本次开合', {
      btn: !!btn,
      dropdown: !!dropdown,
      overlay: !!overlay,
    });
    return false;
  }
  btn.classList.toggle(OPEN, opening);
  dropdown.classList.toggle(OPEN, opening);
  overlay.classList.toggle(OPEN, opening);
  btn.setAttribute('aria-expanded', String(opening));
  dropdown.setAttribute('aria-hidden', String(!opening));
  overlay.setAttribute('aria-hidden', String(!opening));
  dropdown.querySelectorAll('.mobile-link').forEach((link) => {
    link.setAttribute('tabindex', opening ? '0' : '-1');
  });
  if (opening) lockBodyScroll('hamburger');
  else unlockBodyScroll('hamburger');
  return true;
}

function readFlightState(): FromState | null {
  const { dropdown, overlay } = getEls();
  if (!dropdown || !overlay) return null;
  // 先读飞行中值再翻类：翻类后 computed 会变成端点态，飞行中的位置就丢了
  return {
    maxHeight: cssNum(dropdown, 'max-height'),
    overlay: cssNum(overlay, 'opacity'),
  };
}

function openMenu(): void {
  const { btn } = getEls();
  if (!btn || btn.classList.contains(OPEN)) return;
  const from = readFlightState();
  if (!from) return;
  if (!applyMenuState(true)) return;
  openChoreography(from);
}

function closeMenu(timing: CloseTiming): void {
  const { btn, dropdown } = getEls();
  if (!btn || !btn.classList.contains(OPEN)) return;
  // 只收回菜单内的焦点：搜索框在菜单外面，盲调 blur 会在手机上打字打到一半被抢走焦点
  const active = document.activeElement;
  if (active instanceof HTMLElement && dropdown?.contains(active)) active.blur();
  const from = readFlightState();
  if (!from) return;
  if (!applyMenuState(false)) return;
  closeChoreography(from, timing);
}

function closeNormal(): void {
  closeMenu(CLOSE_NORMAL);
}

function closeForNavigation(): void {
  closeMenu(CLOSE_FOR_NAVIGATION);
}

function closeInstant(): void {
  closeMenu(CLOSE_INSTANT);
}

function toggle(): void {
  const { btn } = getEls();
  if (!btn) return;
  if (btn.classList.contains(OPEN)) closeNormal();
  else openMenu();
}

function onClick(e: Event): void {
  // e.target 可能是文本节点（点正踩在菜单项文字上），它没有 closest，直接调会抛错
  const raw = e.target as Node | null;
  const target = raw instanceof Element ? raw : (raw?.parentElement ?? null);
  if (!target) return;
  if (target.closest('.hamburger-btn') || target.closest('.mobile-overlay')) {
    toggle();
  } else if (target.closest('.nav-logo')) {
    closeNormal();
  } else if (target.closest('.mobile-link')) {
    closeForNavigation();
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeNormal();
}

function onSwupVisitStart(): void {
  closeForNavigation();
}

function onSwupReplace(): void {
  closeInstant();
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
onEnterDesktop(closeNormal);

syncActive();
document.addEventListener('click', onClick);
document.addEventListener('keydown', onKeydown);
document.addEventListener('swup:visit:start', onSwupVisitStart);
document.addEventListener('swup:content:replace', onSwupReplace);
document.addEventListener('swup:content:replace', syncActive);
