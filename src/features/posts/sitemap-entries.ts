// sitemap-entries.ts — 文章、分类与标签的站点地图条目
// 用法：文章功能启用时，由站点地图通过 'virtual:features/sitemap-posts' 引入。
import { buildCategoryUrl, buildTagUrl } from './lib/category';
import { loadBlogData } from './lib/posts-data';
import type { PostSitemapEntry } from '../sitemap/post-entries';

export async function getPostSitemapEntries(): Promise<PostSitemapEntry[]> {
  const data = await loadBlogData();

  // 隐藏文章的独立页面仍存在，公开地图只列出可见文章。
  const postEntries: PostSitemapEntry[] = data.posts.map((post) => ({
    loc: post.url,
    lastmod: post.date || undefined,
  }));

  // 分类范围须与 src/features/posts/pages/[...slug].astro 的静态路由一致。
  const categoryPaths = new Set<string>();
  for (const key of Object.keys(data.meta)) categoryPaths.add(key);
  for (const post of data.allPosts) {
    const parts = post.category.split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) categoryPaths.add(parts.slice(0, i).join('/'));
  }
  const categoryEntries = [...categoryPaths]
    .sort()
    .map((path) => ({ loc: buildCategoryUrl(path.split('/')) }));

  // 标签路由包含隐藏文章的标签，地图与实际生成的页面保持一致。
  const tagEntries = data.allTags.map((tag) => ({ loc: buildTagUrl(tag) }));

  return [...postEntries, ...categoryEntries, ...tagEntries];
}
