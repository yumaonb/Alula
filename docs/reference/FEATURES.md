# 功能开关与构建边界

本文说明开关如何进入构建、功能如何接入公共外壳，以及组合构建如何核对关闭结果。开发约束统一见 `AGENTS.md`「开发规范」第 14 节。

## 固定路由与可选入口

`src/pages/index.astro`、`src/pages/404.astro` 与 `src/pages/admin/` 由 Astro 自动注册，任何功能组合都保留首页、前台 404 和五个后台页面。404 不设开关；后台和前台 404 不进入站点地图。

六个前台页面与两个端点由 `src/data/config.ts` 的 `features` 开关常量配置。修改开关后重启 `pnpm dev`，使路由与模块解析使用新配置。

| 开关                 | URL                           | 源码入口                                                      |
| -------------------- | ----------------------------- | ------------------------------------------------------------- |
| `pages.about`        | `/about/`                     | `src/features/about/AboutPage.astro`                          |
| `pages.projects`     | `/projects/`                  | `src/features/projects/ProjectsPage.astro`                    |
| `pages.posts`        | `/posts/`、文章、分类、标签页 | `src/features/posts/pages/`                                   |
| `pages.tools`        | `/tools/`                     | `src/features/tools/ToolsPage.astro`                          |
| `pages.friends`      | `/friends/`                   | `src/features/friends/FriendsPage.astro`                      |
| `pages.sponsor`      | `/sponsor/`                   | `src/features/sponsor/SponsorPage.astro`                      |
| `endpoints.sitemap`  | `/sitemap.xml`                | `src/features/sitemap/sitemap.xml.ts`                         |
| `endpoints.postsRss` | `/posts/rss.xml`              | `src/features/posts/endpoints/rss.xml.ts`，同时受文章开关约束 |

`src/lib/feature-definitions.ts` 只承载内部路由声明与 `FeatureKey` 类型，`src/integrations/feature-routes.ts` 读取清单注入路由。导航名称、图标与顺序配置在 `src/data/nav.ts`，URL 由路由声明派生。关闭页面后，对应导航与站点地图条目随有效开关过滤。

## 可编辑数据与派生逻辑

`src/data/` 集中保存纯静态可编辑设置、展示数据及对应类型；可编辑项分类索引见 `README.md`「功能配置」，目录边界的规范见 `AGENTS.md` 第 14 节。内部路由声明与派生函数位于 `src/lib/`：

| 文件                             | 职责                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `src/data/config.ts`             | 日常页面与端点开关，以及 `FeatureConfig` 类型                                      |
| `src/data/nav.ts`                | 导出 `navConfig` 对象，键顺序决定导航顺序，`Record<NavKey, NavLabel>` 保证条目完整 |
| `src/data/profile.ts`            | 昵称、格言与个人介绍                                                               |
| `src/data/social-links.ts`       | 导出可编辑的 `socialLinks` 纯数组及对应类型                                        |
| `src/lib/feature-definitions.ts` | 内部路由声明与 `FeatureKey` 类型                                                   |
| `src/lib/navigation.ts`          | 读取导航配置与路由声明，提供 `getNavItems(features)` / `getNavItem(key)`           |
| `src/lib/social-links.ts`        | 读取联系方式配置，提供 `getSocialLinks(features)`                                  |

`getNavItems(features)` 按配置顺序生成首页与已开启功能的导航；首页地址为 `/`，可选页面地址取对应功能的首条路由。`getNavItem(key)` 提供页面标题与图标等元数据，查询不受开关过滤影响。桌面、移动导航与页头因此共用同一份名称和图标。

`getSocialLinks(features)` 返回配置的联系方式，并在 `features.pages.posts` 与 `features.endpoints.postsRss` 同时为真时附加 RSS。首页与作者卡直接使用该函数的结果；个人介绍由 `src/data/profile.ts` 单独提供。

## 同一份有效配置

`astro.config.ts` 导出 `createSiteConfig(features, { cacheDir, reportDir })` 工厂，默认导出用 `src/data/config.ts` 中的日常配置调用工厂。组合验证也调用这个工厂，只传入独立的场景配置和目录；工厂接收目录 URL，再将 `root` / `cacheDir` 转为 Astro 5 所需的路径字符串。

