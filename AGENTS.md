# AGENTS.md

Alula：Astro 5 + Svelte 5 + TypeScript 的静态个人站点（深色毛玻璃风格），包管理器 pnpm。所有页面在构建期生成，没有服务端。

## 命令

```bash
pnpm dev       # 开发服务器
pnpm format    # Prettier 全量重排（收工第一步）
pnpm verify    # 代码质量 + 业务测试 + 类型检查（收工第二步，硬门槛）
pnpm build     # 构建到 dist/（收工第三步）
pnpm test      # 只跑两类检测（quality + behavior），不看格式与类型
```

## 规范怎么加载

本文件是唯一自动加载的入口（每次请求自动注入），并承载下面的「开发规范」全文；其余各层按需读：

| 层          | 位置                  | 怎么拿到                             | 成本     |
| ----------- | --------------------- | ------------------------------------ | -------- |
| 入口 + 规范 | 本文件                | **每次请求自动注入**                 | 常驻     |
| 规则        | `docs/rules/*.md`     | 不自动加载，照「规则怎么读」表主动读 | 读到才花 |
| 文档        | `docs/reference/*.md` | 直接读                               | 按需     |

## 规则怎么读（规则不自动加载，靠这张表）

| 要动的文件                                                       | 动手前先读                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| 项目总览、命令、目录地图、项目级硬约束                           | `docs/rules/00-project.md`                                           |
| CSS / 样式放哪里                                                 | `docs/rules/30-css.md`                                               |
| 组件选型与水合指令（`src/**/*.{astro,svelte}`）                  | `docs/rules/40-astro-svelte.md`                                      |
| 文章内容（`src/content/**`）                                     | `docs/rules/50-content.md`                                           |
| 客户端脚本（`src/assets/js/**`、`src/pages/admin/_admin/js/**`） | `docs/rules/60-client-script.md`                                     |
| 收工前                                                           | `docs/rules/70-verify.md` 验证、`docs/rules/80-doc-sync.md` 同步文档 |

## 开发规范

> 本项目开发规范条款的唯一来源：所有「必须做 / 禁止做」按主题集中，一条一行。
> 不写技术机制（swup 为什么那样表现、压缩器为什么那样行为），细节查 `docs/reference/ARCHITECTURE.md` / `TROUBLESHOOTING.md`。
> `docs/rules/` 只保留「动哪个文件前读哪篇」的触发与各篇独有细节；规范条款与本节不一致时，以本节为准。

### 1. 硬约束

- 不引入新的前端框架或 CSS 框架；动画只允许 `motion` 的 vanilla API（不引框架版）。
- 不写只在浏览器里成立的顶层代码：`.astro` 前置脚本在构建期执行，`window` / `document` 只能出现在 `<script>` 块或 Svelte 生命周期里。
- 不用淘汰的语法：HTML 的淘汰标签与属性（`<font>` / `<center>` / `<marquee>` / `align=` / `bgcolor=`），CSS 的淘汰写法（IE 滤镜、`-moz-opacity` 之类）。
- 后台是自包含外壳：组件 / 样式 / 脚本全部在 `src/pages/admin/_admin/`（下划线目录不被 Astro 路由），禁止 import 前台的 `src/components/`、`src/layouts/`、`src/assets/`；需要相同的东西就拷进 `_admin/` 各自维护；共享的只有构建期配置 `src/data/`。

### 2. 命名

#### 2.1 文件

| 类型                 | 约定                            | 例子                             |
| -------------------- | ------------------------------- | -------------------------------- |
| Astro / Svelte 组件  | PascalCase，与文件一致          | `PostCard.astro`                 |
| TS / JS 脚本         | kebab-case                      | `posts-data.ts`                  |
| CSS 文件             | kebab-case                      | `posts-listing.css`              |
| 数据文件 `src/data/` | kebab-case                      | `site.ts`                        |
| 路由文件             | 与 URL 一致，动态段 `[param]`   | `[...slug].astro` / `rss.xml.ts` |
| 文章 / 分类目录      | 小写 + 连字符，不中文、不放空格 | `devnotes/css/at-rule.md`        |
| 图片                 | kebab-case                      | `cover.webp`                     |
| 背景预设             | kebab-case                      | `wave-dots.css`                  |

