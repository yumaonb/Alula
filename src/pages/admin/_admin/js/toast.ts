// toast.ts — 后台顶部提示队列（堆叠 / 进度条 / 悬停暂停 / 自动消失）
// 用法：import { toast } from '../js/toast'（js 目录内用 "./toast"）
//
// 提示挂在 #admin-toast-stack（AdminLayout 渲染，#swup 之外、切页不丢）。
// 新的排在下边、最旧的最先消失，上方一条收起时其余整体上滑；
// 悬停（或键盘聚焦）暂停计时与进度条，移开按剩余时间继续。

export type ToastKind = 'ok' | 'error';

export interface ToastAction {
  label: string;
  href: string;
}

export interface ToastOptions {
  /** 停留毫秒数；缺省按类型取 DURATION，带操作链接时至少 6000 */
  duration?: number;
  /** 尾部操作（如「查看提交」），新标签打开 */
  action?: ToastAction;
}

/** 无操作链接的默认停留：ok 短、error 长，让人来得及读完 */
const DURATION: Record<ToastKind, number> = { ok: 3500, error: 6000 };
/** 带操作链接时至少留这么久，不然链接点不到 */
const DURATION_WITH_ACTION = 6000;
/** 出入场时长，与 variables.css 的 --t-toast 同值（两处须同改） */
const MOTION_MS = 240;
/** 最多同屏几条，超出挤掉最旧的（走收起动画，下方整体上滑） */
const MAX_STACK = 5;

const ICONS: Record<ToastKind, string> = {
  ok: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 7.3-5.4 5.4a1 1 0 0 1-1.4 0l-2.4-2.4 1.4-1.4 1.7 1.7 4.7-4.7Z"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.5 12.1-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4 2.1-2.1-2.1-2.1 1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4-2.1 2.1Z"/></svg>',
};

interface ToastItem {
  el: HTMLDivElement;
  /** 剩余毫秒；timer 为 null 时才是有效值 */
  remaining: number;
  /** 本次计时开始的时刻；timer 为 null 时无效 */
  startedAt: number;
  timer: number | null;
}

const items: ToastItem[] = [];
let stack: HTMLDivElement | null = null;

function getStack(): HTMLDivElement | null {
  if (!stack || !stack.isConnected)
    stack = document.getElementById('admin-toast-stack') as HTMLDivElement | null;
  return stack;
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function start(item: ToastItem): void {
  item.startedAt = Date.now();
  item.timer = window.setTimeout(() => dismiss(item), item.remaining);
}

function pause(item: ToastItem): void {
  if (item.timer === null) return;
  item.remaining -= Date.now() - item.startedAt;
  window.clearTimeout(item.timer);
  item.timer = null;
  item.el.classList.add('is-paused');
}

function resume(item: ToastItem): void {
  if (item.timer !== null) return;
  item.el.classList.remove('is-paused');
  if (item.remaining <= 0) {
    dismiss(item);
    return;
  }
  start(item);
}

/** 收起并从队列摘除；instant 跳过收起动画（减动效偏好） */
function dismiss(item: ToastItem, instant = false): void {
  const idx = items.indexOf(item);
  if (idx < 0) return;
  items.splice(idx, 1);
  if (item.timer !== null) window.clearTimeout(item.timer);
  item.timer = null;

  const el = item.el;
  if (instant || reducedMotion()) {
    el.remove();
    return;
  }

  // 先把高度钉住再置 0：内联样式压过类，靠 transition 从钉住值滑到 0 才平滑；
  // 其余提示随之整体上滑
  el.style.height = `${el.offsetHeight}px`;
  void el.offsetHeight;
  el.style.height = '0px';
  el.classList.add('is-leaving');
  window.setTimeout(() => el.remove(), MOTION_MS + 20);
}

/** 入场：整条全高入列，右侧滑入由 CSS admin-toast-in 负责；新提示排在栈底，高度不影响上面条目 */
function enter(item: ToastItem, container: HTMLDivElement): void {
  container.appendChild(item.el);
}

export function toast(text: string, kind: ToastKind = 'ok', options: ToastOptions = {}): void {
  const container = getStack();
  if (!container) return;

  const duration =
    options.duration ??
    (options.action ? Math.max(DURATION[kind], DURATION_WITH_ACTION) : DURATION[kind]);

  const el = document.createElement('div');
  el.className = `admin-toast is-${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');

  const body = document.createElement('div');
  body.className = 'admin-toast-body';

  const icon = document.createElement('span');
  icon.className = 'admin-toast-ico';
  icon.innerHTML = ICONS[kind];

  const textEl = document.createElement('span');
  textEl.className = 'admin-toast-text';
  textEl.textContent = text;

  body.appendChild(icon);
  body.appendChild(textEl);

  if (options.action) {
    const action = document.createElement('a');
    action.className = 'admin-toast-action';
    action.href = options.action.href;
    action.target = '_blank';
    action.rel = 'noopener noreferrer';
    action.textContent = options.action.label;
    body.appendChild(action);
  }

  const bar = document.createElement('span');
  bar.className = 'admin-toast-bar';
  bar.style.animationDuration = `${duration}ms`;

  body.appendChild(bar);
  el.appendChild(body);

  const item: ToastItem = { el, remaining: duration, startedAt: 0, timer: null };

  // 悬停或聚焦期间不消失：焦点移到内部链接也算在内（focusout 只在焦点离开本条时触发）
  el.addEventListener('mouseenter', () => pause(item));
  el.addEventListener('mouseleave', () => resume(item));
  el.addEventListener('focusin', () => pause(item));
  el.addEventListener('focusout', (e) => {
    if (!el.contains(e.relatedTarget as Node | null)) resume(item);
  });

  items.unshift(item);
  while (items.length > MAX_STACK) dismiss(items[items.length - 1]);
  enter(item, container);
  start(item);
}
