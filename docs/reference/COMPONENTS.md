# 组件规范

本项目使用 Astro 和 Svelte 两种组件格式。**选错了格式会让代码变复杂或变笨重**——下面是判断标准。

> 强制约束（选型、水合指令、Svelte 5 写法、功能归属）在 `AGENTS.md` 第 4、14 节，本文是配套的清单与例子。新增组件走文末「新增组件流程」。

---

## 核心原则

> **Astro 优先，Svelte 按需。** 页面骨架和静态内容用 Astro，需要客户端交互时才用 Svelte。

---

## 什么时候用 Astro 组件

满足以下**任意一条**就用 `.astro`：

- 页面布局和结构（导航栏、页脚、布局壳）
- 展示静态数据（名片、技术栈列表、引言）
- 纯展示型卡片（文章卡片、友链卡片、分类树）
- 从 `content/` 读取的 Markdown 渲染
- SEO 相关的 `<head>` 内容
- 样式组件（只是 `<style scoped>` + 少量模板）

**判断方法：** 如果组件不需要 `client:*` 指令，就用 Astro。

```astro
---
import { nickname } from '../../data/profile';
---

<div class="author-card glass">
  <h2>{nickname}</h2>
</div>
```

---

## 什么时候用 Svelte 组件

满足以下**任意一条**就用 `.svelte`：

- 需要 `onMount` / `onDestroy` 生命周期
- 需要 `setInterval` / `setTimeout` 定时器
- 需要 `addEventListener` / 监听 DOM 事件
- 需要响应式状态（`$state` / `$derived`）驱动 UI 更新
- 需要 `requestAnimationFrame` 动画循环
- 需要调用浏览器 API（`window`、`document`、`localStorage`）
- 需要客户端水合（`#swup` 内的岛用 `client:load`，见下文「水合指令约定」）

**判断方法：** 如果组件需要"在浏览器里一直活着"或"响应用户操作不断变化"，就用 Svelte。

```svelte
<!-- ✅ Svelte：需要定时器 + 响应式状态 -->
<!-- Clock.svelte — 实时时钟 -->
<script lang="ts">
  import { onMount } from 'svelte';
  let now = $state(new Date());
  onMount(() => {
    const timer = setInterval(() => {
      now = new Date();
    }, 1000);
    return () => clearInterval(timer);
  });
</script>

<span>{now.toLocaleTimeString()}</span>
```

---

## 混用模式

Astro 组件可以**引用** Svelte 组件，这是项目的主要模式：

```astro
---
import Clock from '../components/widgets/Clock.svelte';
---

<Clock client:load />
```

Svelte 组件**不要**引用 Astro 组件（Astro 组件在构建时渲染，运行时不存在）。

---

## 本项目组件清单

### Astro 组件

路径相对 `src/`；Astro 项目注明的水合指令指其内部 Svelte 岛。功能入口选择与共享依赖边界见 `docs/reference/FEATURES.md`。

