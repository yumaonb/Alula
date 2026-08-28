// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import icon from "astro-icon";
import swup from "@swup/astro";
import rehypeSlug from "rehype-slug";

// https://astro.build/config
export default defineConfig({
  integrations: [
    svelte(),
    icon(),
    swup({
      containers: ["#swup"],
      cache: true,
      // @swup/head-plugin：切换页面时更新 head，并等待新样式表加载完成后再替换内容，避免样式闪烁
      updateHead: {
        awaitAssets: true,
      },
      theme: false,
    }),
  ],
  markdown: {
    rehypePlugins: [
      rehypeSlug,
    ],
  },
});