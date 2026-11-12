# 00 — 项目总览与硬约束

> 读法：任何代码改动之前先读本篇。本目录不自动加载，靠 `AGENTS.md` 的路由表按需读。

Alula：Astro 5 + Svelte 5 + TypeScript 的静态个人站点，深色毛玻璃（glassmorphism）视觉，包管理器 pnpm。
构建期生成全部页面，没有服务端；运行时的外部依赖只有 giscus 评论与 GitHub API。

## 命令

| 命令                   | 作用                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| `pnpm dev`             | 开发服务器                                                          |
| `pnpm verify`          | 代码质量 + 业务测试 + `astro check`：收工硬门槛，任一项不过就是没过 |
| `pnpm test`            | 只跑两类检测（quality + behavior），不含格式与类型                  |
| `pnpm test:quality`    | 只跑四类代码质量检查                                                |
| `pnpm test:behavior`   | 只跑业务逻辑测试                                                    |
| `pnpm build`           | 构建到 `dist/`，改完必跑                                            |
| `pnpm format`          | Prettier 全量重排（收工固定第一步，见 AGENTS §9；不要先问，直接跑） |
| `pnpm format:check`    | 只检查是否已格式化，不写入                                          |
| `pnpm check:leaks`     | 只查调试残留与类型逃逸（`console.log` / `any` / `!important` 等）   |
| `pnpm check:docs`      | 只查文档里的路径与命令是否真实存在                                  |
| `pnpm check:contracts` | 只查死 Prop、无人引用的导出、无人使用的组件                         |
| `pnpm check:registry`  | 只查组件清单 / 水合指令 / `window` 标记与代码是否一致               |
| `pnpm registry:write`  | 重新生成 `docs/REGISTRY.md`（机器清单，可随时重建）                 |

## 目录地图

```
src/
├── assets/css/          全局样式（根目录=全站基础+小元件聚合：variables/global/utilities；shared/=全站可复用组件级：skeleton/lightbox；posts/=文章；admin/=后台）
├── assets/backgrounds/  全站背景预设（css/ 纯 CSS 绘制、images/ 图片），由 src/data/background.ts 选择
├── assets/js/           客户端脚本（DOM 交互）：nav/ 导航与外壳常驻控件、posts/ 文章区、ui/ 通用可视元件、util/ 小工具、data/ 外部数据、admin/ 后台
├── assets/images/       站点自带图片（头像等）
├── components/          layout 布局层 / posts 文章区 / widgets 小组件 / admin 后台
├── content/posts/       文章：目录结构即分类，各分类可放 index.json 定义分类名
├── data/                站点配置与数据（site / profile / quotes / github / background ...）
├── layouts/             BaseLayout（全站外壳，含文章区常驻侧栏）、PostsShell（文章区统一布局）、AdminLayout（后台独立外壳）
├── lib/                 构建期专用（无浏览器 API）：category.ts 纯函数、posts-data.ts 数据入口、nav-match.ts 导航匹配（与浏览器侧同源）
└── pages/               路由：index / about / friends / projects / sponsor / posts/** / admin/**
tests/                   自检脚本（纯 Node，无第三方依赖）：quality/=代码质量、behavior/=业务逻辑测试、run.mjs=汇总门禁
```

## 硬约束

1. **不引入新的前端框架或 CSS 框架**。样式靠 `src/assets/css/` 的令牌与工具类，交互靠原生 DOM 或已有的 Svelte 组件；动画例外：只允许 `motion` 的 vanilla API（不引框架版，见 `ARCHITECTURE.md` 的「动画依赖：motion」）。
2. **不写只在浏览器里成立的顶层代码**。`.astro` 前置脚本在构建期执行，`window` / `document` 只能出现在 `<script>` 或 Svelte 生命周期里。
3. **文章分类只由目录结构决定**，frontmatter 里的 `categories` / `category` / `分类` 一律被忽略。
4. **改代码必须自带验证**：跑 `pnpm verify` 与 `pnpm build`，把结果如实报告（见 `70-verify.md`）。
5. **长文档放 `docs/reference/`**，规则只保留短约束，不把细节堆进规则文件（一篇 ≤ 80 行）。
6. **规范只有 `docs/` 与根 `AGENTS.md` 一份**。
7. **自检脚本不引第三方依赖**：只用 Node 内置 `fs` / `path` / `regex`，不装 ESLint / Stylelint——它们的规则集会和本项目规范打架。脚本一个文件只管一类事，超过 200 行该拆。

## 深入阅读

- 数据流、路由、客户端运行时 → `docs/reference/ARCHITECTURE.md`
- 写文章、分类、图片 → `docs/reference/CONTENT.md`
- 已知雷区与踩过的坑 → `docs/reference/TROUBLESHOOTING.md`
- 组件 / 样式 / 注释细则 → `docs/reference/` 其余文档（索引见 `index.md`）