| 路径                                                  | 用途                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/layout/NavBar.astro`                      | 顶部导航栏；七个导航项来自单一数据源 `src/data/nav.ts`（桌面 / 移动共用，各界面页头标题图标也从这取），活动项 `is-active` 与下划线服务端渲染（首屏即可见），桌面端由 `assets/js/nav/nav-indicator.ts` 接管后共享线滑动（仅桌面端加载），悬停 / 聚焦 / 当前页只提亮文字（`--white`），不挂 `.hoverable`；移动端汉堡菜单项高亮当前页（文字 + 图标，SSR 首屏 + 切页后 `hamburger.ts` 重算）                                                                                                                |
| `components/layout/Background.astro`                  | 全站背景容器（`div.bg`）：方案由 `src/data/background.ts` 决定，css 走 `virtual:background` 副作用引入，图片走 `getImage` 转 webp 后写入 `--bg-image`                                                                                                                                                                                                                                                                                                                                                   |
| `components/layout/Footer.astro`                      | 页脚                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `components/layout/PageMeta.astro`                    | 对外分享卡（Open Graph / Twitter Card）：由 `BaseLayout` 在 `<head>` 里渲染，页面只给布局传 `image` / `ogType` / `publishedTime`。绝对地址靠 `site.url` 拼；没配图时回落站点方图并降级成 `summary` 小卡（方图配大卡会被裁）                                                                                                                                                                                                                                                                             |
| `components/layout/SideWidgets.astro`                 | 通用悬浮按钮静态标记（返回顶部、阅读进度、到底部）与扩展插槽；文章按钮由 PostsExtras 注入，控制器由对应页面入口引入                                                                                                                                                                                                                                                                                                                                                                                     |
| `components/layout/CustomScrollbar.astro`             | 自定义滚动条                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `components/layout/Markdown.astro`                    | Markdown 内容包裹                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `features/posts/components/GlobalSidebar.astro`       | 文章区常驻左侧边栏（作者卡 + 分类树 + 标签云）：由 `PostsRow` 渲染在 `#swup` 之外、切页不重建；显隐由 `src/features/posts/styles/shell.css` 按 `.page-main--*` 变体与宽度决定，高亮/展开态首屏按 URL 算好、切页后由 `posts-shell.ts` 同步（只补展开不收起，保留手动状态）                                                                                                                                                                                                                               |
| `features/posts/components/PostCard.astro`            | 文章卡片                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `features/posts/components/ImageWrapper.astro`        | 正文/封面图片包装：解析文章相对路径、走 Astro 图片优化；加载失败的降级由`src/features/posts/scripts/image-fallback.ts` 按 DOM 上下文处理（封面类把 `<img>` 摘掉、其余换 `.img-ph` 图标占位块），本地与外链图片都适用                                                                                                                                                                                                                                                                                    |
| `features/posts/components/Breadcrumb.astro`          | 面包屑导航                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `features/posts/components/TableOfContents.astro`     | 文章目录：桌面端在右侧栏（`.post-sidebar`，≤850px 隐藏），窄屏由 `src/features/posts/scripts/toc.ts` 移入目录抽屉；抽屉里的版式差异由组件自己的 `.toc-nav--in-drawer` 变体类承担（抽屉不穿透它的内部结构）；目录项是 `type=button`（非真链接）：swup 不捕获、状态栏不显示地址，点击由 `src/features/posts/scripts/toc.ts` 接管（见 `TROUBLESHOOTING.md` 第 63 条）                                                                                                                                      |
| `features/posts/components/PostCategoryTree.astro`    | 分类树（开合动效由 `src/features/posts/scripts/category-tree.ts` 用 motion 驱动，展开窗口的高度测量由它承担，与后台侧栏二级菜单同一套窗口 + 刚体机制）；搬进筛选抽屉时的版式差异由 `PostsDrawers.svelte` 的抽屉容器选择器承担（节点搬走即自动失效）                                                                                                                                                                                                                                                     |
| `features/posts/components/PostCategoryNode.astro`    | 分类树节点                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `features/posts/components/PostTagCloud.astro`        | 标签云；搬进筛选抽屉时的版式差异由 `PostsDrawers.svelte` 的抽屉容器选择器承担（节点搬走即自动失效）                                                                                                                                                                                                                                                                                                                                                                                                     |
| `features/posts/components/PostNav.astro`             | 上一篇/下一篇                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `features/posts/components/PostNavItem.astro`         | 上一篇/下一篇的单卡：有目标文章渲染链接，否则渲染不可点占位；`dir` 决定图标与文字顺序（样式在 `PostNav.astro` 的 scoped style 里）                                                                                                                                                                                                                                                                                                                                                                      |
| `features/posts/components/Repost.astro`              | 转载声明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `features/posts/components/AuthorCard.astro`          | 作者名片                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `components/widgets/Quote.astro`                      | 随机一言                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `features/about/components/TechStack.astro`           | 技术栈展示                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `features/posts/components/Comments.astro`            | 评论区                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pages/admin/_admin/components/CustomScrollbar.astro` | 后台自定义滚动条：前台 `components/layout/CustomScrollbar.astro` 的独立拷贝（各自维护），脚本用 `src/pages/admin/_admin/js/scrollbar.ts`                                                                                                                                                                                                                                                                                                                                                                |
| `pages/admin/_admin/components/AdminToken.astro`      | 后台连接面板：仓库（单个输入框，填 `owner/repo` 或仓库地址）与访问令牌两个字段，分支取仓库默认分支；放在 `AdminLayout` 的 `#swup` 之外以便跨页常驻                                                                                                                                                                                                                                                                                                                                                      |
| `pages/admin/_admin/components/AdminNav.astro`        | 后台侧边分区导航（两级：父项按钮只开合不跳转、子项是链接）；**图标只给第一级**（首页、文章管理；返回首页的链接不带图标），二级子项一律不带。开合态在服务端按当前路由定好，切页后由 `src/pages/admin/_admin/js/pages.ts` 的 `syncNavActive()` 校正；「回到站点」带 `data-no-swup`，强制整页加载（外壳不同）；二级菜单展开/收起由后台拷贝 `src/pages/admin/_admin/js/expand-collapse.ts` 驱动（同前台 `src/assets/js/util/expand-collapse.ts` 的机制，各自维护；CSS 只留开/关端点，窗口与刚体同曲线同长） |
| `components/layout/PageRow.astro`                     | 通用内容行与 `main#swup`，无水合岛；由 BaseLayout 的对应虚拟入口在文章关闭时选用                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `components/layout/PageExtras.astro`                  | 通用悬浮按钮及页面交互入口，无水合岛；由 BaseLayout 的对应虚拟入口在文章关闭时选用                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `features/posts/layouts/PostsShell.astro`             | 文章列表、分类、标签与详情共用布局；继承 BaseLayout，提供正文、上下篇与评论插槽；自身无水合岛，无 `client:*` 指令                                                                                                                                                                                                                                                                                                                                                                                       |
| `features/posts/layouts/PostsRow.astro`               | 文章常驻侧栏、左缘盒与搜索框，内部 PostSearch 使用 `client:load`                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `features/posts/components/PostsExtras.astro`         | 文章按钮、灯箱与常驻抽屉，内部 PostsDrawers 使用 `client:idle`                                                                                                                                                                                                                                                                                                                                                                                                                                          |
|                                                       |

