# COUPLING — 全站必经点与文件间契约

> 读法：动下面清单里的文件、或改任何带「两处同改」约束的值之前读本篇。

本篇列出公共外壳、功能入口与跨文件契约的影响范围；规范统一见 `AGENTS.md`，具体机制见各参考文档。

功能开关与入口选择见 `docs/reference/FEATURES.md`。首页、前台 404 与后台固定自动路由；可选功能经清单与明确虚拟入口接入。

## 必经点清单

| 文件                                        | 为什么必经                                                                   | 写坏后的爆炸半径                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `astro.config.ts`                           | 配置工厂、默认配置和构建流水线                                               | 有效开关或路径转换出错会影响日常构建与组合验证                          |
| `src/lib/feature-definitions.ts`            | 内部路由声明与 `FeatureKey` 类型                                             | 注入路由与派生导航地址同步受影响                                        |
| `src/data/nav.ts`                           | 导航名称、图标与顺序的可编辑配置                                             | 桌面 / 移动导航、页面标题与公开资源中的导航展示同步受影响               |
| `src/lib/navigation.ts`                     | 导航派生与单项查询纯函数                                                     | 导航、页面标题、站点地图顶层入口与 llms 链接同步受影响                  |
| `src/data/social-links.ts`                  | 可编辑联系方式及对应类型                                                     | 首页、作者卡与 llms 中的联系方式同步受影响                              |
| `src/lib/social-links.ts`                   | 联系方式派生与 RSS 自动附加纯函数                                            | 首页、作者卡与 llms 的 RSS 入口需与有效开关一致                         |
| `src/integrations/feature-routes.ts`        | 有效配置与明确虚拟入口                                                       | 页面、内容加载和扩展实现需使用同一开关快照                              |
| `src/layouts/BaseLayout.astro`              | 前台壳层，通过明确虚拟入口接入内容行与常驻交互，并直接加载前台跨外壳导航守卫 | 全部前台页面及其全局 css / js 入口、前台跨后台导航                      |
| `src/features/posts/lib/posts-data.ts`      | 文章数据入口，由文章页面与 PostsRow 在构建期读取                             | 异常 = 构建失败（fail fast）；口径错 = 上线后静默 404                   |
| `src/features/posts/lib/posts-views.ts`     | 文章视图口径（`posts` / `allPosts` / `chronological` / `tags` / `allTags`）  | 口径错构建全绿，上线后静默坏链                                          |
| `src/features/posts/lib/category.ts`        | 文章域内由构建侧与浏览器侧共用的纯函数                                       | 塞构建期依赖炸客户端构建；塞浏览器 API 炸 frontmatter；逻辑错切页后才露 |
| `src/data/site.ts`                          | 前台 7 处 + 后台 3 处共用，站点标题 / OG / RSS / 评论参数 / 后台设置全挂它   | 结构错构建期炸；取值错运行时静默                                        |
| `src/features/posts/scripts/posts-shell.ts` | 文章区切页编排枢纽，四个子件都挂在它下面                                     | 全部 /posts 页的搜索框 / 左缘条 / 行状态同时错位                        |
| `src/pages/admin/_admin/AdminLayout.astro`  | 后台自动路由共 18 页，始终经过该布局                                         | 后台 18 页全灭，不外溢前台                                              |

验证要求见 `AGENTS.md` 第 9、14 节；操作流程见 `docs/rules/70-verify.md` 与 `docs/reference/FEATURES.md`。

## 文件间「两处同改」契约

| 契约                                              | 位置                                                                                      | 只改一处的后果                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| frontmatter 缺字段默认值双拷贝                    | `src/content.config.ts` 的 transform ↔ `src/features/posts/lib/posts-views.ts` 的默认映射 | 构建通过，两层取到不同默认值                         |
| 版面同值（768/769、850/1150/1151 断点与导航高度） | 刻意不抽共享常量，推导与分批表见 `docs/reference/CSS.md` 的「断点」节                     | 版面错位；改某处只同步同一条版面规则的其它处，不拉齐 |

## 后台 → 全站的唯一跨墙通道

后台文章编辑器在运行时通过 GitHub API 直接改写 `src/content/posts/` 目录下的文章与各分类的 `index.json`（流程见 `docs/reference/ARCHITECTURE.md` 的「后台的数据流」节）。这是后台影响前台的唯一路径，也是唯一绕过本地验证的路径：经它改出的内容，在下次构建前必须过一次 `pnpm build`。
