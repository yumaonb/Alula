// breakpoint.ts — 共享的移动端/桌面端断点监听器
// 用法：import { onEnterDesktop } from "./breakpoint"
// 769 与全站 @media (max-width: 768px) 互补；改 768/769 分界要同步 CSS 里所有 768/769 断点，
// 以及各自建媒体查询探测当前状态的各模块：src/features/posts/scripts/drawer.ts、src/features/posts/scripts/posts-shell.ts、
// src/features/posts/scripts/row-state.ts、nav/swup-widgets.ts、layout/NavBar.astro
const mq = window.matchMedia('(min-width: 769px)');
const subscribers = new Set<() => void>();
let listening = false;

function handleChange(e: MediaQueryListEvent): void {
  // 只关心"进入桌面端"
  if (!e.matches) return;
  // 逐个隔离：某个订阅者抛错不该让其余订阅者停在旧状态，
  // 异常冒到 matchMedia 回调后根源会被埋掉，这里带上是谁失败的
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error('[breakpoint] 断点订阅者执行失败', fn, err);
    }
  });
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
