// rss.xml.ts — 文章订阅源，构建期生成 /posts/rss.xml
import type { APIContext } from 'astro';

import rss from '@astrojs/rss';

import { site } from '../../data/site';
import { loadBlogData } from '../../lib/posts-data';

export async function GET(context: APIContext) {
  const { posts } = await loadBlogData();

  return rss({
    title: site.name,
    description: site.description,
    // 条目 link 是站内相对路径，要用站点绝对地址展开；域名只配在 src/data/site.ts
    site: context.site ?? `https://${site.domain}`,
    items: posts.map((post) => ({
      title: post.title,
      link: post.url,
      description: post.description,
      // 用 PostItem.date（页面显示的日期）而不是集合的原始时间，条目时间才与排列顺序一致
      pubDate: post.date ? new Date(post.date) : undefined,
      categories: post.tags,
    })),
    customData: `<language>${site.lang}</language>`,
  });
}
