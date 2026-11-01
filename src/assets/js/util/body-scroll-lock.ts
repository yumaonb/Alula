// body-scroll-lock.ts — 页面滚动锁（引用计数）
// 用法：import { lockBodyScroll, unlockBodyScroll } from '../../assets/js/util/body-scroll-lock'
// 多个浮层可能同时存在：直接的开关式写入会让先开的浮层被后关的浮层解锁，
// 这里按计数决定何时真正恢复滚动，全站只此一处写 body 的 overflow。
let lockCount = 0;

export function lockBodyScroll(): void {
  lockCount += 1;
  if (lockCount === 1) document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll(): void {
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) document.body.style.overflow = '';
}