集成通过 `virtual:site-features` 把本次构建的有效开关交给页面、组件与 `src/content.config.ts`。页面和组件将开关传给 `getNavItems(features)` / `getSocialLinks(features)`；配置阶段插件直接传入配置工厂交给它们的 `selectedFeatures`。两类调用方共用纯函数，数据文件自身不读取虚拟模块，也不执行过滤。

因此场景构建中的内容加载、RSS 自动发现、导航和社交链接与注入路由采用同一份配置。文章关闭时，文章集合、Pagefind 索引和 RSS 均停止生成，即使 RSS 开关本身为真。关于页直接读取 `src/content/about.md`，不依赖文章集合。

## 明确的构建期扩展入口

`src/integrations/feature-routes.ts` 只对下列明确的虚拟入口选择实现。真实文件的相对导入保持其字面含义，公共调用方能直接看出扩展边界。

| 虚拟入口                             | 文章开启                                          | 文章关闭                                               |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------------ |
| `virtual:features/page-row.astro`    | `src/features/posts/layouts/PostsRow.astro`       | `src/components/layout/PageRow.astro`                  |
| `virtual:features/page-extras.astro` | `src/features/posts/components/PostsExtras.astro` | `src/components/layout/PageExtras.astro`               |
| `virtual:features/image-fallback`    | `src/features/posts/scripts/image-fallback.ts`    | `src/assets/js/ui/image-fallback.ts`                   |
| `virtual:features/sitemap-posts`     | `src/features/posts/sitemap-entries.ts`           | `src/features/sitemap/post-entries.ts`，返回空文章条目 |

`src/layouts/BaseLayout.astro` 通过内容行与常驻交互入口接入扩展，自身没有 Svelte 岛。`PostsRow` 包含侧栏、左缘盒和搜索框，搜索岛使用 `client:load`；`PostsExtras` 包含文章按钮、灯箱和抽屉，常驻抽屉岛使用 `client:idle`。常驻件位于 `#swup` 外，切页只替换内容列。通用实现保留相同的 `main#swup` 内容容器。水合机制见 `docs/reference/COMPONENTS.md`。

前台与后台各自的 `shell-guard.ts` 分别由 `src/layouts/BaseLayout.astro` 和 `src/pages/admin/_admin/AdminLayout.astro` 直接加载。跨外壳点击及浏览器前进、后退走整页加载，后台不经过前台的扩展入口。

## 功能归属与公共核

| 位置                                | 职责                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- |
| `src/features/posts/components/`    | 文章卡片、目录、分类树、搜索、抽屉、评论与仅文章侧栏使用的 AuthorCard |
| `src/features/posts/layouts/`       | PostsShell 页面布局与 PostsRow 常驻内容行                             |
| `src/features/posts/scripts/`       | 文章外壳、目录、浮层、按钮、灯箱、抽屉和文章图片降级                  |
| `src/features/posts/styles/`        | 文章行与转场、元件、列表、灯箱、抽屉、图片降级及专属令牌              |
| `src/features/posts/lib/`           | 分类纯函数、文章数据与视图、文章图片解析                              |
| `src/features/about/components/`    | TechStack 与 Timeline                                                 |
| `src/features/projects/components/` | ProjectsGrid                                                          |
| `src/content/`                      | 集中管理文章与关于页正文                                              |
| `src/data/`                         | 纯静态可编辑设置、展示数据及对应类型                                  |
| `src/lib/`                          | 内部路由声明、导航与社交链接派生纯函数、导航匹配等公共工具            |

公共 Markdown 组件和 `src/assets/css/shared/markdown.css` 同时服务文章与关于页，高亮令牌在 `src/assets/css/shared/variables.css`。通用图片占位、导航匹配、背景、滚动条、公共 GitHub 客户端和 DaysCounter 保持公共归属。功能关闭后，这些仍有消费者的公共依赖继续存在。

仅在模板中隐藏组件仍会让静态依赖进入构建。模块图审计由 `src/integrations/feature-audit.ts` 检查关闭功能的来源，最终 HTML、CSS、图片和索引还由组合验证直接核对。

