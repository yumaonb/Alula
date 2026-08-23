# YuSwift

![Node.js >= 18](https://img.shields.io/badge/node.js->=18-339933?logo=node.js&logoColor=white)
![pnpm >= 9](https://img.shields.io/badge/pnpm->=9-F69220?logo=pnpm&logoColor=white)

> 以羽之轻，驭速之行

一个基于 Astro + Vue 3 + TypeScript 的个人主页，专注于性能与视觉体验。
如果这个项目对你有帮助，或者你觉得它还不错，欢迎点个 ⭐ **Star** 支持一下！这对我是最大的鼓励

[在线演示](https://ym.2v.nz/)

## 特性

- 基于 Astro 构建，天然支持静态生成，首屏加载极快
- 毛玻璃（Glassmorphism）设计
- Swup 驱动的平滑页面切换动画
- 响应式布局，桌面端双栏、移动端单栏自适应
- 实时时钟、天数统计、随机一言等小组件
- 骨架屏加载过渡，提升感知性能
- 纯 CSS 工具类体系，无额外 CSS 框架依赖

## 命令

| 命令 | 说明 |
| --- | --- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 启动本地开发服务器 |
| `pnpm build` | 构建生产版本到 `./dist/` |
| `pnpm preview` | 本地预览构建结果 |

## 项目结构

```
src/
├── assets/
│   ├── css/          # 全局样式、工具类、变量
│   ├── images/       # 头像、背景图
│   └── js/           # 汉堡菜单等脚本
├── components/
│   ├── layout/       # NavBar、Footer
│   └── widgets/      # Clock、Quote、DaysCounter、TechStack、ProjectsGrid
├── content/          # Markdown 内容（关于页）
├── data/             # 一言数据
├── layouts/          # BaseLayout
└── pages/            # 页面路由
    ├── index.astro       # 首页
    ├── about.astro       # 关于
    ├── projects.astro    # 项目
    ├── friends.astro     # 友情链接
    └── sponsor.astro     # 赞助
```

## 许可证

MIT