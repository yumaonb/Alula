// rss.xml.ts — 文章订阅源（全文），构建期生成 /posts/rss.xml
import type { APIContext } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

import rss from '@astrojs/rss';

import { site } from '../../data/site';
import { loadBlogData, renderPost } from '../../lib/posts-data';

/**
 * 把正文里的站内地址补成绝对 URL。
 * 阅读器拿到的是一段脱离站点的 HTML，没有"当前页面"可作基准，`./x.png`、`/posts/y/` 全都会断。
 * @param html 正文 HTML
 * @param pageUrl 该篇文章的绝对地址，作为相对路径的基准
 */
function absolutize(html: string, pageUrl: string): string {
  const resolve = (value: string): string => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return value; // 已是绝对地址 / 协议相对 / 锚点
    try {
      return new URL(value, pageUrl).href;
    } catch {
      return value;
    }
  };

  return html
    .replace(
      /(\s(?:src|href|poster)=")([^"]+)(")/g,
      (_, head: string, value: string, tail: string) => head + resolve(value) + tail,
    )
    .replace(/(\ssrcset=")([^"]+)(")/g, (_, head: string, value: string, tail: string) => {
      // srcset 是「地址 + 描述符」的列表，逐个地址解析，描述符原样保留
      const list = value
        .split(',')
        .map((item) => {
          const [url, ...descriptor] = item.trim().split(/\s+/);
          return [resolve(url), ...descriptor].join(' ');
        })
        .join(', ');
      return head + list + tail;
    });
}

export async function GET(context: APIContext) {
  const { posts, entries } = await loadBlogData();
  // 域名只配在 src/data/site.ts；配了 astro.config 的 site 就以它为准
  const siteUrl = context.site ?? `https://${site.domain}`;
  const entryById = new Map(entries.map((entry) => [entry.id, entry] as const));
  // 正文用 Astro 自己的渲染器（Container API）出 HTML，与文章页同一条 markdown 管线
  const container = await AstroContainer.create();

  const items = [];
  for (const post of posts) {
    const entry = entryById.get(post.slug);
    const pageUrl = new URL(post.url, siteUrl).href;
    const { Content } = entry ? await renderPost(entry) : { Content: null };
    const html = Content ? await container.renderToString(Content) : '';

    items.push({
      title: post.title,
      link: post.url,
      description: post.description,
      // 用 PostItem.date（页面显示的日期）而不是集合的原始时间，条目时间才与排列顺序一致
      pubDate: post.date ? new Date(post.date) : undefined,
      categories: post.tags,
      content: html ? absolutize(html, pageUrl) : undefined,
    });
  }

  // 取最新一篇的发布时间，而不是构建时刻：产物保持可复现，重复构建字节一致
  const lastBuildDate = items.find((item) => item.pubDate)?.pubDate;

  return rss({
    title: site.name,
    description: site.description,
    site: siteUrl,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items,
    customData: [
      `<language>${site.lang}</language>`,
      lastBuildDate ? `<lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>` : '',
      `<atom:link href="${new URL('/posts/rss.xml', siteUrl).href}" rel="self" type="application/rss+xml"/>`,
    ].join(''),
  });
}