### Svelte 组件

| 路径                                                | 用途                                                                                                                                                                                                                                                                                                       | 指令          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `features/posts/components/PostSearch.svelte`       | 文章搜索框（列表/分类/标签三界面共用、全站范围、占位符固定「搜索文章」；PostsRow 行级常驻在 `.posts-search-float`、`main#swup` 之外——swup 永不触碰，实例常驻、backdrop 层不重建，位置由 `posts-shell.ts` 按页头占位实测叠放；Pagefind 模块页面空闲时预取一次、加载失败重试 2 次 × 1.5s，首查只付查询成本） | `client:load` |
| `features/posts/components/PostsDrawers.svelte`     | 文章区两个抽屉合一：目录（#toc-fab）+ 分类与标签（#posts-filter-fab），由 PostsExtras 在 SideWidgets 插槽内提供入口按钮                                                                                                                                                                                    | `client:idle` |
| `components/widgets/Clock.svelte`                   | 实时时钟                                                                                                                                                                                                                                                                                                   | `client:load` |
| `components/widgets/DaysCounter.svelte`             | 数据统计卡片（天数 / 经验年数 / GitHub 仓库数三卡；仓库数取数失败时该卡显示占位）                                                                                                                                                                                                                          | `client:load` |
| `features/projects/components/ProjectsGrid.svelte`  | 项目卡片网格                                                                                                                                                                                                                                                                                               | `client:load` |
| `features/about/components/Timeline.svelte`         | 关于页「历程」时间轴：电脑端横向滚动（拖拽 / 触控板），卡片挂 `.glass` 磨砂，两端按滚动位置渐隐（渐隐层里放一份背景容器克隆 `.bg--clone`，由遮罩渐隐，既能跟任意背景方案也能保住卡片的 `backdrop-filter`）；手机端转纵向排列、跟随页面滚动；数据在 `src/data/timeline.ts`                                  | `client:load` |
| `pages/admin/_admin/components/AdminChanges.svelte` | 后台待提交改动面板（列表/撤销/提交说明/一次性提交），在 `AdminLayout` 的 `#swup` 之外，只水合一次                                                                                                                                                                                                          | `client:idle` |

