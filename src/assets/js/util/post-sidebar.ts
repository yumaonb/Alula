// post-sidebar.ts — 取文章目录侧栏与目录节点
// 用法：import { queryPostSidebar, queryTocList, queryTocBar } from "../util/post-sidebar"
//
// 侧栏在 PostsShell.astro 里渲染（有目录的文章才有），真侧栏只在 #swup 里；
// ≤850px 侧栏 display:none，此时「有目录」不成立（目录走抽屉）。

/** 取真实侧栏：root 缺省查整个文档，传入 main#swup 可限定在内容区内找 */
export function queryPostSidebar(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>('.post-sidebar') ?? null;
}

/**
 * 取真实的目录节点：优先侧栏里的那份，其次抽屉宿主里的那份，
 * 按 DOM 序取（真实侧栏实例在抽屉宿主之前）。
 */
export function queryTocNav(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>('.toc-nav') ?? null;
}

/** 取目录的滚动轨道 */
export function queryTocList(root: ParentNode = document): HTMLElement | null {
  return queryTocNav(root)?.querySelector<HTMLElement>('#toc-list') ?? null;
}

/** 取目录的活动竖线 */
export function queryTocBar(root: ParentNode = document): HTMLElement | null {
  return queryTocNav(root)?.querySelector<HTMLElement>('#toc-bar') ?? null;
}