- 文件名一律英文；显示名走元数据（`index.json` / frontmatter），不放进文件名。
- 存量不合规文件（`techstack.ts`、`dayscounter.ts`、`src/assets/js/` 下的 `.js`）保留不改名，**禁止再新增**；确要改名时所有引用一次改完。

#### 2.2 代码

| 对象                 | 约定                                       | 例子                       |
| -------------------- | ------------------------------------------ | -------------------------- |
| 函数、变量           | camelCase                                  | `buildCategoryTree`        |
| 类型、接口、类、枚举 | PascalCase，接口不加 `I` 前缀              | `PostItem`                 |
| 模块级常量           | UPPER_SNAKE                                | `MAX_PAGES`                |
| 模块内配置常量       | camelCase                                  | `postRoute`                |
| 布尔变量             | `is` / `has` / `can` / `should` 前缀       | `isOpen`                   |
| 事件处理             | DOM 回调 `onXxx`；内部逻辑函数 `handleXxx` | `onClick` / `handleSubmit` |
| `window` 全局标记    | `__` + camelCase，并在 `src/env.d.ts` 声明 | `__tocInit`                |

- 同一名字全项目只表达一个含义，禁止同名异义。
- 四字母以上的缩写写全（`category` 不写 `cat`）；通用缩写（id、url、api、dom）保持。
- 名字表达意图：`rows` 优于 `data`，`visible` 优于 `flag`。

#### 2.3 CSS 与 DOM

| 对象           | 约定                                         | 例子             |
| -------------- | -------------------------------------------- | ---------------- |
| 类名           | kebab-case，语义短语或 BEM                   | `.glass-btn--sm` |
| 设计令牌       | `--` + kebab-case，只在 `variables.css` 定义 | `--t-hover`      |
| 令牌作用域前缀 | 多场景令牌加场景前缀                         | `--nav-bg`       |
| DOM id         | kebab-case，页内唯一                         | `#toc-fab`       |

- 类名不跨组件复用同名异义。
- 避免裸元素选择器影响全局（明确的全局样式文件除外）。

### 3. 代码风格

- 格式以 `.prettierrc.json` 为准：UTF-8、LF、2 空格、单引号、带分号、尾逗号、行宽 100。
- 不用 `var`；默认 `const`，需重新赋值才用 `let`。
- 不用 `any`；确实定不了型用 `unknown` + 收窄，并注释原因。
- 不用 `@ts-ignore` / `@ts-expect-error` 掩盖错误。
- 不留 `console.log`；`console.error` 只在失败分支保留，且带上下文前缀（如 `[lightbox]`）。
- 不留注释掉的代码、未使用的变量与 import。
- 优先纯函数与早返回；`if` 嵌套超过三层就重构。
- 不写 barrel 文件（`index.ts` 再导出），直接从具体文件 import。
- 项目**没有 `@` 路径别名**，import 一律真实相对路径（注释里的示例 import 同样）。
- import 顺序：astro 内置 → 第三方包 → 项目相对路径 → 样式 / 资源，组间空一行。

### 4. 组件

- Astro 优先；需要定时器、事件监听、响应式状态、rAF 才用 Svelte。
- 交互复杂到水合都不可靠的，用纯静态标记 + `src/assets/js/` 脚本控制（`SideWidgets` + `swup-widgets` 范式）。
- Svelte 不引 Astro 组件。
- Svelte 只用 runes（`$state` / `$derived` / `$effect` / `$props`），不用 `export let` 与 `$:`；事件用属性式（`onclick={...}`），不用 `on:click`。
- Svelte 脚本一律 `<script lang="ts">`；Astro 模块脚本块不能带任何属性（加了就当 `is:inline`）；`is:inline` 内联脚本不过构建期转译，必须保持普通 JS（用途：`define:vars` 注入构建期数据、切页后重跑）。
- `#swup` 内容里的岛一律 `client:load`；布局层常驻岛才可 `client:idle`。
- 图标一律 `<Icon is:inline />`。
- Props 必须写类型：Astro 用 `interface Props` + `Astro.props`，Svelte 用 `$props()`。
- 组件内注册的监听器 / 定时器必须进清理函数。
- 新组件登记进 `COMPONENTS.md`（含水合指令）。

