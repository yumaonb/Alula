// page-kind.ts — 页面类型探测的唯一口径
// 用法：import { detectPageKind } from '../util/page-kind'
// 文章详情页有 .post-content，列表 / 分类 / 标签页有 .posts-page，两者都没有即普通页。
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
