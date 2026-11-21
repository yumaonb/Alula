// dirty-guard.ts — 后台「未暂存修改」的离开拦截（站内链接点击 + 刷新/关页）
// 用法：AdminLayout 副作用引入：import './js/dirty-guard'
// 表单控制器（data-form.ts / pages.ts 的编辑器）在暂存成功后 import { retakeBaseline }
// 重拍基线：暂存不改控件值，不重拍会一直显示脏。
//
// 两道拦截各管一段：
// - 后台内跳后台走 swup 换内容，不触发浏览器卸载，靠捕获阶段拦链接点击；
// - 刷新 / 关页 / 跳出后台（如「返回首页」的整页加载）靠 beforeunload。
// 未暂存编辑只活在表单控件里，换内容或整页加载都会丢；
// 已暂存只活在 adminStore 内存里，整页加载丢、swup 切页不丢。
//
// 「未暂存」判定只有一个来源——通用基线：对 #swup 内的 input / textarea / select
// 拍初始快照，任一控件偏离即脏，新页面不登记也能默认获得离开提示；
// 新增控件由 MutationObserver 在入 DOM 瞬间拍基线（JS 晚渲染、动态生成的控件不漏拍）。
// 值变化不属于业务数据的控件（筛选框、路径输入等）挂 data-no-dirty 排除。

import { adminStore } from './store';
import { toast } from './toast';

/* ---- 通用基线：免登记，新页面默认就有离开提示 ---- */

const baseline = new WeakMap<HTMLElement, string>();
/** 不承载业务数据的输入类型（隐藏字段、按钮型 input 等） */
const IGNORED_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function controlList(): FormControl[] {
  const scope = document.getElementById('swup');
  if (!scope) return [];
  return Array.from(scope.querySelectorAll<FormControl>('input, textarea, select'));
}

/** 排除：data-no-dirty 子树（含自身）、禁用 / 只读、非数据型输入 */
function isIgnorable(el: FormControl): boolean {
  if (el.closest('[data-no-dirty]')) return true;
  if (el.disabled) return true;
  if (el instanceof HTMLInputElement) return IGNORED_INPUT_TYPES.has(el.type) || el.readOnly;
  if (el instanceof HTMLTextAreaElement) return el.readOnly;
  return false;
}

function signature(el: FormControl): string {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    return String(el.checked);
  }
  return el.value;
}

function snapshot(el: FormControl): void {
  if (!isIgnorable(el)) baseline.set(el, signature(el));
}

/** 给全部控件拍初始快照；换页后旧元素随 DOM 替换从 WeakMap 里失效 */
function takeBaseline(): void {
  for (const el of controlList()) snapshot(el);
}

/** 暂存成功后重拍基线：控件值没变但「原文」已推进，基线必须跟上 */
export function retakeBaseline(): void {
  takeBaseline();
}

/** 新增控件入 DOM 的瞬间即拍基线：数据页字段是 JS 晚渲染的，swup 换内容也走节点新增 */
function observeBaseline(scope: HTMLElement): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('input, textarea, select')) snapshot(node as FormControl);
        for (const el of node.querySelectorAll<FormControl>('input, textarea, select')) {
          snapshot(el);
        }
      }
    }
  });
  observer.observe(scope, { childList: true, subtree: true });
}

/** 任一控件偏离基线即脏；observer 漏拍的控件首见值直接当基线兜底 */
function genericDirty(): boolean {
  for (const el of controlList()) {
    if (isIgnorable(el)) continue;
    const current = signature(el);
    const base = baseline.get(el);
    if (base === undefined) {
      baseline.set(el, current);
      continue;
    }
    if (base !== current) return true;
  }
  return false;
}

function isAdminPath(href: string): boolean {
  if (!href.startsWith('/')) return false;
  const { pathname } = new URL(href, window.location.origin);
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/**
 * 只拦「后台内 → 后台」的链接点击：
 * - 带修饰键 / 新标签 / 下载 / 纯锚点：不产生当前页导航，不拦；
 * - 跳出后台的链接交给 beforeunload 的浏览器原生弹窗；
 * - 取消时 preventDefault 与 stopPropagation 都要：swup 的点击委托挂在
 *   documentElement 的冒泡阶段且不检查 defaultPrevented，只拦默认行为挡不住它换内容。
 */
function onLinkClick(e: MouseEvent): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return;
  }
  if (!genericDirty()) return;
  const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href]') ?? null;
  if (!link) return;
  const href = link.getAttribute('href') ?? '';
  if (
    !href ||
    href.startsWith('#') ||
    link.target === '_blank' ||
    link.hasAttribute('download') ||
    !isAdminPath(href)
  ) {
    return;
  }
  if (window.confirm('当前页面有未暂存的修改，离开会丢弃它们，确定离开？')) {
    toast('已丢弃未暂存的修改');
    return;
  }
  e.preventDefault();
  e.stopPropagation();
}

/** 未暂存修改或已暂存未提交的改动都在内存里，刷新/关页会丢 */
function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (!genericDirty() && adminStore.state.changes.length === 0) return;
  e.preventDefault();
}

if (!window.__adminDirtyGuard) {
  window.__adminDirtyGuard = true;
  takeBaseline();
  const scope = document.getElementById('swup');
  if (scope) observeBaseline(scope);
  // 捕获阶段先于 swup 的 document 点击委托执行
  document.addEventListener('click', onLinkClick, true);
  window.addEventListener('beforeunload', onBeforeUnload);
}
