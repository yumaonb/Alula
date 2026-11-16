// post-entries.ts — 文章功能关闭时的站点地图空入口
// 用法：文章功能关闭时，由站点地图通过 'virtual:features/sitemap-posts' 引入。
export interface PostSitemapEntry {
  loc: string;
  lastmod?: string;
}

export async function getPostSitemapEntries(): Promise<PostSitemapEntry[]> {
  return [];
}
