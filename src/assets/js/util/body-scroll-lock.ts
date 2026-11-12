// body-scroll-lock.ts — 页面滚动锁（按责任人记账的引用计数）
// 用法：import { lockBodyScroll, unlockBodyScroll } from '../../assets/js/util/body-scroll-lock'
//
// 多个浮层可能同时存在：直接的开关式写入会让先开的浮层被后关的浮层解锁。
// 这里按「谁锁的」分别计数——某个浮层漏解时，日志能指出是哪一层，
// 而不是只留下一个谁也认不出的计数。全站只此一处写 body 的 overflow。

/** 责任人 → 它当前的锁次数 */
const holders = new Map<string, number>();

function total(): number {
  let sum = 0;
  for (const n of holders.values()) sum += n;
  return sum;
}

export function lockBodyScroll(owner: string): void {
  holders.set(owner, (holders.get(owner) ?? 0) + 1);
  if (total() === 1) document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll(owner: string): void {
  const held = holders.get(owner);
  // 没锁过就来解锁：调用方自己的状态与这里对不上，直接说出来
  if (held === undefined) {
    console.error(`[body-scroll-lock] ${owner} 解锁了自己没持有的锁`);
    return;
  }
  if (held > 1) holders.set(owner, held - 1);
  else holders.delete(owner);
  if (total() === 0) document.body.style.overflow = '';
}

/** 切页后所有浮层必然已销毁，锁一定该放：无条件清零，并把赖着不走的责任人记下来 */
function resetBodyScrollLock(): void {
  if (holders.size > 0) {
    console.error('[body-scroll-lock] 切页时仍有未释放的锁', [...holders.keys()].join(', '));
  }
  holders.clear();
  document.body.style.overflow = '';
}

// 模块可能被构建期引入（数据层会走到这里），浏览器 API 只能出现在真浏览器里
if (typeof document !== 'undefined') {
  document.addEventListener('swup:content:replace', resetBodyScrollLock);
}