> **水合指令约定（swup 环境）**：放在会被 swup 切页替换的 `main#swup` 容器内的岛，统一用
> `client:load`——它在岛重新插入 DOM 时立刻水合，没有 `client:idle`（等空闲）/ `client:media`、
> `client:visible`（等状态命中）那种"择机水合"在切页后可能迟到或不触发的空窗。
> 布局层常驻岛（不在 `#swup` 内、只水合一次）可按需用 `client:idle`。

> **SideWidgets 特例**：侧边悬浮按钮列用 **`SideWidgets.astro` 纯静态标记 +
> `src/features/posts/scripts/swup-widgets.ts` 运行时控制器**（可用性/显隐/进度/点击全在脚本里，不依赖岛水合——
> 这类岛在 swup 环境下水合不可靠），所以它列在上面的 Astro 组件表里，无需 `client:*` 指令。

---

## 新增组件流程

1. **格式选型**：需要在浏览器里持续跑 JS 吗（定时器 / 事件监听 / 响应式状态驱动 UI / 浏览器 API）？不需要就用 Astro，拿不准也用 Astro。
2. **定目录**：

   | 目录                                                            | 放什么                                  |
   | --------------------------------------------------------------- | --------------------------------------- |
   | `src/components/layout/`                                        | 公共导航、页脚、滚动条、侧边按钮列      |
   | `src/components/widgets/`                                       | 公共时钟、一言与 DaysCounter            |
   | `src/features/posts/components/`、`src/features/posts/layouts/` | 文章组件与布局，含 AuthorCard、Comments |
   | `src/features/about/components/`                                | TechStack 与 Timeline                   |
   | `src/features/projects/components/`                             | ProjectsGrid                            |
   | `src/pages/admin/_admin/components/`                            | 后台自包含组件                          |

3. **写文件**：文件名 PascalCase 与组件名一致；文件头注释按 `AGENTS.md`「开发规范」§8；Astro 用 `interface Props` + `Astro.props`，Svelte 用 `$props()` 且只用 runes。
4. **挑水合指令**（被页面引用时）：`#swup` 内容里的岛只用 `client:load`，布局层常驻岛可 `client:idle`（条款见 `AGENTS.md` §4）；需要按视口或滚动触发的，先怀疑不该用岛——本项目 swup 下 `client:visible` / `client:media` 不可靠，改用纯静态标记 + 所属功能域或 `src/assets/js/` 的脚本（参考 `src/components/layout/SideWidgets.astro` + `src/assets/js/nav/page-widgets.ts`；文章扩展由 `src/features/posts/scripts/swup-widgets.ts` 控制）。
5. **样式**：只服务该组件 / 页面的写组件内 `<style>`；高频复用的元件（卡片 / 按钮这种积木）按用途放入 `src/assets/css/utilities.css` 或文章专属 `src/features/posts/styles/elements.css`，类名由机器聚合进 `docs/REGISTRY.md`（`pnpm registry:write` 重建）；`backdrop-filter` 必须带 `-webkit-` 前缀。
6. **同步文档**：在本文清单里加一行（用途 + `client:*` 指令）；可复用 CSS 类随 `pnpm registry:write` 自动进 `docs/REGISTRY.md`，不用手工维护清单。
7. **校验**：`pnpm format` → `pnpm verify` → `pnpm build`，流程见 `docs/rules/70-verify.md`。

核对清单：

```
- [ ] 格式选型有理由（Astro 静态 / Svelte 有客户端状态）
- [ ] 目录归属正确，文件头注释齐全
- [ ] #swup 内的岛用 client:load
- [ ] 可复用样式进了 utilities.css，backdrop-filter 带 -webkit- 前缀
- [ ] COMPONENTS.md 已同步（CSS 类清单由 `pnpm registry:write` 进 `docs/REGISTRY.md`）
- [ ] pnpm verify 全过、pnpm build 成功
```
