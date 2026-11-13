// post-sidebar.ts — 取「真实」的文章目录侧栏与目录节点，避开转场克隆
// 用法：import { queryPostSidebar, queryTocList, queryTocBar } from "../util/post-sidebar"
//
// 侧栏在 PostsShell.astro 里渲染（有目录的文章才有）。转场克隆挂在 #swup 之外的
// 行内、播完才移除，判据：① 文档级查询要排除克隆（克隆不是真侧栏，不该被
// 测量/搬运）；② 真侧栏只在 #swup 里；③ ≤850px 侧栏 display:none，此时
// 「有目录」不成立（目录走抽屉）。

/**
 * 转场克隆的标记类（strip.ts 的 cloneEdge / cloneBlur 都挂这一个）：
 * 克隆身上仍带 .posts-header / .posts-breadcrumb，相关查询必须排除。
 * 新增克隆类型：在这里加常量并并入 CLONE_SELECTOR，再核对查询方是否要认新类
 * （strip.ts 的 clearClones、posts-shell.ts 的搜索占位符查询），漏了永远不会被清理
 */
export const EDGE_CLONE_CLASS = 'posts-edge-clone';
export const CLONE_SELECTOR = `.${EDGE_CLONE_CLASS}`;

/** 元素是否落在某个转场克隆里 */
export function isTransitionClone(el: Element): boolean {
  return !!el.closest(CLONE_SELECTOR);
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

/** 取真实目录的滚动轨道；克隆里的同名 id 不参与查询 */
export function queryTocList(root: ParentNode = document): HTMLElement | null {
  return queryTocNav(root)?.querySelector<HTMLElement>('#toc-list') ?? null;
}

/** 取真实目录的活动竖线；克隆里的同名 id 不参与查询 */
export function queryTocBar(root: ParentNode = document): HTMLElement | null {
  return queryTocNav(root)?.querySelector<HTMLElement>('#toc-bar') ?? null;
}
