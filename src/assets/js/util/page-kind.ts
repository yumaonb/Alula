// page-kind.ts — 页面类型探测的唯一口径
// 用法：import { detectPageKind } from '../util/page-kind'
// 文章详情页有 .post-content，列表 / 分类 / 标签页有 .posts-page，两者都没有即普通页。
// 两个标记类分别由 PostsShell.astro（.posts-page）与文章详情页模板（.post-content）渲染，
// 改类名要同步这里。
// posts/early-nav.ts 另用 .page-main--listing / --post 变体类自建判定，口径与本处不完全等价，
// 改「什么算列表页 / 文章页」要两处同改。
export interface PageKind {
  detail: boolean;
  list: boolean;
}

export function detectPageKind(root: ParentNode = document): PageKind {
  return {
    detail: !!root.querySelector('.post-content'),
    list: !!root.querySelector('.posts-page'),
  };
}
