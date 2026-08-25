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
  }),
});

export const collections = { posts };