### 5. 样式

- 设计令牌（颜色、圆角、模糊、时长）只在 `src/assets/css/variables.css` 定义；后台令牌全部在 `src/pages/admin/_admin/css/variables.css`（蓝白商业风独立一套，与前台零共用零拷贝）；组件不硬编码。
- 圆角分两档，按元件角色判定：小标签 / chip 用 `--radius-sm`，卡片与按钮用 `--radius`（细则见 `docs/reference/CSS.md`「令牌」节）。
- 是否立令牌以语义为准，不以「重复次数」为判据：值承载稳定设计含义、会在多处持续复用时才立（由设计者定夺），单纯重复不强制。
- 不用 `!important`；要覆盖就调选择器权重或换类名。
- 前台磨砂一律挂 `.glass`（`utilities.css` 全站唯一定义），组件不自己写 `backdrop-filter`；后台无磨砂语言，底色全部平铺。
- 前台确需 `backdrop-filter` 时必须与 `-webkit-` 前缀成对写；不要打开 `astro.config.ts` 里 `compress` 的 CSS 压缩。
- 前台悬停效果一律 `.hoverable` + `--hover-*` 令牌，不另写 `:hover` 提亮；挂 `.hoverable` 的元素不自己写 `transition`；悬停提亮（颜色 / 填底 / 描边变亮、淡入）时长一律 `var(--t-hover)`，位移 / 开合 / 显隐 / 图片缩放等其他动效各自定义，不硬编码数字；后台没有 `.glass` / `.hoverable` 体系，悬停与聚焦效果在 `src/pages/admin/_admin/css/` 里自写。
- 断点**不是全站统一的一套，也不要求统一**：`768px` / `769px` 是全站手机 ↔ 桌面分界（`nav/breakpoint.ts` 与各 CSS 同值）；`850` / `1150`（含互补的 `1151px`）只出现在 `nav/swup-widgets.ts`、`posts/toc.ts`、`posts/row-state.ts` 与 `PostsShell.astro` / `global.css`；页面还会按自己版面另设专属值（如首页 `827px`：两栏最小总宽 716 + 两侧 112 = 828，装不下就转单栏）。版面专属断点是**刻意的**，别拉齐到别的页面的值。改某处断点只同步「同一条版面规则」的其它处（写死处都有注释指向），**不抽成共享常量**——多一个文件、多一层跳转，利小于弊。分批表与推导见 `docs/reference/CSS.md` 的「断点」。
- 页面外层宽度只由 `.page-main` 执行；要收窄内容列写 `width: 100%` + `max-width`（只写 `max-width` 会让纯中文页面塌成窄缝）。
- 类名不跨组件复用同名异义；避免裸元素选择器影响全局。
- 新增可复用类随代码自动进 `docs/REGISTRY.md`（`pnpm registry:write` 重建），样式机制与规则见 `docs/reference/CSS.md` 对应节。

### 6. 客户端脚本

- 放 `src/assets/js/`（后台脚本放 `src/pages/admin/_admin/js/`，不 import `src/assets/js/`），新文件一律 `.ts`。
- 文件头写「用法：由哪个组件引入」。
- 假设 DOM 随时被替换：监听元素前先判空，优先事件委托，内容替换后需要重绑的绑定要能重绑。
- 不用 `DOMContentLoaded`；用 `swup:content:replace` / `astro:after-swap` / `astro:page-load`；swup v3 驼峰事件名（`swup:contentReplaced` 之类）不会触发，禁止使用。
- 幂等守禁用 `window.__xxx` 标记，并在 `src/env.d.ts` 声明。
- 跨模块共享状态：声明在一处、赋值在一处、读取处做类型判断（现有范式：`breakpoint.ts` → `window.__onEnterDesktop`）。
- 定时器与 `requestAnimationFrame` 必须有退出条件。
- 网络请求：同一数据加缓存 / 去重；失败要有兜底（降级、占位或重试），并带上下文前缀记录。

