# 70 — 交付前验证

> 读法：任何改动收工前读本篇，照本篇流程自证。

改完代码不要直接说"改好了"。按下面顺序自证，并把命令与实际输出如实报告。

## 1. 格式化

```bash
pnpm format
```

先跑格式化再验证：它幂等，只会把这次改动产生的格式差异落盘；升级 prettier 时才可能全库重排。

## 2. 静态检查（硬门槛）

```bash
pnpm verify
```

**任一组不过就是没过**，不要以"改动很小"为由跳过或只跑一半。它内部按顺序跑，任意一组失败即以退出码 1 结束：

| 组             | 查什么                                  |
| -------------- | --------------------------------------- |
| `format:check` | Prettier 格式一致                       |
| **quality**    | 代码写得合不合规范，见下表              |
| **behavior**   | 业务逻辑对不对（`node --test`），见下表 |
| `astro check`  | 类型检查，必须 0 error                  |

两类检测各自的检查项：

| 类       | 检查              | 查什么                                                                                             |
| -------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| quality  | `check-leaks`     | `console.log` / `any` / `@ts-ignore` / `var` / `!important` / `DOMContentLoaded` / Svelte 4 老语法 |
| quality  | `check-docs`      | 文档里提到的路径与命令真实存在                                                                     |
| quality  | `check-contracts` | 必填 Prop 没人传、脚本导出没人引用、组件无人使用                                                   |
| quality  | `gen-registry`    | 组件清单与代码一致、水合指令一致、`window` 标记与 `env.d.ts` 一致                                  |
| behavior | `category`        | 分类树计数与排序、分类/标签 URL 编码、日期时区、分类链                                             |
| behavior | `nav`             | 导航命中的边界（同前缀兄弟路径、末尾斜杠）                                                         |

- **报错就改代码，不要改检查脚本去迁就代码。** 确实需要豁免时，在那行写 `// check-xxx: allow`（对应脚本名），并在交付说明里写清理由。
- 单独跑：`pnpm test:quality`（四类质检）/ `pnpm test:behavior`（业务测试）/ `pnpm test`（两类都跑，不含格式与类型）。
- 单个质检项：`pnpm check:leaks` / `pnpm check:docs` / `pnpm check:contracts` / `pnpm check:registry`。
- `gen-registry` 报「清单缺失」= 新加了组件没登记，去 `docs/reference/COMPONENTS.md` 补一行（含水合指令）；报「水合指令不符」= 文档与代码写的不是同一个，改其中一处。全表见 `docs/rules/80-doc-sync.md`「机器会替你核的部分」。
- behavior 失败说明业务逻辑真的错了，不是格式问题：先看断言里的中文用例名，再去对应的 `src/lib/` 文件。
- 业务测试直接 import `src/lib/` 下的生产代码（Node ≥ 22.6 的类型擦除），测的是本体，不是复制品。
- `docs/REGISTRY.md` 是 `pnpm registry:write` 生成的机器清单（组件 / CSS 类 / window 标记），可随时重新生成；它与 `docs/reference/COMPONENTS.md` 的区别是：前者是机器写的，后者「用途」列是人写的。
- `pnpm verify` 的报告里若还有 `hint` / `warning`，说明来源；能顺手清掉的就清掉，不要用 `@ts-ignore` 压。

## 3. 构建

```bash
pnpm build
```

必须成功。留意日志里的三类信息：

- `[astro-html-minifier-next] ... Completed`：HTML 压缩完成。
- `[strip-safe-comments] 已移除 N 条非水合注释`：数量应该是几百条量级；如果变成 0，说明页面没生成出来。
- `Successfully compressed a total of N JavaScript files`：独立资源压缩。

## 4. 核对页数

期望总页数 = **6**（首页 / 关于 / 友链 / 项目 / 赞助 / 工具）

- **1**（文章列表 `/posts/`）
- **文章数**
- **分类数**（含文章或 `index.json` 的目录，含中间层级）
- **标签数**（去重）
- **12**（后台页面：`/admin/` 加 11 个 `settings` / `posts` / `categories` 子页）

对上构建日志的总页数。页数变少通常是路由或内容集合出问题（例如内容集合 loader 配错、`getStaticPaths` 没返回条目），要立刻查：

```powershell
(Get-ChildItem -Recurse -Filter *.html dist | Measure-Object).Count
```

## 5. 抽查产物

改动了样式、路由或客户端脚本时，挑一个改动相关的页面看 HTML 是否真的渲染出来了：

```powershell
$c = Get-Content -Raw dist\posts\<分类>\<文章名>\index.html
"h2=" + ([regex]::Matches($c,'<h2')).Count
"p="  + ([regex]::Matches($c,'<p>')).Count
"img=" + ([regex]::Matches($c,'/_astro/')).Count
```

正文页应当有多个 `<h2>` / `<p>`，图片指向 `_astro/` 指纹目录（说明 Astro 图片优化生效）。

## 6. 人工确认（构建查不出来的）

- swup 切页后新的交互还活着吗（侧边按钮、目录高亮、图片灯箱）。
- 玻璃模糊在 Firefox 是否正常（`backdrop-filter` 的 `-webkit-` 前缀没被压缩掉）。
- 新增文章在 `pnpm dev` 下搜索不到时，先确认跑过 `pnpm build`（Pagefind 索引来自 `dist/`）。

## 7. 同步文档

代码改了就要照 `docs/rules/80-doc-sync.md` 的对照表更新对应文档，并走该篇「顺手检查」清单核对。

## 8. 报告格式

一句话结论 + 证据，例如：

> `pnpm verify` 全过；`pnpm build` 生成 30 页（改前 30 页）。抽查 `dist/posts/devnotes/css/at-rule/index.html`：7 个 `<h2>`、18 处 `_astro/` 图片。

有已知遗留问题就直说，并指出是否是本次改动引入的。

## 验证可以暂缓的时候

用户明确要求「快点 / 先别构建 / 待会再说」时，三步都可暂缓，交付时直接说明「验证未跑」。暂缓的验证必须在收尾时（用户说做完了或要求验证时）一次性补齐，见 `AGENTS.md` §9。

## 环境备注

本会话沙箱为 `workspace-write` 时，子进程可能因管道 stdio 受限而让 `pnpm verify` / `pnpm build` 以 `spawn EPERM` 失败。
那是沙箱限制、不是代码问题：把该次 pwsh 升到 `danger-full-access` 重跑同一条命令即可。

## 不要做

- 不要以"构建太慢"为理由跳过 `pnpm build`。
- 不要在没有实际运行的情况下声称检查通过。
- 不要在暂缓验证后一直不补：收尾时必须把格式化 + verify + build 跑完。
