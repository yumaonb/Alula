// sitemap.xml.ts — 站点地图，构建期生成 /sitemap.xml
// 用法：由路由集成注册到 /sitemap.xml
import { getPostSitemapEntries } from 'virtual:features/sitemap-posts';

import { navItems } from '../../data/nav';
import { site } from '../../data/site';

function urlEntry(loc: string, lastmod?: string): string {
  const lines = ['    <url>', `      <loc>${site.url}${loc}</loc>`];
  if (lastmod) lines.push(`      <lastmod>${lastmod}</lastmod>`);
  lines.push('    </url>');
  return lines.join('\n');
}

export async function GET() {
  const postEntries = await getPostSitemapEntries();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...navItems.map((page) => urlEntry(page.href)),
    ...postEntries.map((entry) => urlEntry(entry.loc, entry.lastmod)),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
