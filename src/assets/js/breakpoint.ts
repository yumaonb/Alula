// breakpoint.ts — 共享的移动端/桌面端断点监听器
// 用法：import { onEnterDesktop } from "../../assets/js/breakpoint"

const mq = window.matchMedia('(min-width: 769px)');
const subscribers = new Set<() => void>();
let listening = false;

function handleChange(e: MediaQueryListEvent): void {
  if (!e.matches) return; // 只关心"进入桌面端"
  subscribers.forEach((fn) => fn());
}

export function onEnterDesktop(fn: () => void): () => void {
  subscribers.add(fn);
  if (!listening) {
    listening = true;
    mq.addEventListener('change', handleChange);
  }
  return () => {
    subscribers.delete(fn);
  };
}

// 同时挂到 window：目录 / 筛选抽屉（布局层岛）从全局取共享监听器
if (typeof window !== 'undefined') {
  window.__onEnterDesktop = onEnterDesktop;
}
