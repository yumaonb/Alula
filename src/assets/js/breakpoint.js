// breakpoint.js — 共享的移动端/桌面端断点监听器
// 用法：import { onEnterDesktop } from "../../assets/js/breakpoint.js"

const mq = window.matchMedia('(min-width: 769px)');
const subscribers = new Set();
let listening = false;

function handleChange(e) {
  if (!e.matches) return; // 只关心"进入桌面端"
  subscribers.forEach((fn) => fn());
}

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