### 7. 内容

- 分类只由 `src/content/posts/` 的目录结构决定；frontmatter 的 `categories` / `category` 无效，不写。
- 分类显示名与描述放该目录 `index.json`。
- 文章文件名即 URL 尾段，小写 + 连字符。
- 图片放文章同级 `images/`，相对路径引用；不写站点根绝对路径（会绕过图片优化）。
- `date` 用 ISO 格式（`2026-09-06`）。
- frontmatter 字段固定为：`title` / `date` / `description` / `image` / `tags` / `pinned` / `hidden`，不写清单外的字段。

### 8. 注释

原则：**注释少而必要，写代码达到的效果，不写过程、来源、历史。**

#### 文件头

- 每个文件第一行：`文件名 — 一句话作用`：

  ```ts
  // quotes.ts — 随机一言数据集
  // 用法：import { quotes } from "../../data/quotes"
  ```

- 被别处引用的组件 / 工具文件补一行用法；用法行必须写真的能跑的相对路径（本项目没有 `@` / `~` 别名）。
- 已弃用的文件标注 `（已弃用）`。

#### 行内

- 注释只单独成行，写在被注释代码的**正上方**；一律不写行尾注释（`const x = 1; // 说明`、`color: red; /* 说明 */` 都改成上一行）。
- 只在代码本身说不清时写，写「达到的效果」。以下一律禁止：
  - 复读代码：`height: calc(100% - 24px) /* 高度减 24px */`
  - 写来源：`/* 仿照 xxx 制作 */`
  - 写变更史：`/* 上次改成了 xxx */`
  - 逐条翻译：`if (visible) // 如果可见`
  - import 行、模板元素、每个函数开头的功能说明
- 判断标准：**删掉这行注释后代码没有歧义，就不写。**
- 数据量大的文件在文件头写数据结构，不逐条注释。

#### 其他

- 注释与文档一律中文，不中英混写。
- 区块分隔用 `/* ---- 元信息 ---- */`。
- 不写作者、创建时间（git log 里有）。
- TODO 统一 `// TODO: xxx`。
- 不用注释管理版本，不注释掉大段代码。
- 改代码时顺手修掉同一文件里违反本节的注释（复读、变更史、过期描述），不要只加新注释。

### 9. 验证与交付

- 改动收尾的固定顺序：**先 `pnpm format`，再 `pnpm verify`，最后 `pnpm build`**，三步结果如实报告。
- `pnpm verify` 是硬门槛：格式检查 + **quality**（`check-leaks` / `check-docs` / `check-contracts` / `gen-registry`）+ **behavior**（业务逻辑测试）+ `astro check`。**任一项不过就是没过**，不要因为「改动很小」跳过或只跑一半——这些检查拦下的都是规范里明令禁止、但人眼容易漏的东西。
- 报错就改代码，不要改检查脚本去迁就代码。真需要豁免时，在那行写 `// check-xxx: allow` 并在交付说明里写清理由。
- **不要为了赶时间绕过质检**：删检查、改 `package.json` 的脚本、写 `allow` 豁免、把失败项注释掉——这些只有在「这个场景确实必须这样写、规范本身不适用」时才允许，且必须同时说明是哪条规范不适用、为什么。因为「先用 `!important` 顶上」「先留个 `console.log` 方便调」「先不管类型用一个 `any`」这类理由而绕过，一律禁止；赶时间不是理由，赶时间就少改点功能。
- 新增质检项要**从真实故障长出来**：某类问题真的发生过（`docs/reference/TROUBLESHOOTING.md` 里有记录）、或规范里差点被踩穿，才补一条检查。凭空想象「将来可能会有人这么写」的检查不要加——它们在现有代码上就是假阳性，一次假阳性就足够让人开始习惯性加 `allow`，之后所有检查都失效。加完必须满足：现有代码零告警、只管一类事、单独可跑。
- 用户明确要求「快点 / 先别构建 / 待会再说」时，三步都可暂缓；交付时直接说明「验证未跑」，不要假装跑过。
- 暂缓的验证必须在收尾时补齐：用户说「做完了」或主动要求验证时，把格式化 + verify + build 一次性跑完，不得以「之前已经跳过」为由继续跳。
- 报告格式：一句话结论 + 命令与关键输出；有已知遗留问题就直说，并指出是否本次改动引入。
- 改动自带最小验证：页面数、产物抽查、核心交互（swup 切页、图片优化）。
- `pnpm format` 幂等（同版本重复跑无变化），可放心每次执行；升级 prettier 及其插件时单独提交重排。
- 收工前按 `docs/rules/70-verify.md` 自检，按 `docs/rules/80-doc-sync.md` 对照表同步文档。

