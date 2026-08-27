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
      updateHead: true,
      theme: false,
    }),
  ],
  markdown: {
    rehypePlugins: [
      rehypeSlug,
    ],
  },
});