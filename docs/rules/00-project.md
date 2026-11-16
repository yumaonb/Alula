# 00 — 项目总览与硬约束

> 读法：任何代码改动之前先读本篇。本目录不自动加载，靠 `AGENTS.md` 的路由表按需读。

Alula：Astro 5 + Svelte 5 + TypeScript 的静态个人站点，深色毛玻璃（glassmorphism）视觉，包管理器 pnpm。
构建期生成全部页面，没有服务端；运行时的外部依赖只有 giscus 评论与 GitHub API。

## 命令

| 命令                    | 作用                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`              | 开发服务器                                                                                                                                           |
| `pnpm verify`           | 代码质量 + 业务测试 + `astro check`：收工硬门槛，任一项不过就是没过                                                                                  |
| `pnpm test`             | 只跑两类检测（quality + behavior），不含格式与类型                                                                                                   |
| `pnpm test:quality`     | 只跑五类代码质量检查                                                                                                                                 |
| `pnpm test:behavior`    | 只跑业务逻辑测试                                                                                                                                     |
| `pnpm build`            | 构建到 `dist/`，改完必跑                                                                                                                             |
| `pnpm format`           | Prettier 全量重排（收工固定第一步，见 AGENTS §9；不要先问，直接跑）                                                                                  |
| `pnpm format:check`     | 只检查是否已格式化，不写入                                                                                                                           |
| `pnpm check:leaks`      | 只查调试残留与类型逃逸（`console.log` / `any` / `!important` 等）                                                                                    |
| `pnpm check:docs`       | 只查文档里的路径与命令是否真实存在                                                                                                                   |
| `pnpm check:contracts`  | 只查死 Prop、无人引用的导出、无人使用的组件                                                                                                          |
| `pnpm check:transition` | 只查 `src/assets/css/global.css` 与 `src/features/posts/styles/shell.css` 的「切页转场」块都守稳定词汇表，静止标记只允许出现在两份样式与文章外壳脚本 |
| `pnpm check:registry`   | 只查组件清单 / 水合指令 / `window` 标记与代码是否一致                                                                                                |
| `pnpm registry:write`   | 重新生成 `docs/REGISTRY.md`（机器清单，可随时重建）                                                                                                  |

## 目录地图

```
src/
├── assets/css/          公共基础、元件与 shared/（骨架屏、图片占位、Markdown、高亮令牌）
├── assets/backgrounds/  全站背景预设，由 src/data/background.ts 选择
├── assets/js/           公共脚本：nav/、ui/、util/、data/（含 GitHub 客户端）
├── assets/images/       站点自带图片
├── components/          公共 layout/ 与 widgets/（Clock、Quote、DaysCounter）
├── content/             集中正文：about.md 与 posts/ 文章目录
├── data/                集中配置：config 开关、feature-definitions 路由导航、profile 介绍、social-links 联系方式
├── layouts/             BaseLayout 公共外壳，经明确虚拟入口接入功能
├── lib/                 公共导航匹配 nav-match.ts
├── features/            功能域内页面、端点、组件、布局、脚本、样式、工具与资源
│   ├── posts/           文章全域（含 AuthorCard、Comments、灯箱与抽屉）
│   ├── about/           关于页、TechStack 与 Timeline
│   └── projects/        项目页与 ProjectsGrid（其余功能见目录）
├── integrations/        功能路由、虚拟入口、资源生成与审计
└── pages/               index.astro、404.astro、admin/ 固定自动路由；_admin/ 后台自包含外壳
tests/                   quality/ 质量、behavior/ 业务、run.mjs 常规门禁、feature-build.mjs 组合构建
```

## 硬约束

1. **不引入新的前端框架或 CSS 框架**。样式靠 `src/assets/css/` 的令牌与工具类，交互靠原生 DOM 或已有的 Svelte 组件；动画例外：只允许 `motion` 的 vanilla API（不引框架版，见 `ARCHITECTURE.md` 的「动画依赖：motion」）。
2. **不写只在浏览器里成立的顶层代码**。`.astro` 前置脚本在构建期执行，`window` / `document` 只能出现在 `<script>` 或 Svelte 生命周期里。
3. **文章分类只由目录结构决定**，frontmatter 里的 `categories` / `category` / `分类` 一律被忽略。
4. **改代码必须自带验证**：跑 `pnpm verify` 与 `pnpm build`，把结果如实报告（见 `70-verify.md`）。
5. **长文档放 `docs/reference/`**，规则只保留短约束，不把细节堆进规则文件（一篇 ≤ 80 行）。
6. **规范条款唯一来源是 `AGENTS.md`**；本篇提供项目索引，`docs/reference/` 说明机制与流程。
7. **自检脚本不引第三方依赖**：只用 Node 内置 `fs` / `path` / `regex`，不装 ESLint / Stylelint——它们的规则集会和本项目规范打架。脚本一个文件只管一类事，超过 200 行该拆。

## 深入阅读

- 功能开关、关闭验证与共享依赖边界见 `docs/reference/FEATURES.md`。

- 数据流、路由、客户端运行时 → `docs/reference/ARCHITECTURE.md`
- 写文章、分类、图片 → `docs/reference/CONTENT.md`
- 已知雷区与踩过的坑 → `docs/reference/TROUBLESHOOTING.md`
- 组件 / 样式 / 注释细则 → `docs/reference/` 其余文档（索引见 `index.md`）
