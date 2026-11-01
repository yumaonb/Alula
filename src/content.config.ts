// content.config.ts — 内容集合定义（基础元数据校验与默认值）
// 分类由文章在 content/posts/ 的目录结构决定，frontmatter 的 categories / category / 分类 字段一律忽略。
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z
    .object({
      title: z.string().optional(),
      date: z.coerce.date().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
      tags: z.array(z.string()).optional(),
      pinned: z.boolean().optional(),
      hidden: z.boolean().optional(),
    })
    // 只认上面这 7 个字段：写错的字段名（description 少个 s、hide 之类）直接构建失败。
    // 放行未知字段等于让拼写错误静默生效，字段看着写了、页面拿不到
    .strict()
    .transform((fm) => {
      if (fm.title == null) fm.title = '无标题';
      if (fm.tags == null) fm.tags = [];
      if (fm.pinned == null) fm.pinned = false;
      if (fm.hidden == null) fm.hidden = false;
      return fm;
    }),
});

export const collections = { posts };
