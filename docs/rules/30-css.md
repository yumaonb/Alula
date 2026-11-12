# 30 — 样式与 CSS

> 读法：动 `src/**/*.{css,astro,svelte}` 里的样式之前读本篇。样式条款（令牌、磨砂、悬停、断点、宽度）见 `AGENTS.md`「开发规范」第 5 节；类名清单见 `docs/REGISTRY.md`（机器生成，`pnpm registry:write` 重建），样式机制与令牌规则见 `docs/reference/CSS.md`。本篇只记「放哪里」。

## 放哪里

| 内容                                                         | 位置                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| 设计令牌（圆角、模糊半径、悬停色、悬停提亮时长 `--t-hover`） | `src/assets/css/variables.css` 的 `:root`                        |
| 后台专属令牌（`--nav-*` / `--admin-shadow*`）                | `src/assets/css/admin/variables.css` 的 `:root`                  |
| 高频复用的元件级类（玻璃卡片、按钮、头像等）                 | `src/assets/css/utilities.css`                                   |
| 只服务单个组件的样式                                         | 该组件的 `<style>`（Astro 默认 scoped）                          |
| Markdown 正文排版                                            | `src/assets/css/posts/markdown.css`                              |
| 文章列表 / 分类 / 标签页共享                                 | `src/assets/css/posts/posts-listing.css`（由 `PostsShell` 引入） |
| 全站背景方案                                                 | `src/assets/backgrounds/`，由 `src/data/background.ts` 选        |

组件里不要重复定义 `utilities.css` 已有的类；新加的可复用类随 `pnpm registry:write` 自动进 `docs/REGISTRY.md`，不用手工维护清单。
