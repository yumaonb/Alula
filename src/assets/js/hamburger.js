/**
 * hamburger.js — 汉堡菜单交互
 * 由 NavBar.astro 按需动态 import，无需手动调用
 */
import { onEnterDesktop } from './breakpoint.js';

const OPEN = 'is-open';

function getEls() {
  return {
    btn: document.querySelector('.hamburger-btn'),
    dropdown: document.getElementById('mobile-dropdown'),
    overlay: document.querySelector('.mobile-overlay'),
  };
}

function toggle() {
  const { btn, dropdown, overlay } = getEls();
  if (!btn) return;
  const opening = !btn.classList.contains(OPEN);
  btn.classList.toggle(OPEN, opening);
  dropdown?.classList.toggle(OPEN, opening);
  overlay?.classList.toggle(OPEN, opening);
  btn.setAttribute('aria-expanded', opening);
  dropdown?.setAttribute('aria-hidden', String(!opening));
  overlay?.setAttribute('aria-hidden', String(!opening));
  dropdown?.querySelectorAll('.mobile-link').forEach(link => {
    link.setAttribute('tabindex', opening ? '0' : '-1');
  });
  document.body.style.overflow = opening ? 'hidden' : '';
}

function closeIfOpen() {
  const { btn } = getEls();
  if (btn?.classList.contains(OPEN)) {
    document.activeElement?.blur();
    toggle();
  }
}

function onClick(e) {
  if (e.target.closest('.hamburger-btn') || e.target.closest('.mobile-overlay')) {
    toggle();
  } else if (e.target.closest('.nav-logo')) {
    closeIfOpen();
  } else if (e.target.closest('.mobile-link')) {
    closeIfOpen();
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') closeIfOpen();
}

function onSwupReplace() {
  closeIfOpen();
}

/* 拖宽窗口越过断点进入桌面端时，自动收起汉堡菜单 */
onEnterDesktop(closeIfOpen);

document.addEventListener('click', onClick);
document.addEventListener('keydown', onKeydown);
window.addEventListener('swup:content:replace', onSwupReplace);

export {};