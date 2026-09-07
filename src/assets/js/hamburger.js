/**
 * hamburger.js — 汉堡菜单交互
 * 由 NavBar.astro 按需动态 import，无需手动调用
 */
import { onEnterDesktop } from './breakpoint.js';

const OPEN = 'is-open';
const CLOSING_NAV = 'is-closing-nav';
const NO_TRANSITION = 'no-transition';
const NAV_CLOSE_MS = 220;

function getEls() {
  return {
    btn: document.querySelector('.hamburger-btn'),
    dropdown: document.getElementById('mobile-dropdown'),
    overlay: document.querySelector('.mobile-overlay'),
  };
}

/** @param {boolean} opening @param {{ mode?: 'normal' | 'nav' | 'instant' }} [opts] */
function setOpen(opening, { mode = 'normal' } = {}) {
  const { btn, dropdown, overlay } = getEls();
  if (!btn) return;

  const wasOpen = btn.classList.contains(OPEN);
  if (opening === wasOpen) return;

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

function toggle() {
  const { btn } = getEls();
  if (!btn) return;
  setOpen(!btn.classList.contains(OPEN));
}

/** @param {'normal' | 'nav' | 'instant'} [mode] */
function closeIfOpen(mode = 'normal') {
  const { btn } = getEls();
  if (btn?.classList.contains(OPEN)) {
    document.activeElement?.blur();
    setOpen(false, { mode });
  }
}

function onClick(e) {
  if (e.target.closest('.hamburger-btn') || e.target.closest('.mobile-overlay')) {
    toggle();
  } else if (e.target.closest('.nav-logo')) {
    closeIfOpen();
  } else if (e.target.closest('.mobile-link')) {
    closeIfOpen('nav');
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') closeIfOpen();
}

function onSwupVisitStart() {
  closeIfOpen('nav');
}

function onSwupReplace() {
  closeIfOpen('instant');
}

/* 拖宽窗口越过断点进入桌面端时，自动收起汉堡菜单 */
onEnterDesktop(closeIfOpen);

document.addEventListener('click', onClick);
document.addEventListener('keydown', onKeydown);
document.addEventListener('swup:visit:start', onSwupVisitStart);
document.addEventListener('swup:content:replace', onSwupReplace);

export {};