### 10. Git

- 未经用户主动要求，不执行任何产生或改写提交的 git 操作（`git commit` / `git push` / `git rebase` / `git reset` / `git revert` 等）；`git log` / `git diff` 等查看历史的操作可随时用。
- 需要回退或恢复到某次提交时，先列出候选提交（哈希 + 提交信息）向用户说明，经用户明确确认目标后再执行。
- 提交信息用中文，一句话说清改动核心；不写「更新」「修了点东西」这类空话。
- 一个提交只包含一件事；格式重排、调试代码不混进功能提交。

### 11. 文档维护

- 同一件事只讲一处；别处需要时用指针指过来，不复制同一段说明。
- 不留「以前是 xxx」的变更史（git log 为准）；改规则直接替换旧表述。
- 文档里写的路径、文件名、命令必须真实存在 / 可运行；改完核一遍指向还在。
- 仓库路径一律用反引号写仓库相对完整路径：文件写到扩展名（`docs/rules/80-doc-sync.md`），目录以 `/` 结尾（`docs/rules/`）；用正斜杠，不写 `./` 前缀，不写「见某文档」这类不带路径的指代。
- 不用通配符或占位符代替真实路径（`*`、`**`、`{a,b}`、`<name>`、`…`）；要指「某类文件」就把所在真实目录写出来再加文字说明，检查脚本只校验通配前那段真实目录。
- 行号写成 `路径:12` 或路径与行号分开写；检查脚本校验冒号前的路径。
- 「已修 / 已清理 / 已随 / 搬 / 移到 / 迁移 / 原路径 / 旧路径」会让整行跳过路径检查：这些词只出现在纯历史记叙的行上，同一行不放仍需存在的现行路径，现行路径另起一行。`→` 不算历史记号，照常检查。

### 12. 抽取

抽取是「强制共变」的耦合成本，只在漂移会造成真实 bug 时付出，不为假设的未来合并。

- 共变测试（改 A 时 B 在语义上必须跟着改吗）：**必须** → 合并成单一来源，按语义命名；**不必** → 不合并，靠不同的名字区分，不写解释性注释；**有时** → 只抽公共核，差异留在调用点。
- 参数传数据就合并，传行为就分开：抽出物不得以 `mode` / `variant` 参数分支；所有调用点恒传同一值的参数删掉。
- 已经有两份相同逻辑还想加第三份时，必须写明「共变=不必」的具体理由；写不出就合并，并补一条能抓漂移的 behavior test。
- 令牌与常量按语义立，不按重复次数立（同 §5 的 CSS 令牌判据）。
- 合并先落本地（同文件 / 同模块）；`lib/` 与 `variables.css` 是公共边界，跨层 import 是红线。

### 13. 修复策略

