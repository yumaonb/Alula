// sitemap.xml.ts — 站点地图，构建期生成 /sitemap.xml
// 用法：路由文件，src/pages/ 下文件名即 URL（/sitemap.xml），无页面入口
import { site } from '../data/site';
import { buildCategoryUrl, buildTagUrl } from '../lib/category';
import { loadBlogData } from '../lib/posts-data';

// 前台固定页：与导航同源（src/data/nav.ts），文章区根 /posts/ 单列
const staticPages = ['/', '/about/', '/projects/', '/tools/', '/friends/', '/sponsor/', '/posts/'];

function urlEntry(loc: string, lastmod?: string): string {
  const lines = ['    <url>', `      <loc>${site.url}${loc}</loc>`];
  if (lastmod) lines.push(`      <lastmod>${lastmod}</lastmod>`);
  lines.push('    </url>');
  return lines.join('\n');
}

export async function GET() {
  const data = await loadBlogData();

  // 文章与列表页 / 订阅源同口径：只收可列出的文章，隐藏文章页头带 noindex，不进地图
  const postEntries = data.posts.map((post) => urlEntry(post.url, post.date || undefined));

  // 分类路径与 [...slug].astro 的路由同源：有 index.json 的目录 + 文章所在目录的全部中间层级
  const categoryPaths = new Set<string>();
  for (const key of Object.keys(data.meta)) categoryPaths.add(key);
  for (const post of data.allPosts) {
    const parts = post.category.split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) categoryPaths.add(parts.slice(0, i).join('/'));
  }
  const categoryEntries = [...categoryPaths]
    .sort()
    .map((path) => urlEntry(buildCategoryUrl(path.split('/'))));

  // 标签页取 allTags（含隐藏文章的标签）：标签路由本来就为它们生成，缺一条爬虫点进去就是 404
  const tagEntries = data.allTags.map((tag) => urlEntry(buildTagUrl(tag)));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticPages.map((page) => urlEntry(page)),
    ...postEntries,
    ...categoryEntries,
    ...tagEntries,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
