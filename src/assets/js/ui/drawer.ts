// drawer.ts — 抽屉组件的公共挂载流程（打开入口 / 切页关闭 / 进桌面端关闭 / 销毁归还滚动锁）
// 用法：在组件的 onMount 里 return mountDrawer({ ... })，各组件只保留自己的开关细节
import { unlockBodyScroll } from '../util/body-scroll-lock';

export interface DrawerHooks {
  /** 抽屉根节点，挂到 body 上避免被浮层的层叠上下文压住 */
  modalEl: HTMLElement | null;
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  /** 绑定入口按钮的点击，返回解绑函数；各抽屉的入口容器不同，由组件自己提供 */
  bindEntry: (open: () => void) => () => void;
}

export function mountDrawer({ modalEl, isOpen, open, close, bindEntry }: DrawerHooks): () => void {
  if (modalEl) document.body.appendChild(modalEl);

  const unbindEntry = bindEntry(open);
  const closeIfOpen = (): void => {
    if (isOpen()) close();
  };

  // 复用 NavBar 的共享 matchMedia 监听器，没人挂过才自己兜底
  let unbindDesktop: () => void;
  if (typeof window.__onEnterDesktop === 'function') {
    unbindDesktop = window.__onEnterDesktop(closeIfOpen);
  } else {
    // 兜底监听：与全站 @media (max-width: 768px) 互补，改这里要同步 CSS 里所有 768 断点
    const mq = window.matchMedia('(min-width: 769px)');
    const onChange = (e: MediaQueryListEvent): void => {
      if (e.matches) closeIfOpen();
    };
    mq.addEventListener('change', onChange);
    unbindDesktop = () => mq.removeEventListener('change', onChange);
  }

  // swup 切页时抽屉必然要关（切走前先关闭）
  document.addEventListener('swup:visit:start', closeIfOpen);

  return () => {
    // 组件在打开状态被销毁时把锁还回去，否则计数残留会让页面永久锁死
    if (isOpen()) unlockBodyScroll();
    unbindEntry();
    unbindDesktop();
    document.removeEventListener('swup:visit:start', closeIfOpen);
  };
}