- 修问题先问「能否让旧状态不存在」（摘类、摘内联、清残留）：优先删状态，不用新增覆盖层去压。
- 靠提权或源码顺序取胜的覆盖，覆盖处必须带契约注释：谁压谁 + 何时该拆掉这层；同值写两处的必须注明「两处须同改」。
- TROUBLESHOOTING 决定台账里同一族问题修满三次，条目必须写明「下次触碰时做一次结构收敛」，不再照叠第四层。

## 任务路由

| 要做的事                                                 | 先读 / 先用                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 加一篇文章 / 新建分类                                    | `docs/reference/CONTENT.md`（「新增文章流程」节有流程与核对清单）                                                                          |
| 新增一个组件                                             | `docs/reference/COMPONENTS.md`（「新增组件流程」节有流程与核对清单）                                                                       |
| 改样式 / 加类名                                          | `docs/reference/CSS.md`                                                                                                                    |
| 换全站背景（CSS 方案 / 图片）                            | `src/data/background.ts` 一处即可，预设放 `src/assets/backgrounds/`；改完要重启 `pnpm dev`，详见 `docs/reference/CSS.md`                   |
| 搞不清数据怎么流、路由怎么生成                           | `docs/reference/ARCHITECTURE.md`                                                                                                           |
| 遇到诡异现象（样式失效、切页后 JS 不跑、搜索不到新文章） | `docs/reference/TROUBLESHOOTING.md`                                                                                                        |
| 准备收工                                                 | 按 `docs/rules/70-verify.md` 验证，按 `docs/rules/80-doc-sync.md` 同步文档                                                                 |
| 改了代码，不知道要更新哪份文档                           | `docs/rules/80-doc-sync.md` 的对照表                                                                                                       |
| 有哪些文档、结构怎么分                                   | `docs/reference/index.md`                                                                                                                  |
| 文档体系本身怎么维护                                     | `docs/reference/CONTRIBUTING.md`                                                                                                           |
| 动跨文件的代码前，或怀疑“改一处会漏改别处”               | 代码注释里的契约锚（「两处同改」/「见某文件头」式注释，按关键词搜）+ `docs/reference/TROUBLESHOOTING.md` 决定台账（刻意设计 / 不修，别动） |
| 动「全站必经点清单」里的文件、查「两处同改」契约         | `docs/reference/COUPLING.md`（必经点与爆炸半径、文件间契约、后台改数据的跨墙通道）                                                         |
| 看到 bug、想查是否修过 / 是不是刻意设计                  | `docs/reference/TROUBLESHOOTING.md`（雷区条目 + 决定台账）                                                                                 |
| 想看代码里真实存在哪些组件 / CSS 类 / window 标记        | `docs/REGISTRY.md`（机器生成，`pnpm registry:write` 可重建）                                                                               |

## 目录地图

```
src/assets/css/          全局样式：根目录=全站基础+小元件聚合（variables/global/utilities）；shared/=全站可复用组件级（drawer/image-fallback/lightbox/skeleton）；posts/=文章
src/assets/backgrounds/  全站背景预设（css/ 绘制、images/ 图片）
src/assets/js/           客户端脚本（swup 下的 DOM 交互）：nav/ 导航与外壳常驻控件、posts/ 文章区、ui/ 通用可视元件、util/ 小工具、data/ 外部数据
src/components/          layout 布局 / posts 文章区 / widgets 小组件
src/content/posts/       文章：目录结构即分类
src/data/                站点配置与数据
src/layouts/             BaseLayout（全站壳，含文章区常驻侧栏）、PostsShell（文章区统一布局）
src/lib/                 构建期专用（无浏览器 API）：category.ts 纯函数、posts-data.ts 数据入口、posts-views.ts 文章视图口径、nav-match.ts 导航匹配（与浏览器侧同源）、content-image.ts 文章图片解析
src/pages/               路由（admin/ 是后台：仪表盘 / 文章列表 / 编辑器 / 分类管理 / 网站设置；admin/_admin/ 是后台自包含本体，下划线目录不被路由）
tests/                   自检脚本（Node，零第三方依赖）：quality/=代码质量（leaks/docs/contracts/registry）、behavior/=业务逻辑测试、run.mjs=汇总门禁
```
