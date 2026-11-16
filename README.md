# Alula

![Node.js >= 22.18.0](https://img.shields.io/badge/node.js->%3D22.18.0-339933?logo=node.js&logoColor=white)
![pnpm >= 11](https://img.shields.io/badge/pnpm->=11-F69220?logo=pnpm&logoColor=white)

> 以羽之轻，驭速之行

一个基于 Astro + Svelte + TypeScript 的个人主页，专注于性能与视觉体验。
如果这个项目对你有帮助，或者你觉得它还不错，欢迎点个 ⭐ **Star** 支持一下！这对我是最大的鼓励

[在线演示](https://ym.2v.nz/)

## 特性

- 基于 Astro 构建，天然支持静态生成，首屏加载极快
- 毛玻璃（Glassmorphism）设计
- Swup 驱动的平滑页面切换动画
- 内置 RSS 订阅（`/posts/rss.xml`），阅读器自动发现
- 响应式布局，桌面端双栏、移动端单栏自适应
- 实时时钟、天数统计、随机一言等小组件
- 骨架屏加载过渡，提升感知性能
- 纯 CSS 工具类体系，无额外 CSS 框架依赖

## 命令

| 命令                | 说明                               |
| ------------------- | ---------------------------------- |
| `pnpm install`      | 安装依赖                           |
| `pnpm dev`          | 启动本地开发服务器                 |
| `pnpm build`        | 构建生产版本到 `./dist/`           |
| `pnpm preview`      | 本地预览构建结果                   |
| `pnpm check`        | 运行 astro check（类型与模板诊断） |
| `pnpm format`       | 用 Prettier 全量格式化             |
| `pnpm format:check` | 只检查格式，不改文件               |

> pnpm 11 起，除认证与源（`.npmrc`）以外的配置一律写在 `pnpm-workspace.yaml`；
> 根 `package.json` 的 `"pnpm"` 字段不再被读取。允许执行安装脚本的依赖在 `allowBuilds` 里声明。

## 功能配置

前台可选页面、端点与关闭验证统一见 [功能开关说明](docs/reference/FEATURES.md)（`docs/reference/FEATURES.md`）。首页、前台 404 与五个后台页面始终保留，分别由 `src/pages/index.astro`、`src/pages/404.astro` 和 `src/pages/admin/` 自动路由。六个可选页面与两个端点在 `src/data/config.ts` 配置；个人介绍修改 `src/data/profile.ts`，联系方式修改 `src/data/social-links.ts`。

## 项目结构

```
src/
├── assets/
│   ├── backgrounds/     # 全站背景预设（css/ 绘制方案 + images/ 图片）
│   ├── css/             # 公共样式：variables/global/utilities + shared/
│   ├── images/          # 头像
│   └── js/              # 公共客户端脚本：nav/ ui/ util/ data/
├── components/
│   ├── layout/          # NavBar、Footer、SideWidgets、Background
│   └── widgets/         # Clock、Quote、DaysCounter
├── content/
│   ├── about.md         # 关于页正文
│   └── posts/           # 文章（目录结构即分类）
├── data/                # 配置与数据（config / feature-definitions / profile / social-links）
├── layouts/             # BaseLayout（前台公共外壳）
├── lib/                 # 公共工具：nav-match
├── features/            # 功能专属页面、端点、组件、布局、脚本、样式、工具与资源
│   ├── posts/           # 文章、侧栏 AuthorCard、Comments、灯箱与抽屉
│   ├── about/           # 关于页、TechStack 与 Timeline
│   └── projects/        # 项目页与 ProjectsGrid（其余功能见目录）
├── integrations/        # 前台功能路由注入、入口选择与构建审计
└── pages/
    ├── index.astro      # 首页
    ├── 404.astro        # 前台 404，始终保留
    └── admin/           # 后台自动路由，始终保留
        └── _admin/      # 后台自包含外壳，不生成路由
```

## 许可证

MIT
