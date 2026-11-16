# 60 — 客户端脚本

> 读法：动 `src/assets/js/`、`src/features/` 内脚本、`src/pages/admin/_admin/js/` 或组件里的 `<script>` 之前读本篇。脚本条款（位置、语言、判空、幂等、事件选择、清理）见 `AGENTS.md`「开发规范」第 6 节。本篇只记规范里没有的细节。

站点用 `@swup/astro` 做无刷新切页，页面内容会被整块替换。脚本必须假设 **DOM 会在任何时候被换掉**。

## swup 事件时机表

`@swup/astro` 会把 swup 的 hook 以 DOM 事件派发到 `document`，名字是 `swup:<hook>`：

| 事件                                                         | 时机                                    |
| ------------------------------------------------------------ | --------------------------------------- |
| `swup:visit:start`                                           | 开始跳转，适合收起弹层、重置 UI         |
| `swup:content:replace`                                       | 旧内容已换成新内容（此刻新 DOM 才可用） |
| `swup:visit:end`                                             | 整次跳转结束                            |
| `swup:scroll:start` / `swup:scroll:end`                      | 滚动复位前后                            |
| `swup:any`                                                   | 任意 hook，调试用                       |
| `astro:before-swap` / `astro:after-swap` / `astro:page-load` | 同一批时机的 Astro 风格别名             |

不确定事件名时在控制台跑 `document.addEventListener('swup:any', e => console.log(e.detail.hook))`，以实际打印为准。

## 幂等标记清单

已在用的标记（均已在 `src/env.d.ts` 声明）：`__tocInit`、`__postCatTreeBound`、`__postsShellInit`、`__alulaImageFallbackBound`、`__alulaLightboxBound`、`__alulaShellGuard`、`__adminShellInit`、`__navIndicatorInit`。新增标记要同步补声明。

## 跨模块共享状态细节

`breakpoint.ts` 把同一函数挂到 `window.__onEnterDesktop`；目录 / 筛选抽屉（布局层岛）从全局取共享的断点监听器；`NavBar` 的模块脚本在每页副作用 import `breakpoint.ts`，保证桌面与移动端都有这个全局（汉堡菜单脚本只在移动端加载）。目前只有 `breakpoint.ts` 一处赋值。
