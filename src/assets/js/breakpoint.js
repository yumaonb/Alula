/**
 * breakpoint.js — 共享的移动端/桌面端断点监听
 * 断点与 CSS 保持一致：≤768px 为移动端，≥769px 为桌面端。
 * 基于 matchMedia 的 change 事件，仅在跨越断点的那一刻触发一次，
 * 不会像 resize 监听那样在拖拽窗口时每帧执行。
 */

const mq = window.matchMedia('(min-width: 769px)');
const subscribers = new Set();
let listening = false;

function handleChange(e) {
  if (!e.matches) return; // 只关心"进入桌面端"
  subscribers.forEach((fn) => fn());
}

/**
 * 订阅"进入桌面端"事件，返回取消订阅函数。
 */
export function onEnterDesktop(fn) {
  subscribers.add(fn);
  if (!listening) {
    listening = true;
    mq.addEventListener('change', handleChange);
  }
  return () => {
    subscribers.delete(fn);
  };
}

// 暴露给 is:inline 脚本（如 TocModal）使用；它们无法走模块 import
if (typeof window !== 'undefined') {
  window.__onEnterDesktop = onEnterDesktop;
}
