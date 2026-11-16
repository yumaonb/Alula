# 40 — 组件选型与水合

> 读法：动 `src/**/*.{astro,svelte}` 之前读本篇。组件条款（选型原则、runes、水合指令、脚本语言、Props、图标）见 `AGENTS.md`「开发规范」第 4 节；组件清单见 `docs/reference/COMPONENTS.md`。本篇只记规范里没有的细节。

## 选型场景

- **用 Astro**：布局壳、静态展示（名片、技术栈、分类树、卡片）、SEO 的 `<head>`、读 Markdown 渲染。
- **用 Svelte**：需要 `onMount` / `onDestroy`、定时器、`addEventListener`、响应式状态驱动 UI、`requestAnimationFrame`、直接调浏览器 API。

## 水合指令细节

- 布局层常驻岛（不在 `#swup` 内、只水合一次）可 `client:idle`，现有实例：`src/features/posts/components/PostsExtras.astro` 里的 `PostsDrawers`。`BaseLayout` 自身没有岛，入口选择见 `docs/reference/FEATURES.md`。
- 交互复杂到水合不可靠的，改纯静态标记 + 所属域的脚本；通用按钮实例为 `src/components/layout/SideWidgets.astro` + `src/assets/js/nav/page-widgets.ts`，文章按钮由 `src/features/posts/scripts/swup-widgets.ts` 控制。

## 脚本语言细节

- Astro 模块脚本块加任何属性（含 `lang="ts"` / `type` / `defer`）都会被 Astro 当成 `is:inline` 原样输出、不再走 Vite 打包与转译（见 `TROUBLESHOOTING.md`「Astro script 加属性变 is:inline」）；所以 TS 写进外部 `.ts` 文件，在裸 `<script>` 块里 import。
- `is:inline` 内联脚本必须保持普通 JS（不过构建期转译），现有实例：`Quote` / `Comments`（`define:vars` 传构建期数据）。
