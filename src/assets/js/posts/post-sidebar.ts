// post-sidebar.ts — 取「真实」的文章目录侧栏与目录节点，避开转场克隆
// 用法：import { queryPostSidebar, queryTocNav } from "./post-sidebar"
//
// 侧栏在 PostsShell.astro 里渲染（有目录的文章才有），转场时 strip 会克隆它、
// 克隆保留 .post-sidebar / .toc-nav 类名并挂在 #swup 之外的行内。所以：
// ① 文档级查询可能命中克隆（克隆不是真侧栏，不该被测量/搬运）；
// ② 真侧栏只在 #swup 里；
// ③ ≤850px 侧栏 display:none，此时「有目录」不成立（目录走抽屉）。
// 这三条判据原先分散在 toc.ts 与 transition.ts 各写一遍，改一处漏一处不会报错、
// 只在某个版面/时刻悄悄失效，统一收在这里。

/**
 * 转场克隆的标记类（strip.cloneIntoRow 的 markerClass）：
 * 克隆身上仍带 .post-sidebar / .toc-nav，查询时必须排除。
 */
const CLONE_MARKERS = '.posts-toc-clone, .posts-edge-clone';

/** 元素是否落在某个转场克隆里 */
export function isTransitionClone(el: Element): boolean {
  return !!el.closest(CLONE_MARKERS);
}

/** 取真实侧栏：root 缺省查整个文档，传入 main#swup 可限定在内容区内找 */
export function queryPostSidebar(root: ParentNode = document): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>('.post-sidebar')) {
    if (!isTransitionClone(el)) return el;
  }
  return null;
}

/**
 * 取真实的目录节点：优先侧栏里的那份，其次抽屉宿主里的那份，
 * 都不考虑转场克隆（克隆里的那份是静态副本，不可交互也不参与测量）。
 */
export function queryTocNav(root: ParentNode = document): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>('.toc-nav')) {
    if (!isTransitionClone(el)) return el;
  }
  return null;
}
