// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import icon from "astro-icon";
import swup from "@swup/astro";
import rehypeSlug from "rehype-slug";
import pagefind from "astro-pagefind";

// https://astro.build/config
export default defineConfig({
  integrations: [
    svelte(),
    icon(),
    // Pagefind 全文搜索：构建后自动索引 dist/，开发服务器也会把 /pagefind/* 指向 dist/（需先构建一次）
    pagefind(),
    swup({
      containers: ["#swup"],
      cache: true,
      preload: {
        hover: true,
        visible: true,
      },
      // @swup/head-plugin：切换页面时更新 head，并等待新样式表加载完成后再替换内容，避免样式闪烁
      updateHead: {
        awaitAssets: true,
      },
      theme: false,
      native: true,
    }),
  ],
  markdown: {
    rehypePlugins: [
      rehypeSlug,
    ],
  },
});