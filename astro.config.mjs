// @ts-check
import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";
import icon from "astro-icon";
import swup from "@swup/astro";

// https://astro.build/config
export default defineConfig({
  integrations: [
    vue(),
    icon(),
    swup({
      containers: ["#swup"],
      cache: true,
      updateHead: true,
      theme: false,
    }),
  ],
});