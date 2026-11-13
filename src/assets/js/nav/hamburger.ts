// hamburger.ts — 汉堡菜单交互（移动端下拉菜单开/关）
// 用法：由 NavBar.astro 在移动端按需动态 import：import "../../assets/js/nav/hamburger"
// 开合动效经 util/expand-collapse.ts 共享编排（窗口与刚体同曲线同长，CSS 只留 .is-open
// 端点态，中断从飞行中位置续接，快速开合不跳变）；遮罩与顶线是配套元素、不在编排内，
// 由本文件单独驱动，收回时顶线先保持、再随尾部淡出（时长见各场景常量）。
// .is-open 是与 NavBar.astro 样式的状态契约（菜单开合视觉全看它），改类名两处同改。
import type { AnimationPlaybackControls } from 'motion';
import { navMatch } from '../../../lib/nav-match';
import { GROUP_DURATION, toggleGroup } from '../util/expand-collapse';
import { onEnterDesktop } from './breakpoint';
import { lockBodyScroll, unlockBodyScroll } from '../util/body-scroll-lock';
import { cssNum } from '../util/dom';
import { animateLazy as animate } from '../util/motion';

const OPEN = 'is-open';

type Ease = [number, number, number, number];

const EASE_MENU: Ease = [0.25, 0.1, 0.25, 1];

const LINE_OPEN = 'rgba(255, 255, 255, 0.12)';
const LINE_CLOSED = 'rgba(255, 255, 255, 0)';

// 三种收起场景：常规 / 切页前快速收起 / 内容替换时直接落位，差异只是时长
type CloseTiming = {
  dropdown: number;
  overlay: number;
  border: { duration: number; delay: number };
};

const CLOSE_NORMAL: CloseTiming = {
  dropdown: GROUP_DURATION,
  overlay: 0.3,
  border: { duration: 0.2, delay: 0.2 },
};

const CLOSE_FOR_NAVIGATION: CloseTiming = {
  dropdown: 0.2,
  overlay: 0.2,
  border: { duration: 0.1, delay: 0.1 },
};

const CLOSE_INSTANT: CloseTiming = {
  dropdown: 0,
  overlay: 0,
  border: { duration: 0, delay: 0 },
};

const OPEN_TIMING = {
  overlay: 0.3,
  border: 0.25,
};

// 遮罩与顶线的配套动画；窗口的动画由共享编排自己记录，不在此列
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

/** 翻类 + aria + tabindex + 滚动锁；在共享编排读飞行中值之后由 onState 调用。三层缺一就整体放弃 */
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

function openMenu(): void {
  const { btn, dropdown, overlay } = getEls();
  if (!btn || btn.classList.contains(OPEN)) return;
  if (!dropdown || !overlay) return;
  const inner = dropdown.querySelector<HTMLElement>('.mobile-dropdown-inner');
  // 内层容器缺失就整段开合不做：高度量不出，动画也没主体
  if (!inner) {
    console.error('[hamburger] 找不到 .mobile-dropdown-inner，跳过菜单开合');
    return;
  }
  // scrollHeight 不受 max-height 裁切影响，何时量都准；+1px 是 border-top（全局 border-box）
  const height = inner.scrollHeight + 1;
  // 展开前把内层实高写进 --dd-h，CSS 端点状态用它（窗口上限贴实高，大字体缩放不截断）
  dropdown.style.setProperty('--dd-h', `${inner.scrollHeight}px`);
  // 遮罩的飞行中读数必须在翻类前取：onState 翻类后 computed 即端点值
  const fromOverlay = cssNum(overlay, 'opacity');
  cancelAll();
  controls.push(
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
      { opacity: [fromOverlay, 1] },
      {
        duration: OPEN_TIMING.overlay,
        ease: EASE_MENU,
      },
    ),
  );
  toggleGroup({
    wrap: dropdown,
    clip: inner,
    height,
    open: true,
    onState: () => applyMenuState(true),
  });
}

function closeMenu(timing: CloseTiming): void {
  const { btn, dropdown, overlay } = getEls();
  if (!btn || !btn.classList.contains(OPEN) || !dropdown || !overlay) return;
  // 只收回菜单内的焦点：搜索框在菜单外面，盲调 blur 会在手机上打字打到一半被抢走焦点
  const active = document.activeElement;
  if (active instanceof HTMLElement && dropdown?.contains(active)) active.blur();
  const inner = dropdown.querySelector<HTMLElement>('.mobile-dropdown-inner');
  const fromOverlay = cssNum(overlay, 'opacity');
  cancelAll();
  controls.push(
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
      { opacity: [fromOverlay, 0] },
      {
        duration: timing.overlay,
        ease: EASE_MENU,
      },
    ),
  );
  if (!inner) {
    applyMenuState(false);
    dropdown.style.maxHeight = '0px';
    return;
  }
  toggleGroup({
    wrap: dropdown,
    clip: inner,
    height: inner.scrollHeight + 1,
    open: false,
    duration: timing.dropdown,
    onState: () => applyMenuState(false),
  });
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
