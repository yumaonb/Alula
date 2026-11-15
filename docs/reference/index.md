# 项目文档索引

本目录是**参考资料**：需要细节时按需阅读。开发规范整合在根 `AGENTS.md` 的「开发规范」节（每次请求自动注入，无需主动读）；各文件触发与独有细节在 `docs/rules/`，操作流程写进对应文档的「流程」节（新增文章 → `docs/reference/CONTENT.md`、新增组件 → `docs/reference/COMPONENTS.md`、交付前验证 → `docs/rules/70-verify.md`、文档同步 → `docs/rules/80-doc-sync.md`）。

> 只有根目录 `AGENTS.md` 自动加载。规则与文档都不在自动加载范围内，靠 `AGENTS.md` 的路由表按需读。

---

## 什么时候读哪篇

| 你要做的事                                                                            | 读这篇                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 任何代码改动前，查规范（命名 / 风格 / 组件 / 样式 / 脚本 / 内容 / 注释 / 验证 / git） | 根 `AGENTS.md` 的「开发规范」节（自动注入，无需主动读） |
| 搞清数据怎么流、路由怎么生成、脚本各自管什么                                          | [ARCHITECTURE.md](./ARCHITECTURE.md)                    |
| 写文章、建分类、填 frontmatter、放图片                                                | [CONTENT.md](./CONTENT.md)                              |
| 遇到诡异现象，或查已知雷区 + 决定台账（刻意设计 / 已知不修 / 排查过不是 bug）         | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)              |
| 动全站必经点文件、查文件间「两处同改」契约、后台改数据的跨墙通道                      | [COUPLING.md](./COUPLING.md)                            |
| 新增 Astro / Svelte 组件，选水合指令                                                  | [COMPONENTS.md](./COMPONENTS.md)                        |
| 加类名、改令牌、知道有哪些现成工具类                                                  | [CSS.md](./CSS.md)                                      |
| 维护这套文档本身                                                                      | [CONTRIBUTING.md](./CONTRIBUTING.md)                    |

---

## 规范结构

```
AGENTS.md                  唯一自动加载的入口（自动注入）：项目一句话、命令、开发规范全文、路由表
docs/                      项目文档，随仓库走
├── REGISTRY.md            自动生成的清单（组件 / CSS 类 / window 标记），由 pnpm registry:write 重建
├── rules/                 各文件触发与独有细节，照 AGENTS.md 的表主动读
│   ├── 00-project.md            项目总览、命令、目录地图、硬约束
│   ├── 30-css.md                样式放哪里
│   ├── 40-astro-svelte.md       组件选型与水合细节
│   ├── 50-content.md            内容与分类细节
│   ├── 60-client-script.md      客户端脚本事件细节
│   ├── 70-verify.md             交付前验证（含完整自检流程与核对清单）
│   └── 80-doc-sync.md           改了什么 → 更新什么（文档同步，含顺手检查清单）
└── reference/             本目录，参考资料
    ├── index.md                 本文，导航
    ├── ARCHITECTURE.md          架构与数据流
    ├── CONTENT.md               内容体系（含新增文章流程与核对清单）
    ├── TROUBLESHOOTING.md       已知雷区 + 决定台账（刻意设计 / 已知不修 / 排查过不是 bug）
    ├── COUPLING.md              全站必经点与文件间契约（耦合面与爆炸半径）
    ├── COMPONENTS.md            组件清单与选型（含新增组件流程与核对清单）
    ├── CSS.md                   样式机制与令牌规则（类名清单见 REGISTRY.md）
    └── CONTRIBUTING.md          规范维护准则
```

> `AGENTS.md` 与 `docs/` 都随仓库入库。

---

## 补充说明

- 根目录 `README.md` 面向使用者（介绍与命令），本目录面向开发与 AI。
- 文档与代码注释一律中文。
- 包管理器是 pnpm。
- 规范只有 `docs/` 与根 `AGENTS.md` 一份。
