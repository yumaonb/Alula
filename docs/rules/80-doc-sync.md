# 80 — 文档同步

> 读法：**每次改动收工前读本篇**，照对照表更新文档，再走文末「顺手检查」清单。

代码改了而文档没跟上，比没有文档更糟：下一个人（或下一个 agent）会照着错的说明动手。
所以「改了什么」和「更新哪份文档」是一一对应的，不是可选项。

## 对照表（改了什么 → 更新哪里）

| 改了什么                                                                      | 必须更新                                                                                                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 新增 / 删除 / 改名组件，改了水合指令                                          | `docs/reference/COMPONENTS.md` 的组件清单（Astro 表或 Svelte 表，含 `client:*`）                                                        |
| 新增可复用 CSS 类、改令牌、新增 CSS 文件、改背景预设                          | 类名清单随代码自动进 `docs/REGISTRY.md`（`pnpm registry:write` 重建），不用手工登记；机制 / 令牌 / 背景相关仍改 `docs/reference/CSS.md` |
| 改数据流、路由生成、布局插槽、客户端脚本职责、`window` 标记                   | `docs/reference/ARCHITECTURE.md`                                                                                                        |
| 改 frontmatter 字段、目录约定、图片解析                                       | `docs/reference/CONTENT.md` + `docs/rules/50-content.md`                                                                                |
| 修掉或新发现一个坑（样式失效、切页异常、搜不到文章）                          | `docs/reference/TROUBLESHOOTING.md` 加一条（症状 → 原因 → 处理）                                                                        |
| 新增 / 删除 / 改名文档或规则                                                  | `docs/reference/index.md` 的结构树 + `AGENTS.md` 的路由表                                                                               |
| 改命令、依赖、目录结构                                                        | `docs/rules/00-project.md` + `AGENTS.md`（两处都要）                                                                                    |
| 改规范条款（命名 / 风格 / 组件 / 样式 / 脚本 / 内容 / 注释 / 验证 / git）     | `AGENTS.md` 的「开发规范」节                                                                                                            |
| 改构建配置（`astro.config.ts` 集成、`compress`、`htmlMinifier`）              | `docs/reference/ARCHITECTURE.md` 的构建流水线表 + `docs/reference/TROUBLESHOOTING.md`                                                   |
| 动了代码注释契约锚或 TROUBLESHOOTING 决定台账相关的代码（联动变化、拍板变化） | 同日复核锚 / 台账条目是否仍成立（文件:行号还准不准、契约还成不成立、决定还有效没）；不成立的删掉                                        |

## 三条硬要求

1. **同一件事只讲一处**。规则留短约束、文档放细节，别在两处重复写同一段说明。
2. **删掉过时内容**，不要留「以前是 xxx」的变更史——git log 里有。
3. **文档里写的路径必须真实存在**。改完顺手核一遍 `AGENTS.md` 与 `index.md` 指向的文件是否都还在。

## 机器会替你核的部分

`pnpm verify` 里的 `check-docs` 与 `gen-registry` 会自动核对下列几条，不用人工逐条对：

| 机器核什么                              | 报错了怎么改                                                       |
| --------------------------------------- | ------------------------------------------------------------------ |
| 文档里提到的路径 / 命令不存在           | 改成真实路径；确实是「从哪迁到哪」的记叙，改成泛指写法（别加豁免） |
| 代码里有组件但 `COMPONENTS.md` 没登记   | 补一行（含 `client:*` 指令）                                       |
| `COMPONENTS.md` 列了代码里没有的组件    | 删掉那行（组件已删或改名）                                         |
| `COMPONENTS.md` 写的水合指令与代码不符  | 改其中一处，两边必须一致                                           |
| `window.__xxx` 没在 `src/env.d.ts` 声明 | 补声明；声明了但没人用则删声明                                     |
| 必填 Prop 没人传、脚本导出没人引用      | 删掉死代码；或给那行加 `// check-contracts: allow` 并写清理由      |

`docs/REGISTRY.md` 是机器生成的清单（组件 / CSS 类 / window 标记），`pnpm registry:write` 可随时重建——**不要手工编辑它**。

## 顺手检查（机器查不了的）

```
- [ ] docs/reference/CSS.md 的文件表与 src/assets/css 实际一致
- [ ] docs/reference/ARCHITECTURE.md 的脚本职责表与 src/assets/js、src/pages/admin/_admin/js 实际一致
- [ ] AGENTS.md 的规则 / 任务路由指向的文件都还存在
- [ ] docs/reference/index.md 的文档列表没有指向已删除的文件
- [ ] 没有把细节重复写进规则和文档两处
```

## 什么时候不用写文档

- 代码本身已经说清楚的
- `README.md` 里已经有的（那是面向使用者的，不要重复）
- 纯格式重排、一次性调试、git log 能查到的
- 只是修了错别字或注释措辞（不改变约定的那种）

## 收工顺序

```
改代码 → pnpm format → pnpm verify → pnpm build → 按上表同步文档
```