## 新增功能流程

1. 按 `AGENTS.md` 第 14 节确定功能归属，在功能域内组织页面及专属依赖，内容和配置继续集中管理。
2. 在 `src/data/config.ts` 配置开关，在 `src/lib/feature-definitions.ts` 登记页面路由，在 `src/data/nav.ts` 配置导航名称、图标与顺序；通过现有派生函数接通有效开关，全站扩展按现有明确入口的职责接入。
3. 对照 `docs/reference/COMPONENTS.md` 登记组件和水合情况，并同步脚本、样式职责及受影响的契约锚。
4. 按常规流程和下文组合构建核对开启、关闭产物，再抽查 Swup 切页与交互。

## 可选公开资源

`src/integrations/feature-assets.ts` 按有效配置生成 `robots.txt`、`llms.txt`，文章开启时生成 `css/giscus.css`；开发服务器提供对应地址。giscus 主题源码在 `src/features/posts/assets/giscus.css`。`public/` 中的资源会无条件复制，可选功能资源通过功能域内源码和构建入口控制。robots 始终保留 `Disallow: /admin/`。

llms 的导航与社交链接分别来自 `getNavItems(selectedFeatures)` 和 `getSocialLinks(selectedFeatures)`，生成资源与页面渲染共用上文的派生逻辑及本次有效开关。

## 组合构建验证

常规验证流程见 `docs/rules/70-verify.md`。`node tests/feature-build.mjs` 使用真实 Astro 构建验证下列三个场景；各场景从所有六个页面均为 `true` 的固定基线派生，不受日常配置中关闭了哪些页面影响。

| 场景                | 配置与验证重点                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `minimal-frontend`  | 六页面和两端点全关；首页、前台 404、五个后台页面，共 7 个 HTML                                        |
| `without-posts`     | 仅文章页面关闭，其余五页面开启；sitemap 与 RSS 开关均为真，但 RSS 因文章关闭而不生成；后台与 404 保留 |
| `without-endpoints` | 六页面全部开启，两端点关闭；所有页面继续生成，后台与 404 保留                                         |

每个场景目录包含独立的 `astro.config.ts`、`dist/`、`cache/`、`reports/` 和 `build.log`。脚本生成 TypeScript 构建配置，以项目相对路径传给 Astro 的 `--config`（Windows 绝对路径不适用），调用配置工厂并把产物导向该场景目录，结束时核对 `src/data/config.ts` 内容与运行前一致；日常配置不参与改写或备份。

| 场景目录                                  | 内容                                     |
| ----------------------------------------- | ---------------------------------------- |
| `.astro/feature-check/minimal-frontend/`  | 最小前台的配置、产物、缓存、报告与日志   |
| `.astro/feature-check/without-posts/`     | 无文章场景的配置、产物、缓存、报告与日志 |
| `.astro/feature-check/without-endpoints/` | 无端点场景的配置、产物、缓存、报告与日志 |

`.astro/feature-check.lock` 以独占方式防止同时运行两次矩阵。Astro 的部分生成类型仍共享项目目录，因此场景隔离不代表可以与 `pnpm dev` 或其他 Astro 构建并发；运行时先停止这些任务。

汇总写入 `.astro/feature-check-results.json`。核对流程如下：

1. 检查退出码和汇总中的三个场景结果，并确认源码配置未变。
2. 读取各场景 `reports/` 中的 `feature-routes.json` 和 `feature-client.json`，核对有效开关、注入路由和客户端模块来源。固定自动路由不在注入清单中，直接查对应 `dist/` 的首页、404 和后台五页。
3. 检查各场景最终产物的页面与端点、导航和 RSS 自动发现、CSS、图片、Pagefind 索引、giscus 主题及 robots 后台排除项；不只比较 HTML 总数。
4. 人工抽查关于页正文、通用图片降级、跨外壳导航，以及文章开启时的 Swup 切页、搜索、目录、评论、图片优化与灯箱。

日常构建报告为 `.astro/feature-routes.json` 与 `.astro/feature-client.json`；组合构建报告使用各场景 `reports/`。报告、日志和测试配置均不进入站点部署产物。
