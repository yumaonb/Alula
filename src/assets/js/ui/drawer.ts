// drawer.ts — 抽屉公共流程：开合状态、滚动锁、焦点归还、关闭来源、切页与跨界关闭
// 用法：在组件的 onMount 里 return mountDrawer({ ... })；开合逻辑用 createDrawer({ ... }) 建
//
// 目录抽屉与筛选抽屉的外壳不同（一个常驻目录节点、一个把侧栏筛选搬进抽屉），
// 但「怎么算打开」「打开时锁滚动 / 记住焦点并聚焦关闭按钮」「Esc 与遮罩关闭」
// 「关闭时解锁并归还焦点」这套流程完全一致，改一处忘另一处就会出现
// 锁了滚动没解锁、焦点丢到 body、Esc 在某个抽屉里不响应之类的不对称问题，
// 所以只在这里写一份。组件只提供差异：入口按钮 id、打开前的准备、搬节点的时机。
import { lockBodyScroll, unlockBodyScroll } from '../util/body-scroll-lock';

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

export interface DrawerControllerHooks {
  modalEl: () => HTMLElement | null;
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  /** 入口按钮 id：开合时同步它的 aria-expanded */
  fabId: string;
  /** 打开前的准备与检查，返回 false 放弃本次打开（如抽屉里没有内容可展示） */
  canOpen?: () => boolean;
  /** 锁滚动之前执行（把要展示的节点搬进抽屉） */
  onBeforeOpen?: () => void;
  /** 锁滚动之后、聚焦关闭按钮之前执行（重测几何） */
  onOpened?: () => void;
  /** 解锁滚动之后、归还焦点之前执行（把搬进来的节点放回原位） */
  onClosed?: () => void;
  /** 点中这些选择器也关闭抽屉（遮罩、关闭按钮、抽屉里的跳转链接） */
  closeOn: string[];
  /** 打开后要聚焦的元素 */
  focusOn: string;
}

export interface DrawerController {
  open: () => void;
  close: () => void;
  /** 挂到 <svelte:window onkeydown> */
  onKeydown: (e: KeyboardEvent) => void;
  /** 挂到抽屉根节点的 onclick */
  onPanelClick: (e: Event) => void;
}

export function createDrawer({
  modalEl,
  isOpen,
  setOpen,
  fabId,
  canOpen,
  onBeforeOpen,
  onOpened,
  onClosed,
  closeOn,
  focusOn,
}: DrawerControllerHooks): DrawerController {
  let lastFocus: HTMLElement | null = null;

  function syncFabExpanded(open: boolean): void {
    document.getElementById(fabId)?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function open(): void {
    if (isOpen()) return;
    if (canOpen && !canOpen()) return;
    onBeforeOpen?.();
    setOpen(true);
    syncFabExpanded(true);
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockBodyScroll();
    onOpened?.();
    // 等抽屉过渡开始后聚焦：立刻聚焦会让浏览器把焦点滚进面板，抢掉开合动画
    requestAnimationFrame(() => {
      modalEl()?.querySelector<HTMLElement>(focusOn)?.focus();
    });
  }

  function close(): void {
    if (!isOpen()) return;
    setOpen(false);
    syncFabExpanded(false);
    unlockBodyScroll();
    onClosed?.();
    lastFocus?.focus();
    lastFocus = null;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && isOpen()) close();
  }

  function onPanelClick(e: Event): void {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (closeOn.some((selector) => target.closest(selector))) close();
  }

  return { open, close, onKeydown, onPanelClick };
}
