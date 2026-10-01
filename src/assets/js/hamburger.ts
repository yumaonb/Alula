// hamburger.ts — 汉堡菜单交互（移动端下拉菜单开/关）
// 用法：由 NavBar.astro 在移动端按需动态 import
import { onEnterDesktop } from './breakpoint';

const OPEN = 'is-open';
const CLOSING_NAV = 'is-closing-nav';
const NO_TRANSITION = 'no-transition';
const NAV_CLOSE_MS = 220;

type MenuMode = 'normal' | 'nav' | 'instant';

function getEls() {
  return {
    btn: document.querySelector('.hamburger-btn'),
    dropdown: document.getElementById('mobile-dropdown'),
    overlay: document.querySelector('.mobile-overlay'),
  };
}

function setOpen(opening: boolean, { mode = 'normal' }: { mode?: MenuMode } = {}): void {
  const { btn, dropdown, overlay } = getEls();
  if (!btn) return;

  const wasOpen = btn.classList.contains(OPEN);
  if (opening === wasOpen) return;

  // 展开前量一次内层实高写进 --dd-h，窗口上限贴实高：
  // 系统大字体缩放或导航加项时，不会被固定上限截断底部（scrollHeight 不受
  // max-height 裁切影响，何时量都准）
  if (opening && dropdown) {
    const inner = dropdown.querySelector<HTMLElement>('.mobile-dropdown-inner');
    dropdown.style.setProperty('--dd-h', `${inner?.scrollHeight ?? 380}px`);
  }

  const navClose = !opening && mode === 'nav';
  const instant = !opening && mode === 'instant';

  if (navClose && wasOpen) {
    btn.classList.add(CLOSING_NAV);
    dropdown?.classList.add(CLOSING_NAV);
    overlay?.classList.add(CLOSING_NAV);
  }

  if (instant && wasOpen) {
    btn.classList.add(NO_TRANSITION);
    dropdown?.classList.add(NO_TRANSITION);
    overlay?.classList.add(NO_TRANSITION);
    void dropdown?.offsetHeight;
  }

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

  if (navClose) {
    window.setTimeout(() => {
      btn.classList.remove(CLOSING_NAV);
      dropdown?.classList.remove(CLOSING_NAV);
      overlay?.classList.remove(CLOSING_NAV);
    }, NAV_CLOSE_MS);
  }

  if (instant && !opening) {
    requestAnimationFrame(() => {
      btn.classList.remove(NO_TRANSITION);
      dropdown?.classList.remove(NO_TRANSITION);
      overlay?.classList.remove(NO_TRANSITION);
    });
  }
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
  const target = e.target as HTMLElement | null;
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

/* 拖宽窗口越过断点进入桌面端时，自动收起汉堡菜单 */
onEnterDesktop(closeIfOpen);

document.addEventListener('click', onClick);
document.addEventListener('keydown', onKeydown);
document.addEventListener('swup:visit:start', onSwupVisitStart);
document.addEventListener('swup:content:replace', onSwupReplace);
