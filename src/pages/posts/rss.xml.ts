// rss.xml.ts — 文章订阅源，构建期生成 /posts/rss.xml
import rss, { type RSSFeedItem } from '@astrojs/rss';

import { nickname } from '../../data/profile';
import { site } from '../../data/site';
import { resolveCoverImage } from '../../lib/content-image';
import { loadBlogData } from '../../lib/posts-data';

/** XML 文本节点转义：& 必须最先换，否则会把后面换出来的实体再转一遍 */
function xmlText(value: string | URL): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET() {
  const { posts } = await loadBlogData();
  // 域名只配在 src/data/site.ts
  const siteUrl = site.url;

  const items: RSSFeedItem[] = [];
  for (const post of posts) {
    const cover = post.image ? await resolveCoverImage(post.image, post.basePath) : undefined;

    items.push({
      title: post.title,
      link: post.url,
      description: post.description.trim() || site.description,
      // 用 PostItem.date（页面显示的日期）而不是集合的原始时间，条目时间才与排列顺序一致
      pubDate: post.date ? new Date(post.date) : undefined,
      categories: post.tags,
      author: nickname,
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
