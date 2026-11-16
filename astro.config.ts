// astro.config.ts — 站点构建配置（Astro 集成 / 压缩 / 构建后处理 / 背景预设）
import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import svelte from '@astrojs/svelte';
import icon from 'astro-icon';
import swup from '@swup/astro';
import rehypeSlug from 'rehype-slug';
import { createIndex } from 'pagefind';
import htmlMinifier from 'astro-html-minifier-next';
import compress from '@playform/compress';

import { background } from './src/data/background';
import { site } from './src/data/site';
import { splitOutsideCode } from './astro-code-blocks';
import { features as defaultFeatures, type FeatureConfig } from './src/data/config';
import { featureRoutesIntegration } from './src/integrations/feature-routes';

const PROJECT_ROOT = new URL('./', import.meta.url);

interface SiteConfigOptions {
  cacheDir?: URL;
  reportDir?: URL;
}

function collectHtmlFiles(dir: string): string[] {
  const files: string[] = [];
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

/** 产物里的全部文件（递归），用于扫描引用与清理 */
function collectAllFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectAllFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

/* ---- 构建后处理自检 ----
 * 下面两段后处理都靠正则直接改产物，正则漏匹配时构建仍然成功、只是悄悄降级：
 * CSS 变回外链（首帧又要等 CSS 下载）或注释剥离误伤水合锚点（岛屿整岛不水合）。
 * 这里只断言「恒等式」，不写任何绝对数量——绝对数量会随页面 / 岛屿增加而过时，
 * 变成「代码合法改动却构建失败」的假失败：
 *  - 删注释前后，逐个岛屿比对内容，必须逐字相同——不靠「认得锚点长什么样」来数，
 *    否则锚点格式一变就两边一起变 0，永远测不出自己把自己剥没了；
 *  - 内联之后，再查一遍外链 stylesheet，必须一条不剩
 *    （探测器与替换器认同一套标签，替换器将来若退化到跳过某些 link 时它才抓得到）；
 *  - 至少处理到一个 HTML 文件（防 outDir 解析错，空转却报成功）。
 */

/**
 * 产物里被引用到的资源文件名集合。
 *
 * 依据「文件名的字面量出现」判断：资源 URL 一定以字面量写在引用它的
 * HTML / JS / CSS 里（img 的 src、script 的 src、CSS 的 url()、动态 import 的
 * 分块名），扫遍产物全部文件（含二进制，按 latin1 读）扫不到，就是没人请求。
 */
const ASSET_FILE_NAME = /[\w@.-]+\.(?:css|mjs|js|json|xml|txt|jpg|jpeg|png|gif|webp|svg|wasm)/g;

function collectReferencedAssets(root: string): Set<string> {
  const referenced = new Set<string>();
  for (const file of collectAllFiles(root)) {
    const text = readFileSync(file).toString('latin1');
    for (const match of text.matchAll(ASSET_FILE_NAME)) {
      referenced.add(match[0]);
    }
  }
  return referenced;
}

/** Pagefind 自带的官方 UI 包：站点用自己的搜索界面（PostSearch.svelte），这套从不加载。
 *  它们互相引用（component-ui 引用 ui），所以要整组删——单删一个会留下半截。 */
const PAGEFIND_UNUSED_FILES = [
  'pagefind-ui.js',
  'pagefind-ui.css',
  'pagefind-component-ui.js',
  'pagefind-component-ui.css',
  'pagefind-modular-ui.js',
  'pagefind-modular-ui.css',
];

/**
 * 删掉产物里没人请求的文件。
 *
 * 三类来源：
 *  - Pagefind 官方 UI 包（上面那组固定文件名）
 *  - 已内联的 CSS 副本：inlineCss 把 <link> 换成 <style> 后，原文件已无人引用
 *  - 只作为模块被引用、页面实际用的是优化变体的图片原图（背景图等）
 *
 * 只删 CSS 与图片，不碰 JS 分块：动态 import 的分块名在产物里的形式不唯一，
 * 误删会直接让页面功能失效。
 */
function pruneUnusedAssets(): AstroIntegration {
  return {
    name: 'prune-unused-assets',
    hooks: {
      'astro:build:done': async ({ dir: outDir }) => {
        const root = fileURLToPath(outDir);
        const referenced = collectReferencedAssets(root);

        for (const name of PAGEFIND_UNUSED_FILES) {
          const file = join(root, 'pagefind', name);
          if (existsSync(file)) {
            rmSync(file, { force: true });
          }
        }

        // 扫描引用时已把 Pagefind 的 UI 文件算作「被引用」（它们彼此引用），
        // 所以那组要显式排除，否则刚删掉的文件名会让人以为别人还在用
        for (const name of PAGEFIND_UNUSED_FILES) {
          referenced.delete(name);
        }

        const assetsDir = join(root, '_astro');
        if (!existsSync(assetsDir)) return;
        for (const entry of readdirSync(assetsDir)) {
          const full = join(assetsDir, entry);
          if (!statSync(full).isFile()) continue;
          // JS 分块一律保留：动态 import 的引用形式不唯一，判不准就留着
          if (!/\.(css|jpg|jpeg|png|gif|webp|svg)$/i.test(entry)) continue;
          if (referenced.has(entry)) continue;
          rmSync(full, { force: true });
        }
      },
    },
  };
}

/** Svelte 5 水合锚点与 Astro 岛屿标记，不能删 */
function isHydrationComment(inner: string): boolean {
  return (
    inner === '' ||
    inner === '[' ||
    inner === ']' ||
    inner === 'astro:end' ||
    /^\[-?\d+$/.test(inner)
  );
}

/** inner 为 undefined 表示命中 script/style 捕获组，原样保留 */
function commentReplacer(match: string, inner?: string): string {
  if (inner === undefined) return match;
  return isHydrationComment(inner) ? match : '';
}

/** 岛屿整块（含内部的水合锚点与 SSR 结构） */
const ISLAND_BLOCK = /<astro-island\b[\s\S]*?<\/astro-island>/g;

/**
 * 只处理 <script>/<style> 之外的内容，避免误伤内联代码字符串。
 * 岛屿整块先摘出来保护：岛内的注释结构与水合锚点有关，剥了会让整岛不水合。
 * 保护靠位置而不是靠「认得锚点长什么样」——锚点格式一变就漏认，是原来那条自检的盲区。
 */
function stripNonHydrationComments(html: string): string {
  const islands: string[] = [];
  const masked = html.replace(ISLAND_BLOCK, (block) => {
    islands.push(block);
    return `\0ISLAND${islands.length - 1}\0`;
  });
  const stripped = splitOutsideCode(masked)
    .map((part, index) =>
      index % 2 === 0 ? part.replace(/<!--([\s\S]*?)-->/g, commentReplacer) : part,
    )
    .join('');
  return stripped.replace(/\0ISLAND(\d+)\0/g, (_, index) => islands[Number(index)]);
}

/* ---- 构建后处理自检 ----
 * 下面两段后处理都靠正则直接改产物，正则漏匹配时构建仍然成功、只是悄悄降级：
 * CSS 变回外链（首帧又要等 CSS 下载）或注释剥离误伤水合锚点（岛屿整岛不水合）。
 * 这里只断言「恒等式」，不写任何绝对数量——绝对数量会随页面 / 岛屿增加而过时，
 * 变成「代码合法改动却构建失败」的假失败：
 *  - 删注释前后，逐个岛屿比对内容，必须逐字相同——不靠「认得锚点长什么样」来数，
 *    否则锚点格式一变就两边一起变 0，永远测不出自己把自己剥没了；
 *  - 内联之后，再查一遍外链 stylesheet，必须一条不剩
 *    （探测器与替换器认同一套标签，替换器将来若退化到跳过某些 link 时它才抓得到）；
 *  - 至少处理到一个 HTML 文件（防 outDir 解析错，空转却报成功）。
 */

/** 只认「这是一条外链 stylesheet」：属性集含 stylesheet 的任意 <link>，不依赖属性顺序与附加属性 */
const STYLESHEET_LINK = /<link\b[^>]*\bstylesheet\b[^>]*>/gi;

/** 从 link 标签里取 href 值：双引号 / 单引号 / 无引号都认，缺失返回 null */
function linkHref(tag: string): string | null {
  const match = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3];
}

/** 去掉 <script> / <style> 块再扫描，避免把内联代码里的字符串当 HTML 数进去 */
function scanOutsideCode(html: string): string {
  return splitOutsideCode(html)
    .filter((_, index) => index % 2 === 0)
    .join('');
}

function relPath(root: string, file: string): string {
  return relative(root, file).split('\\').join('/');
}

/** 防空转：处理 0 个文件却报成功，等于后处理从没生效过 */
function assertHtmlFound(root: string, files: string[]): void {
  if (files.length > 0) return;
  throw new Error(
    `[build] 构建后处理没有找到任何 HTML 产物：${root}\n  先确认 outDir 解析，否则后处理在空转`,
  );
}

/** 逐块取出岛屿：断言「剥前剥后每个岛的内容逐字相同」 */
function islandBlocks(html: string): string[] {
  return [...html.matchAll(ISLAND_BLOCK)].map((match) => match[0]);
}

/** 只认开标签：比整块正则宽，整块正则漏认（Astro 改了岛屿写法）时这条仍然数得到 */
const ISLAND_OPEN = /<astro-island\b[^>]*>/g;

function islandOpenTags(html: string): string[] {
  return [...html.matchAll(ISLAND_OPEN)].map((match) => match[0]);
}

function assertAnchorsIntact(root: string, file: string, before: string, after: string): void {
  const fail = (detail: string): never => {
    throw new Error(
      `[build] strip-safe-comments 误伤了岛屿：${relPath(root, file)}\n` +
        `  ${detail}\n` +
        `  岛屿被改动的后果是整岛不水合（页面上像静态标记，交互全失效）`,
    );
  };

  // 第一道：独立数开标签。整块正则与掩码同源，一起漏认时上面那条比对会「两边都是 0」而通过；
  // 开标签个数是从完整产物上数的，能独立发现「整岛被吞掉」
  const opensBefore = islandOpenTags(before);
  const opensAfter = islandOpenTags(after);
  if (opensBefore.length !== opensAfter.length) {
    fail(`岛屿开标签数 ${opensBefore.length} → ${opensAfter.length}`);
  }

  // 第二道：被保留下来的岛必须仍带水合指令，且与剥前逐字相同
  const islandsBefore = islandBlocks(before);
  const islandsAfter = islandBlocks(after);
  if (islandsBefore.length !== islandsAfter.length) {
    fail(`可识别的岛屿块数 ${islandsBefore.length} → ${islandsAfter.length}`);
  }
  const changed = islandsBefore.findIndex((block, i) => block !== islandsAfter[i]);
  if (changed >= 0) {
    fail(`第 ${changed + 1} 个岛的内容被改动`);
  }
  const dehydrated = opensAfter.filter((tag) => !/\bclient="/.test(tag));
  if (dehydrated.length > 0) {
    fail(
      `有 ${dehydrated.length} 个岛丢了 client 属性（不再水合），例如：${dehydrated[0].slice(0, 120)}`,
    );
  }
}

function assertNoStylesheetLeft(root: string, file: string, after: string): void {
  const left = [...scanOutsideCode(after).matchAll(STYLESHEET_LINK)];
  if (left.length === 0) return;
  throw new Error(
    `[build] inline-css 没能内联全部外链 CSS：${relPath(root, file)}\n` +
      `  残留 ${left.length} 条，例如：${left[0][0].slice(0, 160)}\n` +
      `  Astro 改了 <link> 的写法就先更新 astro.config.ts 里的 STYLESHEET_LINK / linkHref，否则首帧会重新等 CSS 下载`,
  );
}

function stripSafeComments(): AstroIntegration {
  return {
    name: 'strip-safe-comments',
    hooks: {
      'astro:build:done': async ({ dir: outDir }) => {
        const root = fileURLToPath(outDir);
        const files = collectHtmlFiles(root);
        assertHtmlFound(root, files);
        for (const file of files) {
          const before = readFileSync(file, 'utf8');
          const after = stripNonHydrationComments(before);
          assertAnchorsIntact(root, file, before, after);
          if (after !== before) {
            writeFileSync(file, after);
          }
        }
      },
    },
  };
}

/**
 * 为什么：外链 CSS 是渲染阻塞资源——首帧要等 HTML 和 CSS 两个串行请求都到齐，
 * 国内访问 CDN 时这一等就是好几秒白屏。CSS 内联进 HTML 后，首帧 = 第一块
 * HTML 解析完即可，BaseLayout 的首载 loading 屏（#boot-splash）因此能在
 * HTML 刚到达时就画出来，盖住后续背景图与脚本的加载时间。
 * 代价是每页 HTML 重约 30KB（压缩后仅几 KB），换来砍掉一整个 CSS 串行请求。
 *
 * swup 不受影响：SwupHeadPlugin 的 awaitAssets 只等 link[rel=stylesheet]，
 * 切页后新 head 只有 <style>（同步生效），不产生等待也不闪样式。
 */
function inlineCss(): AstroIntegration {
  return {
    name: 'inline-css',
    hooks: {
      'astro:build:done': async ({ dir: outDir }) => {
        const root = fileURLToPath(outDir);
        const files = collectHtmlFiles(root);
        assertHtmlFound(root, files);
        for (const file of files) {
          const before = readFileSync(file, 'utf8');
          const after = before.replace(STYLESHEET_LINK, (tag) => {
            const href = linkHref(tag);
            if (href === null) {
              throw new Error(
                `[build] inline-css 遇到没有 href 的 stylesheet link：${relPath(root, file)}\n` +
                  `  ${tag.slice(0, 160)}\n` +
                  `  请更新 astro.config.ts 里的 STYLESHEET_LINK / linkHref`,
              );
            }
            // 磁盘上的文件名不带查询串与片段，读之前剥掉
            const hrefPath = href.split(/[?#]/)[0];
            const css = readFileSync(join(root, hrefPath.slice(1)), 'utf8');
            return `<style>${css}</style>`;
          });
          assertNoStylesheetLeft(root, file, after);
          if (after !== before) {
            writeFileSync(file, after);
          }
        }
      },
    },
  };
}

/**
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
    resolveId(id: string): string | null {
      return id === 'virtual:background' ? '\0virtual:background' : null;
    },
    load(id: string): string | null {
      if (id !== '\0virtual:background') return null;
      // css 方案：副作用导入，样式随模块进入产物；图片方案：默认导出交给 astro:assets 优化
      return background.type === 'image'
        ? `import src from ${JSON.stringify(specifier)};\nexport default src;\n`
        : `import ${JSON.stringify(specifier)};\nexport default null;\n`;
    },
  };
}

/* ---- Pagefind 全文搜索：只索引文章页 ----
 * Pagefind 的目录索引（addDirectory）没有「只收一部分页面」的开关，整站喂进去
 * 会把列表 / 分类 / 后台全带上，所以这里直接调 pagefind 包的服务端 API：
 * 遍历 src/content/posts，把每篇未隐藏文章的构建产物喂给索引，写到 dist/pagefind。
 * 命中内容仍由正文卡的 data-pagefind-body 标记限定在文章正文（PostsShell 输出）；
 * 隐藏文章在构建期就不进索引（与 noindex 一致）。
 * 这是构建期集成，dev 下没有索引：搜索框显示「搜索索引不可用」，pnpm build 后可用。
 * 注册位置必须在 pruneUnusedAssets 之前：prune 负责删掉 dist/pagefind 里
 * 站点不用的官方 UI 包，钩子顺序即注册顺序。
 */
/** src/content/posts 下的全部 .md（递归） */
function collectPostMdFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectPostMdFiles(full));
    } else if (entry.toLowerCase().endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

/** frontmatter（首个 --- 块之间的文本），取不到返回空串 */
function postFrontmatter(file: string): string {
  const parts = readFileSync(file, 'utf8').split(/^---$/m);
  return parts.length >= 3 ? parts[1] : '';
}

function pagefindArticles(): AstroIntegration {
  return {
    name: 'pagefind-articles',
    hooks: {
      'astro:build:done': async ({ dir: outDir, logger }) => {
        const root = fileURLToPath(outDir);
        const contentDir = fileURLToPath(new URL('src/content/posts/', PROJECT_ROOT));
        const posts = collectPostMdFiles(contentDir).filter(
          (file) => !/^hidden:\s*true\s*$/m.test(postFrontmatter(file)),
        );
        const created = await createIndex();
        if (created.index === undefined) {
          throw new Error(`[build] Pagefind 服务启动失败：${created.errors.join('; ')}`);
        }
        let indexed = 0;
        for (const file of posts) {
          const slug = relative(contentDir, file).replace(/\.md$/i, '').split('\\').join('/');
          const html = join(root, 'posts', slug, 'index.html');
          if (!existsSync(html)) {
            throw new Error(
              `[build] 搜索索引找不到文章页产物：${html}\n` +
                `  核对文章文件名（即 URL 尾段）是否被改动过`,
            );
          }
          const result = await created.index.addHTMLFile({
            sourcePath: `posts/${slug}/index.html`,
            content: readFileSync(html, 'utf8'),
          });
          if (result.errors.length > 0) {
            throw new Error(`[build] Pagefind 索引 ${slug} 失败：${result.errors.join('; ')}`);
          }
          indexed += 1;
        }
        const written = await created.index.writeFiles({ outputPath: join(root, 'pagefind') });
        if (written.errors.length > 0) {
          throw new Error(`[build] Pagefind 索引写入失败：${written.errors.join('; ')}`);
        }
        logger.info(`已索引 ${indexed} 篇文章（隐藏文章不索引）`);
      },
    },
  };
}

export function createSiteConfig(
  selectedFeatures: FeatureConfig = defaultFeatures,
  options: SiteConfigOptions = {},
) {
  return defineConfig({
    root: fileURLToPath(PROJECT_ROOT),
    ...(options.cacheDir ? { cacheDir: fileURLToPath(options.cacheDir) } : {}),
    site: site.url,
    integrations: [
      featureRoutesIntegration(selectedFeatures, { reportDir: options.reportDir }),
      svelte(),
      icon(),
      // Pagefind 全文搜索：只把未隐藏文章页喂给索引（机制见上方 pagefindArticles 注释）
      ...(selectedFeatures.pages.posts ? [pagefindArticles()] : []),
      swup({
        containers: ['#swup'],
        cache: true,
        preload: {
          hover: true,
          visible: true,
        },
        // @swup/head-plugin：切换页面时更新 head，并等待新样式表加载完成后再替换内容，避免样式闪烁
        // persistAssets：旧页面的孤儿 <link>/<style>/<script> 保留在 head 里，直到内容真正被替换。
        // head 的移除先于等待发生，而岛样式恰在 head 的内联 <style> 中：不留的话，等待期间
        // 旧页面内容已丢样式，无宽高约束的 SVG 会按默认 300×150 画成一大块（离开项目页瞬间的巨型 GitHub 图标）
        updateHead: {
          awaitAssets: true,
          persistAssets: true,
        },
        theme: false,
        // smoothScrolling —— @swup/astro 用这个开关决定是否注册 SwupScrollPlugin。
        // 显式写出来：swup-widgets.ts 靠 swup:scroll:start / swup:scroll:end 判断
        // 平滑滚动何时结束，依赖的就是这个插件——它默认开启，但依赖关系在配置里看不见，
        // 将来升级或改配置把它关掉时，按钮的显隐时机会静默退化成 250ms 兜底。
        smoothScrolling: true,
        // animationClass: 'transition-' —— swup 等待 [class*="transition-"] 元素上的动画（全站只有
        // #swup 的 .transition-page，见 global.css「切页转场」）：旧页退出动画播完才替换 DOM，
        // 新页进入动画播完才收尾。等待时长读该元素的 animationDuration（令牌 --t-page-exit /
        // --t-page-enter）；减动效把时长压到 0.01s 但不设 none——none 会让 swup 不等且打警告
        //（TROUBLESHOOTING 20.2）。
        animationClass: 'transition-',
        // progress: true —— 官方 @swup/progress-plugin（@swup/astro 自带）：页面顶部一条细
        // 进度条。出现时机（visit:start 起 300ms 延迟）与切页转场动画的关系见 global.css
        //「Swup 切页进度条」节；默认是 3px 黑条，高度与颜色也在 global.css 里覆盖。
        progress: true,
        // globalInstance：把实例挂到 window.swup。posts-shell.ts 需要订阅 swup 原生钩子
        //（fetch:error / visit:abort）——@swup/astro 只在 document 上桥接
        // astro:before-swap / after-swap / page-load 三个事件，覆盖不了「fetch 失败」：
        // 失败时内容未交换，壳需要知道以便兜底恢复搜索框
        globalInstance: true,
        // native: false —— 关掉浏览器原生 View Transition。
        //
        // 原因（已在 swup 产物里核对）：native 为 true 时 swup 会执行
        //   this.options.native = this.options.native && !!document.startViewTransition
        // 并用 document.startViewTransition() 把整次 renderPage 包起来。原生 VT 会把
        // 整页快照挂到覆盖整个视口的 ::view-transition 顶层，动画期间
        // 指针事件全落在快照上、到不了真实 DOM——后台侧栏在 #swup 之外、视觉上根本没动，
        // 却同样点不动，必须等动画播完或点第二次，这就是「切页时侧栏点不了」的根因。
        // 关掉后不再吞掉点击；切页动画由 #swup 自身的 CSS 动画（.transition-page）承担，
        // 与原生 View Transition 无关。
        native: false,
      }),
      // HTML 深度压缩（含内联 CSS/JS）；removeComments 保持 false 以保护 Svelte 水合锚点。
      // ignoreCustomFragments：把整个 astro-island 岛屿按原始文本保护，压缩器不进入其内部。
      // 原因：岛内 SSR 标记里元素之间的空白文本节点是 Svelte 5 水合遍历的一部分
      //（SSR 输出含 `</div> <div>` 这类空白节点），collapseWhitespace 会把这些节点删掉，
      // 导致客户端水合时 DOM 结构与预期不符：控制台报 hydration_mismatch +
      // "Illegal invocation"，岛先被 clear 再兜底重新 mount——内容能显示但每次整岛重渲染。
      // 同理 minifyCSS 重排岛内 style 属性值、removeEmptyAttributes 动岛内属性，一并保护。
      htmlMinifier({
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        removeComments: false,
        ignoreCustomFragments: [
          /<astro-island\b[\s\S]*?<\/astro-island>/,
          /<astro-slot\b[\s\S]*?<\/astro-slot>/,
        ],
      }),
      // 删除展示性 HTML 注释（保留水合锚点）
      stripSafeComments(),
      // 内联 head 里的外链 CSS（首帧不阻塞在 CSS 下载上，见 inlineCss）
      inlineCss(),
      // 删掉产物里没人请求的文件（已内联的 CSS 副本、Pagefind 官方 UI 包等）
      pruneUnusedAssets(),
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
      // 代码高亮走 css-variables 主题：Shiki 不再把颜色写死成 hex，
      // 而是输出 var(--astro-code-*) 引用，色板统一在 variables.css 里定义
      // （代码块的配色随站点主色走，不必跟 GitHub 主题绑死）
      shikiConfig: {
        theme: 'css-variables',
      },
      rehypePlugins: [rehypeSlug],
    },
    vite: {
      plugins: [backgroundPreset()],
    },
  });
}

export default createSiteConfig();
