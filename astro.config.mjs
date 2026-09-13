// @ts-check
// astro.config.mjs — 站点构建配置（Astro 集成 / 压缩 / 构建后清理注释 / 背景预设）
import { defineConfig } from 'astro/config';
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { background } from './src/data/background';
import svelte from '@astrojs/svelte';
import icon from 'astro-icon';
import swup from '@swup/astro';
import rehypeSlug from 'rehype-slug';
import pagefind from 'astro-pagefind';
import htmlMinifier from 'astro-html-minifier-next';
import compress from '@playform/compress';

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
    } else if (entry.toLowerCase().endsWith('.html')) {
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
    inner === '' ||
    inner === '[' ||
    inner === ']' ||
    inner === 'astro:end' ||
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
  return isHydrationComment(inner) ? match : '';
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
    commentReplacer,
  );
}

/**
 * 构建后处理：清理 dist 里的展示性 HTML 注释。
 * @returns {import("astro").AstroIntegration}
 */
function stripSafeComments() {
  return {
    name: 'strip-safe-comments',
    hooks: {
      'astro:build:done': async ({ dir: outDir }) => {
        const root = fileURLToPath(outDir);
        let removed = 0;
        for (const file of collectHtmlFiles(root)) {
          const before = readFileSync(file, 'utf8');
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

/**
 * 背景预设插件：把 src/data/background.ts 里的文件名在构建期翻译成字面量 import。
 *
 * 为什么需要它：用户要求「只填一个文件名」就能换背景方案，而字符串变量在构建期
 * 无法当模块路径用（import.meta.glob 会把每个预设都编进产物，无论是否被选中）。
 * 这里读一次设置，生成一个虚拟模块，模块体里是真正的字面量 import——Vite 只会把
 * 被选中的那一个文件编进产物，未选中的预设零成本，dev 与 build 行为一致。
 *
 * 注意：设置文件在配置阶段被读取，改了它要重启 dev server 才生效（build 不受影响）。
 */
function backgroundPreset() {
  const folder = background.type === 'image' ? 'images' : 'css';
  const relative = `src/assets/backgrounds/${folder}/${background.path}`;
  if (!existsSync(fileURLToPath(new URL(`./${relative}`, import.meta.url)))) {
    throw new Error(
      `[background] 找不到背景预设 "${background.path}"，请核对 src/assets/backgrounds/${folder}/ 下的文件名`,
    );
  }
  // 交给 Vite 的模块 id 用根路径写法，由 Vite 按项目根解析
  const specifier = `/${relative}`;

  return {
    name: 'background-preset',
    /** @param {string} id @returns {string | null} */
    resolveId(id) {
      return id === 'virtual:background' ? '\0virtual:background' : null;
    },
    /** @param {string} id @returns {string | null} */
    load(id) {
      if (id !== '\0virtual:background') return null;
      // css 方案：副作用导入，样式随模块进入产物；图片方案：默认导出交给 astro:assets 优化
      return background.type === 'image'
        ? `import src from ${JSON.stringify(specifier)};\nexport default src;\n`
        : `import ${JSON.stringify(specifier)};\nexport default null;\n`;
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [
    svelte(),
    icon(),
    // Pagefind 全文搜索：构建后自动索引 dist/，开发服务器也会把 /pagefind/* 指向 dist/（需先构建一次）
    pagefind(),
    swup({
      containers: ['#swup'],
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
    rehypePlugins: [rehypeSlug],
  },
  vite: {
    plugins: [backgroundPreset()],
  },
});
