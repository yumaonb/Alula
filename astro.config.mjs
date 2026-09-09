// @ts-check
// astro.config.mjs — 站点构建配置（Astro 集成 / 压缩 / 构建后清理注释）
import { defineConfig } from "astro/config";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import svelte from "@astrojs/svelte";
import icon from "astro-icon";
import swup from "@swup/astro";
import rehypeSlug from "rehype-slug";
import pagefind from "astro-pagefind";
import htmlMinifier from "astro-html-minifier-next";
import compress from "@playform/compress";

/**
 * 收集构建输出目录下所有 .html 文件。
 * @param {string} dir
 * @returns {string[]}
 */
function collectHtmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectHtmlFiles(full));
    } else if (entry.toLowerCase().endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * 判断注释是否为水合必需（Svelte 5 锚点 / Astro 岛屿标记）。
 * @param {string} inner
 * @returns {boolean}
 */
function isHydrationComment(inner) {
  return (
    inner === "" ||
    inner === "[" ||
    inner === "]" ||
    inner === "astro:end" ||
    /^\[-?\d+$/.test(inner)
  );
}

/**
 * 替换回调：只处理注释，script/style 整体原样保留。
 * @param {string} match 完整匹配
 * @param {string | undefined} inner 捕获组内容（script/style 时为空）
 * @returns {string}
 */
function commentReplacer(match, inner) {
  if (inner === undefined) return match; // script/style 原样保留
  return isHydrationComment(inner) ? match : "";
}

/**
 * 删除 HTML 注释，但保留 Svelte 5 水合锚点与 Astro 岛屿标记。
 * 只处理 <script>/<style> 之外的内容，避免误伤内联代码字符串。
 * @param {string} html
 * @returns {string}
 */
function stripNonHydrationComments(html) {
  return html.replace(
    /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--([\s\S]*?)-->/g,
    commentReplacer
  );
}

/**
 * 构建后处理：清理 dist 里的展示性 HTML 注释。
 * @returns {import("astro").AstroIntegration}
 */
function stripSafeComments() {
  return {
    name: "strip-safe-comments",
    hooks: {
      "astro:build:done": async ({ dir: outDir }) => {
        const root = fileURLToPath(outDir);
        let removed = 0;
        for (const file of collectHtmlFiles(root)) {
          const before = readFileSync(file, "utf8");
          const after = stripNonHydrationComments(before);
          if (after !== before) {
            writeFileSync(file, after);
            removed += countRemoved(before, after);
          }
        }
        if (removed > 0) {
          console.log(`[strip-safe-comments] 已移除 ${removed} 条非水合注释`);
        }
      },
    },
  };
}

/** @param {string} before @param {string} after */
function countRemoved(before, after) {
  const beforeComments = before.match(/<!--([\s\S]*?)-->/g) ?? [];
  const afterComments = after.match(/<!--([\s\S]*?)-->/g) ?? [];
  return beforeComments.length - afterComments.length;
}

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
    // HTML 深度压缩（含内联 CSS/JS）；removeComments 保持 false 以保护 Svelte 水合锚点
    htmlMinifier({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true,
      removeEmptyAttributes: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      removeComments: false,
    }),
    // 删除展示性 HTML 注释（保留水合锚点）
    stripSafeComments(),
    // 独立文件压缩；按官方要求放在集成列表最后
    // CSS 必须保持 false：compress 底层用 lightningcss，会无条件删掉不带前缀的
    // backdrop-filter、只保留 -webkit- 版，导致 Firefox 等只支持原版属性的浏览器
    // 全站玻璃模糊失效。CSS 压缩已由 Astro 自带的 esbuild 完成，无需此处重复。
    compress({
      HTML: false,
      CSS: false,
      JavaScript: true,
      SVG: true,
      JSON: true,
      Image: false,
    }),
  ],
  markdown: {
    rehypePlugins: [
      rehypeSlug,
    ],
  },
});