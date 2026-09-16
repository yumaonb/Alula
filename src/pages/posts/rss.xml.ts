// rss.xml.ts — 文章订阅源（全文），构建期生成 /posts/rss.xml
import path from 'node:path';

import type { APIContext, ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

import rss from '@astrojs/rss';

import { nickname } from '../../data/profile';
import { site } from '../../data/site';
import { loadBlogData, renderPost } from '../../lib/posts-data';

// 封面图：与 components/posts/ImageWrapper.astro 用同一套 glob 键（都是相对 src/ 的 ./* 路径）
const coverFiles = import.meta.glob<ImageMetadata>('../../**/*.{png,jpg,jpeg,gif,webp,svg}', {
  import: 'default',
});

/** 扩展名 → MIME。public 目录里的文件只能靠扩展名判断（例如 /images/logo.png 实际是 JPEG） */
const mimeByExt: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

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

/**
 * 解析文章封面，用于 item 的 enclosure（阅读器靠它显示缩略图）。
 * `/` 开头的是 public 静态文件，原样引用；相对路径走 astro:assets，与文章页同一套口径。
 * 解析不出封面（路径写错等）时返回 undefined，宁可少一个 enclosure 也不要让构建挂掉。
 * @param image frontmatter 的 image 字段
 * @param basePath 该篇文章所在目录（相对 src/），相对路径以它为基准
 */
async function resolveCover(image: string, basePath: string) {
  if (image.startsWith('/')) {
    return { src: image, type: mimeByExt[path.extname(image).toLowerCase()] ?? 'image/png' };
  }

  const key = path.normalize(path.join('../../', basePath, image)).replace(/\\/g, '/');
  const load = coverFiles[key];
  if (!load) {
    console.warn(`[rss] 封面图不存在，已跳过 enclosure：${key.replace('../../', 'src/')}`);
    return undefined;
  }

  const meta = await load();
  const optimized = await getImage({ src: meta, width: 1200 });
  const ext = path.extname(optimized.src.split('?')[0]).toLowerCase();
  return { src: optimized.src, type: mimeByExt[ext] ?? `image/${meta.format}` };
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
    const cover = post.image ? await resolveCover(post.image, post.basePath) : undefined;

    items.push({
      title: post.title,
      link: post.url,
      description: post.description,
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
  const lastBuildDate = items.find((item) => item.pubDate)?.pubDate;
  const feedUrl = new URL('/posts/rss.xml', siteUrl).href;
  const logoUrl = new URL('/images/favicon.png', siteUrl).href;

  return rss({
    title: site.name,
    description: site.description,
    site: siteUrl,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items,
    // customData 是原样拼进 XML 的，只能放静态文案（带 & < > 的文案要先转义）
    customData: [
      `<language>${site.lang}</language>`,
      lastBuildDate ? `<lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>` : '',
      `<docs>https://validator.w3.org/feed/docs/rss2.html</docs>`,
      `<generator>Astro</generator>`,
      `<ttl>60</ttl>`,
      `<copyright>${site.footerCopyright}</copyright>`,
      `<image><url>${logoUrl}</url><title>${site.name}</title><link>${siteUrl}</link></image>`,
      `<atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>`,
    ].join(''),
  });
}
