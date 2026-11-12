// rss.xml.ts — 文章订阅源（全文），构建期生成 /posts/rss.xml
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

import rss, { type RSSFeedItem } from '@astrojs/rss';

import { nickname } from '../../data/profile';
import { site } from '../../data/site';
import { resolveCoverImage } from '../../lib/content-image';
import { loadBlogData, renderPost } from '../../lib/posts-data';

/** XML 文本节点转义：& 必须最先换，否则会把后面换出来的实体再转一遍 */
function xmlText(value: string | URL): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 阅读器拿到的是一段脱离站点的 HTML，没有"当前页面"可作基准，`./x.png`、`/posts/y/` 全都会断。
 * @param pageUrl 该篇文章的绝对地址，作为相对路径的基准
 */
function absolutize(html: string, pageUrl: string): string {
  const resolve = (value: string): string => {
    // 已是绝对地址 / 协议相对 / 锚点
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return value;
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

export async function GET() {
  const { posts, entries } = await loadBlogData();
  // 域名只配在 src/data/site.ts
  const siteUrl = site.url;
  const entryById = new Map(entries.map((entry) => [entry.id, entry] as const));
  // 正文用 Astro 自己的渲染器（Container API）出 HTML，与文章页同一条 markdown 管线
  const container = await AstroContainer.create();

  const items: RSSFeedItem[] = [];
  for (const post of posts) {
    const entry = entryById.get(post.slug);
    const pageUrl = new URL(post.url, siteUrl).href;
    const { Content } = entry ? await renderPost(entry) : { Content: null };
    const html = Content ? await container.renderToString(Content) : '';
    const cover = post.image ? await resolveCoverImage(post.image, post.basePath) : undefined;

    items.push({
      title: post.title,
      link: post.url,
      description: post.description.trim() || site.description,
      // 用 PostItem.date（页面显示的日期）而不是集合的原始时间，条目时间才与排列顺序一致
      pubDate: post.date ? new Date(post.date) : undefined,
      categories: post.tags,
      author: nickname,
      content: html ? absolutize(html, pageUrl) : undefined,
      // length 必填（schema 要求数字）。优化后产物的真实字节数构建期拿不到，按惯例填 0
      enclosure: cover
        ? { url: new URL(cover.src, siteUrl).href, length: 0, type: cover.type }
        : undefined,
    });
  }

  // 取最新一篇的发布时间，而不是构建时刻：产物保持可复现，重复构建字节一致
  // 取最大 pubDate，不能取「第一条」：items 的顺序是置顶优先，
  // 置顶一篇旧文会让整份订阅源的「最后更新」倒退
  const lastBuildDate = items.reduce<Date | undefined>(
    (latest, item) => (item.pubDate && (!latest || item.pubDate > latest) ? item.pubDate : latest),
    undefined,
  );
  const feedUrl = new URL('/posts/rss.xml', siteUrl).href;
  const logoUrl = new URL('/images/favicon.png', siteUrl).href;

  return rss({
    title: site.name,
    description: site.description,
    site: siteUrl,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items,
    // customData 是原样拼进 XML 的：站名 / 版权 / 语言里出现 & 或 < 会让整份订阅源解析失败，
    // 所以文案一律先过 xmlText()，只有我们自己拼的标签才是裸的
    customData: [
      `<language>${xmlText(site.lang)}</language>`,
      lastBuildDate ? `<lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>` : '',
      `<docs>https://validator.w3.org/feed/docs/rss2.html</docs>`,
      `<generator>Astro</generator>`,
      `<ttl>60</ttl>`,
      `<copyright>${xmlText(site.footerCopyright)}</copyright>`,
      `<image><url>${xmlText(logoUrl)}</url><title>${xmlText(site.name)}</title><link>${xmlText(siteUrl)}</link></image>`,
      `<atom:link href="${xmlText(feedUrl)}" rel="self" type="application/rss+xml"/>`,
    ].join(''),
  });
}
