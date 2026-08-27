import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string().optional(),
    image: z.string().optional(),
    tags: z.array(z.string()).optional(),
    pinned: z.boolean().optional(),
    // 分类：支持多种格式
    // - 字符串数组: ["编程", "Python"]
    // - 嵌套数组: [["编程", "Python"]]
    // - 对象数组: [{name: "Python", parent: "编程"}]
    // - 字符串: "编程/Python" 或 "编程 > Python" 或 "编程"
    categories: z.union([
      z.array(z.union([z.string(), z.array(z.string()), z.object({ name: z.string(), parent: z.string().optional() })])),
      z.string(),
    ]).optional(),
    category: z.union([z.string(), z.array(z.string())]).optional(),
    '分类': z.union([z.string(), z.array(z.string())]).optional(),
  }),
});

export const collections = { posts };