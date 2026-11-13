# 已知雷区

> **收录标准**（加条目前先过这四条）：
>
> 1. 真实踩过、排查有实际成本（时间 / 反复试错）；代码或现有文档直接能读出来的，不收。
> 2. 不是一次性笔误：一次性排版 / 语法问题修完不留记录。
> 3. 只写「症状 → 原因 → 一句处理」（必要时加一句怎么确认）；完整排查过程、逐轮豁免、取证脚本细节不收，需要时查 git 历史。
> 4. 测试脚本 / 工具链专属问题只收反复出现的结论，不收每条具体断言。
>
> 编号按发现顺序，不复用，删除的条目空号保留。改到相关代码时顺手核一眼条目是否仍成立，不成立就删掉或改。

---

## 1. 全站毛玻璃模糊失效（Firefox 尤其明显）

- **症状**：`backdrop-filter` 只在 Firefox 里完全无效，Chrome/Safari 正常。
- **原因**：`astro.config.ts` 里 `compress()` 的 `CSS` 设为 `true` 时用的是 lightningcss，它压缩 CSS 时会无条件删掉不带前缀的标准 `backdrop-filter`，只保留 `-webkit-` 版本；Firefox 只认标准属性，于是全站玻璃模糊失效。
- **处理**：`compress()` 的 `CSS` 必须保持 `false`（CSS 压缩已由 Astro 自带的 esbuild 完成）。写 `backdrop-filter` 时一定要同时带 `-webkit-` 前缀。
- **范围说明**：全站磨砂统一走 `.glass` 类的 `backdrop-filter`（`utilities.css` 里唯一定义），这条坑适用于这份声明。

## 2. swup 切页后交互失效，或岛（Svelte 组件）根本没水合

- **症状**：`pnpm dev` 里切页后，侧边按钮、搜索框等 Svelte 组件点了没反应；或 `pnpm build` 后页面正常、控制台报水合错误（构建后注释，含 Svelte 锚点注释，被删）。
- **原因**：Svelte 5 的锚点注释（`<!--[-->`、`<!--]-->`、`<!---->`）被 `htmlMinifier` 的 `removeComments` 删掉了，水合时找不到锚点。
- **处理**：`htmlMinifier` 的 `removeComments` 保持 `false`；自定义钩子 `stripSafeComments()` 只删安全注释，别加宽它的匹配范围。

## 4. `pnpm dev` 下搜不到新文章

- **症状**：开发服务器里 Pagefind 搜不到刚写的文章。
- **原因**：Pagefind 的索引是 `pnpm build` 时生成的，dev 服务器只是把 `/pagefind/*` 指向 `dist/`。
- **处理**：先跑一次 `pnpm build`。dev 下搜索的是上次构建的索引。
- **构建窗口「搜索像失效」**：`pnpm build` 重写 `dist/` 期间 `dist/pagefind` 短暂缺失，此时若搜索模块尚未加载成功，加载会 404。`PostSearch` 已做两道防护：加载失败重试（2 次 × 1.5s）+ 页面空闲时预取一次（首查只付查询成本，不再等 1–3s 冷启动）。若提示「搜索索引不可用（站点构建中或尚未构建）」，等构建结束重试即可。

## 5. 客户端脚本挂了事件却从来不触发

- **症状**：脚本能加载，事件监听却永不触发。
- **原因**：swup 切页只替换 `#swup` 里的内容，`<script>` 不会重新执行；模块脚本只在首次加载时运行一次。另有一个隐蔽变体：`astro:before-swap` / `astro:after-swap` / `astro:page-load` 由 `@swup/astro` 用 `document.dispatchEvent(new Event(name))` 派发，`new Event` 默认 `bubbles: false`——**监听挂在 `window` 上永远收不到**，必须挂 `document`。
- **处理**：把逻辑写成监听 swup 钩子的形式（swup 钩子本身挂在 `document` 上派发的也照此办理）。本项目里侧边按钮列由 `assets/js/swup-widgets.ts` 统一管理，随切页重新初始化；`posts-shell.ts` 用 `astro:before-swap`（转场起点，要在内容替换前抓旧内容）与 `swup:content:replace`（新内容已插入）两个事件；**其余站点脚本一律用 `swup:content:replace`**，不要用 `astro:after-swap`（同一时机的别名，混用会让模块间先后关系只存在于「目前碰巧是对的」里）。

## 6. 正文图片不显示，或没走优化（HTML 里出现异常标签）

- **症状**：图片走不到 `ImageWrapper.astro` 的处理逻辑。
- **原因**：`ImageWrapper.astro` 靠正则匹配 `http(s)` 开头的字符串，本地图解析不出相对路径，绕不过 `basePath`。
- **处理**：改 `ImageWrapper.astro` 的匹配规则时要照顾到 `basePath`。

## 7. 带中文标签的页面 404

- **症状**：文章分类页（用中文当目录名）在部署后 404。
- **原因**：分类页靠子目录 `dist/posts/<分类>/index.html` 生成，没生成或路径没被正确编码就会 404。
- **处理**：文章页与分类页共用 `[...slug].astro`，靠 `props.type` 区分；改 `getStaticPaths` 时两种出口都要照顾到。

## 8. 分页不对 / 少了一页

- **症状**：文章列表的分页算错，或最后一页丢失。
- **原因**：分页数算漏了 `Math.ceil` 边界，或过滤后的文章数与实际渲染数不一致。
- **处理**：统一用 `BlogData` 导出的 `posts`（或 `visiblePosts()`）来算分页，别在页面里再过滤一遍。

## 9. 改了文件名 / 挪了目录，文章评论消失

- **症状**：重命名或移动文章后，原来页面里的评论看不到了，评论区变成空白。
- **原因**：giscus 按 pathname 映射讨论，讨论标题就是"去掉前导斜杠的页面路径"。路径一变，giscus 就找不到旧的 Discussion，等于评论失联（旧讨论仍留在仓库里，只是页面不指向它了）。
- **处理**：文章发布后不要改文件名或挪目录；确需移动时，去 GitHub 仓库的 Discussions 里把标题手动改成新路径。

## 10. 类型检查报"未使用"之类的提示

`pnpm check` 报「未使用」→ 未使用 import 是错误先清干净；`css_unused_selector` 见第 17 条。

## 11. 构建前的基础环境

- Node 版本：`package.json` 的 `engines` 已固定（`>=22.18.0`），别用更低的版本。
- 包管理器：pnpm。不要用 npm/yarn 装依赖，否则 `pnpm-lock.yaml` 会对不上。
- 路径别名：**项目没有 `@/` 之类别名**，`src/data/*.ts` 在页面里一律用相对路径引用。

## 12. 改了集成配置后 `pnpm check` / `pnpm build` 报 `spawn EPERM`

- **症状**：动了集成配置（`swup`、`compress`、`htmlMinifier`、`stripSafeComments` 等）或 `astro.config.ts` 后，`astro check` / `pnpm build` 报 `spawn EPERM`、`optimizeSafeRealPathSync`、`ChildProcess.spawn`。
- **原因**：这是**沙箱的文件策略限制**，不是代码问题。子进程在受限模式下被禁止，而 `astro check` 要起服务进程，于是直接失败。
- **处理**：确认是策略拒绝后，用 `danger-full-access` 策略重跑那一条命令即可。

## 13. `pnpm install` 说 "Already up to date"，但 `check` / `build` 根本起不来

- **症状**：`node_modules` 里没有 `.bin`、少了 `node_modules/astro`，`pnpm install` 却回 `Already up to date`。
- **原因**：pnpm 靠 `node_modules` 下的 pnpm 状态文件（`.pnpm-` 开头的 `.json`）判断是否已是最新，它只认时间戳。中途失败、手工删过 `.pnpm` 目录都会留下这种"状态文件在、实体已丢"的情况。
- **处理**：删掉整个 `node_modules` 重装。依赖包本身还在 store（`%LOCALAPPDATA%\pnpm\store\v11`），重装走硬链接，不必重新下载。

## 14. 改了代码却不知道要更新哪份文档

按 `docs/rules/80-doc-sync.md` 的「改了什么 → 更新哪里」对照表逐条核对。

## 15. astro-icon 的 iconDir 指向不存在的目录

- **症状**：启动日志 / 每次 dev / build 出现 `[astro-icon] Failed to load icons from "src/icons": ENOENT`（或 `ENOENT ... scandir '<项目>/src/icons/'`）。
- **原因**：`astro-icon` 的 `iconDir` 默认 `src/icons`，加载失败会**连带跳过** `generateIconTypeDefinitions`。
- **处理**：保留 `src/icons/.gitkeep` 占位。别用 `.gitignore` 忽略该目录，别改成不存在的路径。空目录提交不进 git，必须留占位文件。
- **怎么确认**：`pnpm build` 日志出现 `[astro-icon] Loaded icons from src/icons, la, mdi, simple-icons ...`，且图标类型定义文件已生成。

## 16. 隐藏文章还是出现在了列表 / 搜索里

- **原因**：`BlogData` 有两份文章数组——`posts`（已排除 `hidden: true`）与 `allPosts`（全量）。`allPosts` **只该出现在** `[...slug].astro` 的 `getStaticPaths` 与"取当前文章"两处；新写的列表、统计、订阅源若顺手用了 `allPosts`（或直接用 `getCollection('posts')`），隐藏文章就会漏出去。
- **处理**：凡是"列出来给人看"的地方一律用 `posts`（或 `visiblePosts()`）。另外 Pagefind 只索引带 `data-pagefind-body` 的页面，隐藏文章的正文卡由 `PostsShell` 的 `hidden` 属性关掉这个标记——别在别处又给它加上。
- **怎么确认**：加一篇 `hidden: true` 的临时文章 → `pnpm build` → 在构建产物 `dist/` 里的文章列表页 HTML、RSS 源、Pagefind 入口 JSON 中搜它的 slug，都应该是 0 命中；而该文章自己的页面 HTML 存在且带 `noindex`。验完记得删掉临时文章。

## 17. 传给组件 prop 的 class 被当成"未使用选择器"裁掉，图标尺寸失效

- **症状**：`pnpm check` 报 `css_unused_selector`；`pnpm dev` 里样式正常，`pnpm build` 后图标尺寸却不对。
- **原因**：Astro 的 CSS 裁剪只分析模板里**静态出现**的类名。通过 prop 传进去、由子组件拼进 `class` 的类名它看不到，就被当成未使用选择器删掉了。
- **处理**：把这类类名放进 `astro.config.ts` 的保留配置，或直接改成内联 `<svg>`（本项目 `PostSearch.svelte` 已是此模式），别依赖 prop 传 class。
- **怎么确认**：`pnpm build` 后在 `dist/_astro/*.css` 里搜那个类名是否还在。

## 19. 站点页 ↔ 后台页互跳后，页面被塞进了错误的外壳

- **症状**：从 `/` 点进 `/admin/`（或从后台点「回到站点」）后，页面内容换了、导航栏/页脚却没换——出现「站点顶栏 + 后台内容」或反过来的混搭。
- **原因**：`@swup/astro` 把 swup 注入**所有**页面（含后台），而 swup 只替换 `containers`（本项目是 `#swup`）里的内容，站点页与后台页的外壳本就不同，不管就会混搭。**关键点：swup 也接管浏览器的前进/后退**，所以光靠 `ignoreVisit` 配置挡不住这条路径。
- **处理**：两层。点击路径：后台「回到站点」链接（`AdminNav` 里）带静态 `data-no-swup`，swup 把这次点击交给浏览器整页加载。前进/后退路径：由 `assets/js/shell-guard.ts`（两个外壳各 import 一次）监听 `popstate`，发现当前外壳与目标地址对不上就掐掉 swup 的处理并整页 reload，`astro:after-swap` 上再兜一层 reload。
- **怎么确认**：`pnpm build` 后 `dist/admin/**/*.html` 里能搜到 `data-no-swup`；在浏览器里用「前进/后退」在两个外壳间来回走一遍，外壳应与内容一致。

## 20. 玻璃模糊与 swup 切页（前台与后台）

这一节是踩坑最多的。当前切页做法是「内容直接替换 + 顶部进度条」，
下面两个坑是**长期约束**，动切页路径上的任何动画前先过一遍。

> **适用范围**：全站磨砂统一走 `.glass` 类（`backdrop-filter` 实时采样绘制在背后的像素），所以 **20.1 的 backdrop root 约束作用于所有挂 `.glass` 的元素**（卡片 / 顶栏 / 后台 / 弹窗）。下面实测数据保留，动这些元素的动画前仍要先过一遍。

### 20.1 坑：`backdrop-filter` 的采样范围会被祖先的 `opacity` 关掉

症状：过渡期间玻璃完全没有模糊、变成纯透明（能看清背后背景的蜂窝线），动画结束才「啪」地恢复。

玻璃的模糊靠 `backdrop-filter`，它**只能采样「同一个 backdrop root 之内、绘制在它背后」的像素**。而 `opacity < 1`（以及 `filter` / `will-change: opacity`）会让元素**新建 backdrop root**。

曾把进场动画挂在 `main#swup` 上（`opacity: 0 → 1`）。动画期间整个 `#swup` 成了新的 backdrop root，它内部的后代（所有玻璃卡片）就再也采样不到页面背后那层固定的 `.bg`，只能采样 `#swup` 自己的透明背景 —— 模糊因此消失；动画结束、backdrop root 撤销，模糊才恢复。

实测（Chromium headless，高频斜纹背景，测卡片区域亮度标准差；越低越模糊）：

| 祖先的状态              | 标准差 | 模糊     |
| ----------------------- | ------ | -------- |
| 纯背景未模糊            | 82.0   | —        |
| 无祖先动画（基准）      | 1.58   | 正常     |
| 祖先跑 `opacity` 动画   | 78.9   | **失效** |
| 祖先跑 `transform` 动画 | 2.01   | 正常     |

**结论：破坏模糊的是 `opacity`，不是 `transform`。** 所以 `main#swup` 与其祖先上**只能挂 transform 类动画，不能挂 opacity**。

试过但**都绕不过去**的写法：`isolation: isolate`、`clip-path`、让玻璃自己再跑一遍 `backdrop-filter` 动画。实测这三个在高频细节量上分别是 3.48 / 2.17 / 3.48，而正常基准是 0.50。

### 20.2 坑：swup 只等待 `animationSelector` 匹配元素上的动画

swup 靠 `options.animationSelector`（默认 **`[class*="transition-"]`**）去找「需要等待的动画」，并读这些元素的 `animationDuration` 决定等多久。读一下 swup 的 `awaitAnimations` 就能确认：

```js
animatedElements = queryAll(selector, document.body);
if (!animatedElements.length) {
  console.warn(...);
  return;          // ← 没找到匹配元素：直接返回，不等待
}
```

`.admin-card` / `.admin-btn` / `.glass` 的类名里**没有** `transition-` —— swup 压根不知道这些动画存在，不会为它们等待。
把切页动画挂在这类类名上（或把等待目标元素的动画设成 `none`），swup 就认为没有动画要等，**切页在下一帧就完成**。

> **这个坑极其隐蔽**：DevTools 里手动加 `is-rendering` 能看到卡片的 `animationName` 是对的，选择器单测也全通过，但真实切页时它一帧都没播。
> **教训：单测「规则是否命中」不等于「动画有没有时间播」，必须测真实切页的耗时。**

顺带一个有用的性质：`awaitAnimations` 是把所有匹配元素 `Promise.all` 起来等的，所以**同时有多个匹配元素时，swup 等最长的那条**。

当前配置已写 `animationClass: false`（见 `astro.config.ts` 的 swup 段）：swup 完全不等待动画、直接替换内容。
将来若要加切页动画，需同时恢复 `animationClass`（或在等待目标元素上留一个带真实时长的 `transition-` 类），且 20.1 的坑仍然适用。

### 20.3 当前切页做法：直接替换 + 顶部进度条

- 新页面一到就替换内容：不做渐隐渐显、没有遮罩，加载期间旧内容也不需要先隐藏（隐藏即 opacity 动画，会踩 20.1 的坑）。
- 加载反馈是官方 `@swup/progress-plugin`（`astro.config.ts` 的 `progress: true` 启用）：页面顶部一条细白条，
  切页快于 300ms 不出现，加载期间逐渐填充，新页面渲染完后走到 100% 再淡出。
- 进度条的默认样式（3px 黑条）由插件自己注入，高度与颜色在 `global.css` 覆盖（`body .swup-progress-bar`）。

**怎么确认**：`pnpm dev` 后切页：顶部细白条逐渐增长，切完走满即消失，内容直接替换；
**全程挂 `.glass` 的玻璃（卡片 / 顶栏 / 后台）都应保持模糊**（不会出现「切页那一下变透明、显完才恢复」）。

### 20.4 不成立的方案（别再犯）

1. **把动画挪到顶栏** —— 内容会硬切，顶栏反而开始闪。
2. **纯 `translateY` 位移** —— 能保住模糊，但观感是「弹一下」，不接受。
3. **给固定背景做整屏的 `filter: blur()` 副本** —— 会溢出整屏糊掉；加 `contain: paint` 能治溢出，但 `opacity` 仍会稀释模糊。
4. **模糊只放在动画后半段追** —— 内容已实显却没模糊，像「忘了应用玻璃」，随后又像「突然被糊了一下」。而且性能根本不是瓶颈。
5. **以为这是后台独有的问题** —— 不对，前台 `#swup` 内的 `.glass` 同样会失效。
6. **只把等待目标元素的动画设成 `none`** —— 忘了 swup 是靠它判断「要等多久」的，等于告诉 swup「没有动画要等」，切页直接变成下一帧完成，控制台还会打警告。干净的做法是配置里写 `animationClass: false`。
7. **只给 `.glass` 挂动画来做整页效果** —— 页面上非玻璃的内容不参与，会出现「一部分渐显、一部分瞬移」。这是最先必须换掉的方案。

### 20.5 验证时的陷阱（踩过，别再踩）

⚠️ 构建产物里的 CSS 用的是**绝对路径** `/_astro/…`。**直接用 `file://` 打开 `dist/admin/index.html`，样式表根本不会加载**（会解析成 `file:///_astro/…`，不存在），此时页面是无样式的，任何基于它的测量结论都是错的。要在 `file://` 下验证，得先把 `/_astro/` 改成相对路径 `../_astro/`，或者起一个静态服务器。

⚠️ headless Chrome 加 `--virtual-time-budget` 会**快速推进定时器**，依赖 `setTimeout` 时序的测量脚本会得到假结果（本项目为此浪费过很多时间）。要定格动画请用 `animation-play-state: paused` + 负的 `animation-delay`，**不要用 `animation: none`**（它不会定格，只会取消）。

## 21. 挂了 `.hoverable` 的元素悬停直接跳变（没有渐变）

- **症状**：个别卡片/导航项悬停时白底、描边、文字色瞬间变过去，和其他 `.hoverable` 元素的 0.25s 渐变不一致（项目页卡片、上一篇/下一篇导航出过）。
- **原因**：元素自己在组件样式里写了本地 `transition`。组件样式编译后与 `.hoverable.hoverable` 同为 (0,2,0)、且排在源码后面，本地 `transition` 会整体盖掉全站悬停过渡——背景/文字色这类属性没进本地列表，就没有过渡了。
- **处理**：删掉该元素上的本地 `transition`，悬停过渡只认 `utilities.css` 里 `.hoverable.hoverable` 那份；确需过渡 transform 等额外属性，把共享的四个属性（background / box-shadow / border-color / color）一并写全，或写到子元素上。完整说明见 [CSS.md](./CSS.md) 的「悬浮反馈」一节。

## 22. 切页瞬间后台侧栏 / 顶栏点不动

- **症状**：后台切页的那一瞬间，点侧栏项或顶栏按钮没反应，要点第二次才生效。
- **原因**：`astro.config.ts` 的 swup 段 `native: true`（默认值）时，swup 会用浏览器原生 View Transition（`document.startViewTransition`）包住整次 renderPage。原生 VT 把整页快照挂到覆盖整个视口的 `::view-transition` 顶层，动画期间指针事件全落在快照上、到不了真实 DOM——侧栏在 `#swup` 之外、视觉上根本没动，却同样点不动。
- **处理**：swup 段设 `native: false`（配合 `animationClass: false`，内容直接替换、无转场动画）。日后要加切页动画，不要把 `native` 换回 `true`，用页面内 CSS 动画做（见第 20 条）。

## 23. Astro `<script>` 加了属性（如 `lang="ts"`）后脚本变 `is:inline`

- **症状**：给 Astro 的模块脚本加了 `lang="ts"`（或 `type` / `defer` 等任何属性）后，`astro check` 警告「will be treated as if it has the `is:inline` directive」；产物里脚本带原属性原样输出，TS 注解没被转译、`import` 没被打包（浏览器直接 SyntaxError）。
- **原因**：Astro 的约定是**只有不带任何属性的 `<script>` 才走 Vite 打包/转译**；一旦带属性，编译器一律按 `is:inline` 处理，原文进 HTML。Svelte 的 `<script lang="ts">` 不受此限制（Svelte 自己转译）。
- **处理**：Astro 里的 TS 逻辑一律写进 `src/assets/js/**.ts`，用裸 `<script>` 块 import；确需内联时用 `is:inline` + `define:vars`，并保持普通 JS。

## 24. 离开项目页时闪一下巨型 GitHub 图标

- **症状**：从项目页切到其他界面，有概率先出现一个特别大的 GitHub 图标（约 300×150），片刻后消失。
- **原因**：`SwupHeadPlugin` 是 `content:replace` 的 **before 钩子**：它先 diff head、把旧页面的 `<link>/<style>` 标签删掉，然后才按 `awaitAssets` 等新页面的样式表加载好，最后内容才被真正替换。Svelte 岛的样式恰好在 head 的内联 `<style>` 里，随 diff 先被移除——等待期间仍可见的旧页面内容已经丢了样式，`ProjectsGrid` 里 `.gh-icon` 这种没有宽高约束的 SVG 退回浏览器默认的 300×150，巨型图标就此出现；等内容替换、旧页移除，图标才「自己藏掉」。等不等得出来取决于目标页样式表的加载耗时（缓存命中与否），所以是「有概率」。
- **处理**：`astro.config.ts` 的 swup 段 `updateHead` 写 `persistAssets: true`——旧页面的孤儿 `<link>/<style>/<script>` 标签保留在 head 里，直到内容真正被替换。各页样式带作用域哈希（`svelte-xxxxx` / `data-astro-cid-xxxxx`），残留样式不会串到新页。
- **怎么确认**：`pnpm build` 后在 `dist/_astro/page.*.js` 里搜到 `persistAssets:true`；浏览器里从项目页切到首次访问的页面（如 `/sponsor/`），GitHub 图标不再放大。

## 25. 点击「文字本身」时监听器静默失效（`e.target` 是文本节点）

- **症状**：点击监听"时灵时不灵"——点正踩在字符上不生效（点内边距 / 图标空白处正常），行为上像是"要等换页完成才有反应"，极易误诊成时序 / 动画 / 曲线问题。`nav-indicator.ts`（导航下划线点击即移）与 `hamburger.ts`（移动菜单点击收合）都踩过：导航线的"点击延迟 / 快速切换跳变"真凶即此。
- **原因**：`event.target` 是最深节点，点在文字上时可能是 `Text` 节点；`Text` 没有 `closest` 方法，`e.target.closest(...)` 直接抛 TypeError，**整个监听器中断**（控制台只有一条不起眼的报错）。swup 的依赖 `delegate-it` 的 `safeClosest` 里就有同样的守卫（`if (target instanceof Text) target = target.parentElement`）。
- **处理**：document 级点击委托先解析 target 再 `closest`，项目既有写法（`toc.ts` / `swup-widgets.ts` / 修复后的 `nav-indicator.ts` / `hamburger.ts`）：

  ```ts
  const raw = e.target as Node | null;
  const el = raw instanceof Element ? raw : (raw?.parentElement ?? null);
  const target = el?.closest('.selector') ?? null;
  ```

- **怎么确认**：把鼠标精确点在文字笔画上触发一次；或看控制台有没有 `xxx.closest is not a function` 的 TypeError。

## 26. 构建后控制台报 `hydration_mismatch` / `Illegal invocation`，岛整块被清空重渲染

- **症状**：页面功能正常，但 `astro preview` / 部署产物控制台报 `https://svelte.dev/e/hydration_mismatch` 和 `TypeError: Illegal invocation`；岛（Svelte 组件）先被清空、再整块重新渲染一次（双重渲染）。若兜底挂载也失败，岛区域就是空白——表现即「Svelte 组件的内容被隐藏」。
- **原因**：Svelte 5 的水合遍历依赖岛的 SSR 标记结构——岛内元素之间的空白文本节点（SSR 输出的 `</div> <div>` 这种）也是遍历的一部分。`astro.config.ts` 里 `htmlMinifier` 的 `collapseWhitespace: true` 会删掉这些空白节点（`minifyCSS` 还会重排岛内 `style` 属性值、`removeEmptyAttributes` 会动岛内属性），客户端按预期结构遍历时对不上号：`set_hydrate_node(null)` 抛 mismatch，后续 `getter.call(非节点)` 抛 `Illegal invocation`。Svelte 的兜底 `clear_text_content(target)` + `mount()` 会重渲染整个岛，所以内容还能显示，但每次进页都报错。
- **处理**：`htmlMinifier` 加 `ignoreCustomFragments`，用正则把整个岛按原始文本保护（`/<astro-island\b[\s\S]*?<\/astro-island>/`、`/<astro-slot\b[\s\S]*?<\/astro-slot>/`），压缩器不进入岛内部。不要用「把 `collapseWhitespace` 关掉」来治——全站 HTML 的压缩收益会丢。
- **怎么确认**：`pnpm build` 后 `astro preview`，控制台无 `hydration_mismatch` / `Illegal invocation`；`dist/index.html` 里岛标记与 dev 的 SSR 输出对比，空白节点和 `style` 属性顺序一致。

## 27. 挂了 `.hoverable` 但悬停「没反应」：白底/描边不动，或只动文字色

- **症状**：悬停标签云的 chip：文字正常提亮，但白底与描边像没动（描边实际只从 0.08 微升到 0.12，肉眼难察）；悬停文章卡片里的标签：字体和底都不动。元素明明挂了 `.hoverable`，也没有第 21 条那种本地 `transition` 覆盖。
- **原因**：元素的**静止态与悬停态取值相同**，过渡一直在跑，只是没有可过渡的差值。悬停反馈的白底是 `--hover-bg`（rgba 0.06）、文字提亮是 `--white`（#fff）、描边加深是 `--hover-line`（0.12）；`.chip` / `.post-card-tag` 的静止底被硬编码成 `rgba(255, 255, 255, 0.06)`，恰好等于 `--hover-bg`，悬停「变化」是 0.06 → 0.06；卡片标签的静止文字又用了 `--ink`（0.88），与 `--white` 只差 0.12 透明度，提亮不可见。
- **处理**：挂 `.hoverable` 的元素静止态必须比悬停态更淡：底用 `--rest-bg`（0.03）或 `transparent`（纯文字链接），悬停时提亮到 `--hover-bg` 可见；文字用 `--ink`（静止态必须比悬停态明显更淡，提亮才看得出）；描边用 `box-shadow: inset 0 0 0 1px var(--ring)`（悬停时 `--ring` 被换成 `--hover-line`，描边靠 box-shadow 过渡加深）。要磨砂观感就再挂 `.glass`（悬浮小按钮 back-to-widget 用；标签只取淡底、不叠磨砂）。参照 `.chip`（PostTagCloud）、`.post-card-tag`（PostCard）、`.back-to-widget`。
- **怎么确认**：DevTools 悬停该元素，看 computed 的 background / color / box-shadow——静止值必须与悬停值不同（`--hover-bg` / `--white` / `--hover-line` 的当前值）；且变化应是 0.25s 渐变而非跳变（跳变见第 21 条）。

## 28. 想给 Svelte 岛加动画：`@motionone/svelte` 是死路，`motion/svelte` 从来不存在

- **症状 / 结论**：`@motionone/svelte` 最后发版 10.16.4（2023，Svelte 3 时代）——它的 `main` / `module` 入口（`dist/index.cjs.js` / `dist/index.es.js`）**在 tarball 里根本不存在**，Vite 与 Node 都直接解析失败；且其 `Motion` 是 Svelte 3 编译出的 class 组件，Svelte 5 SSR 按函数调用它，报 `Class constructor Motion cannot be invoked without 'new'`。统一包 `motion`（framer-motion 的继承者）在 v11–v14 **任何版本都没有** `./svelte` 子路径（逐一核对过 exports 字段）。
- **处理**：用 `motion` 的 vanilla（框架无关）API——`animate(element, keyframes, options)` / `stagger()` / `inView()` / `scroll()`，在 `.ts` 脚本与 Svelte 岛的事件处理器里直接调用，不需要 React、不需要组件形态。本站即用此法（`hamburger.ts` / `nav-indicator.ts`），约定见 `ARCHITECTURE.md` 的「动画依赖：motion」。
- **怎么确认**：改后 `pnpm build`，`dist/_astro/*.js` 里出现 motion 共享 chunk（约 19.6 kB gzip），随相应页面的脚本加载（NavBar 的两个动态 import 脚本，或 `BaseLayout` 全站静态引入的 `posts-shell.ts`）。

## 29. motion 动画的飞行中值与 CSS 类状态：读值顺序决定跳不跳

- **症状**：类 + 动画快速切换时，元素先跳到端点再动；或取消动画后元素落回类的旧状态而不是期望位置。
- **原因**：两个机制叠加。① motion（WAAPI 驱动）结束动画时会把**最终关键帧写成内联样式**（`commitStyles`）并释放 fill——内联样式优先级高于类，所以 CSS 端点值必须与动画终值一致，否则动画结束那一刻会跳；② 想拿「飞行中位置」当下一段动画的起点，必须在**翻类之前**读 `getComputedStyle`——类一翻，computed 立刻变成端点值，飞行中的位置就丢了。
- **处理**：本站的写法（`hamburger.ts` / `nav-indicator.ts` / `category-tree.ts` / `toc.ts`）：CSS 只写端点态、不写 `transition` / `animation`；每次开合/改向先读飞行中值（`max-height` / `opacity` / transform），再翻类，然后给 `animate()` 传显式 `[现值, 终值]` 关键帧；瞬移 = `cancel()` 全部 controls + 翻类（CSS 基础态立即生效）。
- **怎么确认**：移动端连点汉堡开合、桌面端快速连点导航项，菜单与下划线都应从屏幕实际位置续接，无跳变；swup 切页（`swup:content:replace`）时菜单直接落位、无残留过渡。

## 30. 同一视觉由两条独立动画驱动 → 中点抖动（目录竖线的两次翻车）

- **症状**：目录指示竖线（`toc.ts`）页面滚动时反复出问题：先是「特别长的抖动长条」，改成纯位移动画后变成「竖线在中间老是抖」。
- **原因**：竖线的视觉位置同时被两条运动决定——① 竖线自己的 `top` 动画；② 目录的自动居中滚动（`trackEl.scrollTo`）。两次翻车各占一半责任：
  1. 长条：旧逻辑对大位移做「拉伸覆盖旧 ∪ 新再收回」的形变动画，且迁 motion 时把原 CSS 时代的 `setTimeout` 防重入窗口当「时序 hack」删了——快速滚动下活动项逐帧切换，竖线被逐帧重拉，永远停在「拉长」段。
  2. 中点抖动：形变去掉后，`top` 动画（0.2s）与浏览器 smooth 居中滚动（时长不受控）仍是两条独立曲线，各走各的——竖线视觉位置 = 两条曲线的差，对消不干净，每次活动项切换都在中点附近晃一下。
- **处理**：① 连续滚动驱动的动画不做几何形变（高度恒贴合活动项、直接写）；② **指示竖线与轨道居中必须用同一条进度曲线推进（共用过渡：单进度 p 同驱动竖线静止目标与轨道滚动，无离散 tween）**。竖线本身是真固定元素（放在轨道内、滚动内容之外，不随内容滚动）：它的目标 = 活动项在轨道坐标里的顶边，居中可达时居中滚动恰为 itemTop - trackH/2 + itemH/2 → 竖线目标 = trackH/2 - itemH/2 = 轨道中心常量，中间段竖线一点都不动（真固定）；项被夹住（列表太短 / 首尾）时竖线贴住项的真实位置。两条曲线时长/速度不匹配（如竖线 70ms + 轨道 140ms 各自指数趋近）就会叠加出「竖线先掉下再被拉回」的反向抵消，观感即「中间不固定」；离散「tween + 掐掉重定向」在快速连切（1→2 未完即 2→3）存在竞态：旧目标的完成帧/迟到写入会把竖线先落回旧项、再被矫正到新项，快速甩动时表现为闪。共用过渡从当前位置重定向（每帧唯一写入者），竖线视觉位只朝目标单调收敛，两类问题结构上都不存在；过渡时长按位移成比例（0.12–0.35s），快速甩动时列表每次切换前基本完成居中、高亮不长时间离开中心。检测由 IO + 段标记事件驱动（见 ④），哨兵与共用过渡在同一单 rAF 循环、收敛后自动停摆（静止零开销）；手动滚动（滚轮 / 触摸）关闭轨道跟随（滑走不拉回）、接管期间竖线贴住活动项随内容走（滚轮现算、触摸走轨道 scroll 监听）、下次切项恢复；点击窗口内轨道不动（竖线仍跟高亮）；仅**首次落位且距离 > `SNAP_MAX_PX`**（深链进入 / 切页后的状态矫正）瞬移。③ 布局平移（图片/字体）曾造成「突然回到前面一大截、再回到正确位置」的大幅闪回（过期的标题位缓存使活动项判定一帧内跳回数项、下一帧修正又跳回）。现行防御：检测用 IO + 段标记，标记位置按标题位缓存**显式写入**（浏览器不自动跟踪布局平移），打穿后由 ① 事件驱动重测（图片 `load`/`error` 捕获阶段、`document.fonts.ready`、`resize`，rAF 里重算标记位置）与 ② 哨兵（活动项标题单元素 rect，偏差 >2px 重测 + 重写标记，覆盖公式渲染等事件未覆盖的平移）保鲜；重测频率低，无逐帧 N 元素布局读取。④ **IO 直接观察标题盒**会使快速滚动时高亮滞后数项：IO 只通知**相交状态变化**的条目，快速滑动一帧跨过多个标题盒（约 28px 高）时，被跳过的盒「不相交→仍不相交」（false→false，不通知），回调的 entries 里没有真正的活动项 → 高亮停在最后一个「有通知」的位置，直到线进入某标题盒才纠正。修复：**按「段」划分**——每个目录条目放一个不可见 1px 段标记，覆盖「本标题→下一标题」整段（最后一段到文档末尾），区域无缝铺满全文：判定线恒在恰好一个区域里，快速滑动跨越多标题时**落入的段必 false→true（必被通知）**，新活动项不会缺席；兜底（线处于段尾过期空隙）取刚退出且 top ≤ 线的段；回调里再从候选按标题实时几何步行校正（前向/后向各走到与判定线一致，覆盖段位置暂过期偏差数项的情形；线在首标题之上取首项）。这是 IO 做 scrollspy 的正确姿势：观察「铺满路径的区域」，不是「点」。
- **怎么确认**：长文快速滚动 / 连续点击目录项，竖线始终贴合活动项高度、中间段钉在轨道中心处只有列表流过，无长条、无抖动；手动滚目录（竖线贴住活动项随内容走，滚轮与触摸皆然）与目录抽屉打开（手机端节点常驻抽屉，`__toc.remeasure` 重测后瞬移落位）均正常。

## 31. 滚动回调里的逐帧布局读取与布局通道动画 → 低配机器上的细微抖动

- **症状**：逻辑上已无多余运动的竖线，在性能差的机器上仍有 1px 级别的细微抖动。
- **原因**：① 每帧对 N 个标题做 `getBoundingClientRect` 读取会强制同步布局，与同帧的写入交错形成布局抖动，帧率不稳时表现为抖动；② 每帧动画走 `top`（布局属性）时，样式重算要等主线程，而 `scrollTop` 由合成器即时生效——两条通道在低帧率下错开一帧，视觉位置就微抖。
- **处理**：`toc.ts` 的现写法：标题的文档绝对位在初始化 / 换页 / resize 时缓存一次（页面滚动不改变内容布局），活动判定每帧纯算术；竖线位移用 `transform: translateY`（合成器通道）驱动，与 `scrollTop` 同帧写入、同走合成器。
- **怎么确认**：低性能机器上长文快速滚动，竖线无 1px 级微抖；DevTools Performance 面板滚动时段无逐帧的布局（Layout）行。

## 32. Svelte 岛脚本顶层访问 window → build 报 "window is not defined"

- **症状**：给 `client:load` 岛加客户端逻辑（如在脚本顶层读 `matchMedia` 判断 reduced-motion 偏好），`pnpm build` 在渲染第一个含该岛的页面时就失败：`window is not defined — Browser APIs are not available on the server`。
- **原因**：`client:load` 的岛**也会在服务端渲染**（SSR），脚本顶层代码在构建期跑一遍，任何顶层 `window.*` 访问直接崩。布局 `<script>` 引入的 `src/assets/js/*.ts`（如 `swup-widgets.ts`、`shell-guard.ts`）才是纯浏览器端、可放心用 window。
- **处理**：岛里 window 访问加 `typeof window !== 'undefined' &&` 守卫（`DaysCounter` 的 REDUCE_MOTION 即此写法，服务端恒 false）；运行时动画逻辑一律放 `onMount`（只在客户端跑），不依赖守卫值。
- **怎么确认**：`pnpm build` 全页通过；岛在客户端硬刷新后行为正常（动效出现）。

## 33. 进文章详情页整页卡死无响应（目录回调里的步行死循环）

- **症状**：打开任一**带目录**的文章详情页，几秒后整个页面冻结、无任何响应（连 DevTools 断点都不进，浏览器最终提示无响应）；其他页面正常。
- **原因**：`toc.ts` 的 IntersectionObserver 回调里的**后向步行校正**在「判定线在第一个标题之上」时无法终止：候选走到 `idx = 0` 时若首标题顶边仍在判定线之下，`idx = Math.max(0, idx - 1)` 被夹回 0，循环条件恒真，主线程原地空转。「线在首标题之上」恰是文章页首的常态（正文首个标题前还有标题 / 元信息 / 封面），而 IO 的**初始回调**在 `observe()` 后立即触发且必落此态 → 带目录的文章页必冻。
- **与 dev / 生产的关系**：与运行环境无关，dev 与生产产物都会冻。只是 dev 下 Vite 按需编译、`toc` 脚本执行晚，页面会「正常几秒」才冻，容易误判成 dev 独有问题；生产（构建产物）冻得更早（`load` 事件前）。判断方法：headless Chrome 里对 dev 与 `astro preview` 各开一次文章页，`Runtime.evaluate` 均超时，`Debugger.pause` 打断后调用栈停在目录 IO 回调（压缩产物里是 `for(;;){…u=Math.max(0,u-1)}` 那段）。
- **处理**：后向步行在 `idx === 0` 时直接 `break`——没有更早的项可走，首项即答案（与「线在首标题之上 → 首项」的既有语义一致）：

  ```ts
  if (!h || idx === 0) break;
  ```

- **怎么确认**：修复后页首 / 滚动 60% / 甩到底 / 回页首四处页面均保持响应，且活动项与几何真值（最后一个「顶边 ≤ 判定线」的标题）逐位一致。

## 34. 状态矫正（snap）只改变量不写 DOM → 大距离跳变后竖线停在旧位

- **症状**：目录页大距离跳变（页首直跳文中、深链进入）后，列表已瞬移到居中，竖线却不跟到活动项、停在上一处位置，要等下一次切项的过渡才「跳回」；页首小距离落位（dist < 0.5）不走帧循环、placed 标志不置位，使后续任意一次大距离重定向都落进 snap 分支触发本问题。
- **原因**：`toc.ts` 的 `retarget` 状态矫正分支（未落位且距离 > `SNAP_MAX_PX`）绕过帧循环直接对齐：更新 `barPos` 变量与轨道 `scrollTop`，但竖线 `transform` 只在帧循环 `p < 1` 分支里写——分支只改变量、DOM 没动，竖线视觉位停在旧值；`barPlaced` / `trackPlaced` 也未置位，后续大距离会反复走瞬移而非平滑过渡。该分支一直如此，竖线移出滚动内容（真固定改造）后旧位从「滚出可视区不可见」变成「停在轨道顶可见」，被无头验证脚本直接抓出。
- **处理**：snap 分支同帧写 `bar.style.transform = translateY(barPos)` 并置两个 placed 标志（矫正是一次性状态修正，之后的大距离走共用过渡）。原则：**任何绕过帧循环直接改目标态的分支，必须同帧把 DOM 写到位，不能指望帧循环「补写」**。
- **怎么确认**：无头脚本按 页首 → 30% → 65% → 底部 顺序跳变，每处竖线视觉位与活动项逐位一致（取证脚本已清理）；深链进入直接落位，不等下次切项。

## 35. 文章区侧栏在**所有**站点页的 DOM 里（普通页只是隐藏），行为分在三处

- **症状**（开发文章区新功能时可能遇到）：普通页（首页 / 关于等）里 `#category-tree` 的标记明明在 DOM 里，点箭头却无反应；从普通页 swup 切进文章区后的头几百毫秒里点树也没反应；把侧栏显示断点只改了 `global.css`，文章页的筛选抽屉按钮在 1000~1150px 区间该出现却没出现（或该隐藏却没隐藏）。
- **原因**：`GlobalSidebar` 由 `BaseLayout` 渲染在 `#swup` **之外**、且渲染在**每个**站点页的壳里——swup 只换 `#swup` 内容，这样文章区界面之间切换侧栏永不重建（分类树手动开合状态保留、不闪）。两个推论：① **标记常驻、脚本不常驻**——`category-tree.ts`（带 motion 共享块约 19.6 kB gzip）由 `posts-shell.ts` 懒加载：普通页侧栏隐藏、树无交互，根本不加载；第一次 swup 切进文章区时由 `astro:after-swap` 触发 `import()`，import 完成前树没有点击委托（首帧的展开窗口用 600px 兜底值，模块落地后量真实高度修正）。② **壳状态与断点分在两处**——行变体类（`--plain/--listing/--post`）、侧栏顶偏移（`--posts-side-offset` 实测页锚高度）、高亮/展开同步都由 `posts-shell.ts` 在每次 `astro:after-swap` 后维护（首帧由 `BaseLayout` 的 `shellVariant` prop 定）；侧栏显隐断点（列表 ≥769px / 文章 ≥1151px）写在 `global.css`，而筛选/目录抽屉按钮的互补出现区间（≤768 / ≤1150 / ≤850）写在 `swup-widgets.ts` 的 probe 数值里。
- **处理**：新功能依赖树脚本时，要么照 `ensureCategoryTree` 的懒加载模式（`window` 幂等守卫，`src/env.d.ts` 声明标记），要么直接操作 DOM、不假设 `category-tree.ts` 在所有页面已加载。**改侧栏 / 抽屉按钮的断点必须两处同改**（`global.css` 媒体查询 + `swup-widgets.ts` probe 数值），两处注释互相指认。
- **怎么确认**：任一站点页的 HTML 里都有 `.page-main > .global-sidebar`（普通页 `display: none`）；普通页 `window.__postCatTreeBound` 为 undefined，swup 切进文章区后变 true；文章页 1150px 时侧栏隐藏且筛选按钮可用、1151px 时侧栏显示且按钮隐藏，两条互补无死角。

## 36. 负边距压到行左缘的元素点不动（被侧栏盒的 padding 拦截）

- **症状**：列表页头 / 文章面包屑条左段（负边距压过侧栏区、与行左缘对齐的那一部分）里的链接点击无反应；视觉上完全正常，`elementFromPoint` 命中的却是侧栏。
- **原因**：`.global-sidebar` 是行里的 flex 项且 `z-index: 10`——它的**盒**（包括顶部 `padding-top` 偏移区，那块区域里没有可见内容）覆盖在内容列负边距压过去的区域上。页头 / 面包屑条若没有自己的 stacking context（`position: relative` + 更高的 `z-index`），左段就压在侧栏盒底下，点击 / 文本选择被侧栏拦截。旧版面包屑是侧栏的**子元素**、天然在侧栏层级内，没这个问题；改成内容列顶部通栏条之后就暴露了。
- **处理**：负边距通栏的左缘元素都带 `position: relative; z-index: 20`（高于侧栏的 10）：`.posts-header`（≥769px 负边距）、`.posts-breadcrumb`（≥1151px 负边距）。新增同类「向左压过侧栏区」的元素时照抄这两个声明。
- **怎么确认**：`document.elementFromPoint(页头/条左段坐标)` 命中的是该元素自身（或其子节点）而不是 `.global-sidebar`；真实鼠标点击左段链接能正常导航。

## 37. 转场克隆生命周期与条带模糊交叉渐隐（别再改回 CSS 动画类方案）

- **现行口径**：全部左缘条带切换（桌面 + 手机）走**模糊变过去**——旧带克隆原地渐隐（opacity 1→0，160ms，退出侧不写 filter）、新带原地渐显（**不挂任何 filter**）+ 静态 blur(4px) 模糊副本渐隐、淡尽后移除（纯 alpha 交叉，260ms）；两条带同位交叉渐隐，无位移、无口袋裁切。几何见 `CSS.md`「文章区几何」。
- **常驻规则**（动克隆 / 条带路径前逐条过）：
  - 清理克隆一律**查 DOM**（`clearClones` 按标记类查全部），移除回调里用局部引用接元素，不读会被置 null 的模块级变量——动画中途二次切页 cancel 后依赖模块变量，克隆会残留到 5s 兜底。
  - 下一轮切换前克隆**全程不能带过滤层**：克隆钉死 `filter: none` 且退出侧纯 opacity 渐隐——带过滤层的克隆被移除时下方新标题重栅格闪一帧。
  - 推入根 / counter 槽的 transform 层**保活不拆**：motion 把端点 0 解析成 `transform: none` 会拆层，`finished` 后显式写回恒等 `translateY(0)`——拆层重栅格整列内容（长列表十几张玻璃卡），压在新标题入场收尾上就闪（见第 51 条）。
  - 克隆前把旧条带残留内联 transform 清零（cancel 不清内联），克隆 `margin: '0'`（负 margin-left 在绝对定位克隆上照样生效，整条会左偏 284px）。
  - 量槽 / 占位用**与 transform 无关的布局坐标**（槽 rect + 占位 `offsetTop`），动画中按 `getBoundingClientRect` 量会把错值写死进内联（见第 42 条）。
- **为什么不用 CSS 动画类**：类必须在首个绘制帧前挂上动画才有起点，dev 主线程被 Vite 转换 / 水合占住时挂类时机漂移，动画整段无声丢失（生产好 dev 坏的来源）；转场一律 motion 的 `animate()`（`astro:after-swap` 与 DOM 插入同任务）。

## 38. 侧栏标签 chip 高亮残留（切页后状态没清除）

- **症状**：点侧栏某个标签 chip 进标签页，再切到列表 / 分类 / 文章页，那个 chip 仍然高亮。
- **原因**：侧栏在 `#swup` **之外**、切页永不重建，chip 的高亮态完全由 `posts-shell.ts` 的 `syncActive()` 客户端维护。旧代码只在 `activeTag` 非空时才跑 `classList.toggle`——离开标签页后 `activeTag` 是空串，整段被 `if` 跳过，旧 chip 的 `chip--active` 没人摘。
- **处理**：`toggle` 无条件跑（空串不匹配任何 chip 文本，等效全部清除），见 `posts-shell.ts` 的 `syncActive`。
- **怎么确认**：点标签 chip 进标签页（chip 点亮）→ 回列表页 → `document.querySelectorAll('.global-sidebar .chip--active').length === 0`。

## 40. swup 测试脚本的两个时序坑：loadOnIdle 初始化 + dev 下 URL 领先内容

- **症状**（写 headless CDP 脚本验证 swup 切页转场时）：① 刚起的 dev 服务器点卡片是**整页 reload**（`__docId` 变），等一会儿再点又正常；② 点击后 URL 已变但 `#swup` 里还是旧内容，按 URL 判「已到达」的断言全错。
- **原因**：① `@swup/astro` 的初始化脚本默认 `loadOnIdle`（window load + `requestIdleCallback` 后才 import Swup 并 `new Swup()`），初始化前点链接就是普通整页导航；② dev 下 `awaitAssets: true` 等新页资源就绪才换内容，history push（URL 变更）发生在内容换入**之前 1–2 秒**。
- **处理**（只改测试脚本，不改站点代码）：① 首次切页前先做一次**探测导航**：点卡片，`__docId` 变了 = 未初始化，等待重试；② 「到达」判定一律用**内容标记**不用 URL（列表页 `main#swup .posts-grid`、文章页 `main#swup .posts-breadcrumb a`、分类/标签页 `main#swup .posts-header h1` 文本不以「文章列表」开头）；③ 采样窗口 ≥8s，时长断言只认「跨度 > 动画时长」。
- **环境现象（共性，别当 bug 追）**：dev 主线程被 Vite 转换 / 水合占住时，rAF 冻结 100–300ms、可吞掉整个动画窗口；rAF 饥饿可持续到下一次用户交互（数秒），期间动画内联值冻在途中值；CDP 注入的 click 事件同样排队，点击处理器与 after-swap 会同帧释放——「点击触发」改证行为：注入不提交导航的同页哈希链接，退出动画帧出现且内容从未交换即实锤。生产静态产物停顿仅几十毫秒。

## 41. 行级布局重构后首页不再垂直居中（内容贴顶）

- **症状**：首页内容贴在导航下方不垂直居中，其他视觉正常；不报错不失效，只是布局「安静地」变了。
- **原因**：`.page-main > .hero` 是**行** flex（`align-items: flex-start`）的子元素，`flex: 1` 只管宽度、高度塌成内容高，`.content-wrapper { margin: auto 0 }` 没有富余空间可吸收。
- **处理**：`.page-main > .hero` 加 `align-self: stretch`——内容列纵向拉伸填满整行，auto margin 重新有富余高度可吸收。重构改容器层级时，要专门回看一次旧容器靠 flex 撑高的副作用。

## 42. 元素被动画中的祖先带着移动时，`getBoundingClientRect` 量出来的是「带位移」的坐标

- **症状**（第八轮手机端整页推拉后）：文章→列表切换后，常驻搜索框 `.posts-search-float` 的内联 `top` 停错在 55px（应为 102.6），且不再被重测——55 = 102.6 − 48，正好差一个整页推拉的位移量。
- **原因**：`posts-shell.ts` 的 `syncSearchPos()` 用「槽 rect − 行 rect + 占位 `offsetTop`」写搜索框位置。`offsetTop/offsetWidth` 是布局坐标（不受 transform 影响），但 **`getBoundingClientRect` 包含祖先的 transform 位移**。桌面端被动画移动的是槽**内部**的条带，槽自身静止，rect 无污染；手机端整页推拉移动的是**内容根 `.posts-article` / `.posts-page`**——槽是它的后代，rect 跟着走。整页推拉启动后锚的 `ResizeObserver` 首次回调（异步）恰在滑动中途量槽：槽顶被量成 69−48=21，21+33.6≈55 被写进内联；动画不改变锚尺寸，RO 不再触发，错值永久驻留（transform 变化不触发 RO）。
- **处理**：量之前把「槽**自身 + 槽到行之间所有祖先**的 transform y 位移和」减掉（`slotAncestorTy()` 从槽自身起沿 `parentElement` 链解析 `matrix(…)` 第 6 个分量求和）——滑动中：rect 顶 21 −（祖先位移 −48）= 69 还原布局坐标；手机端条带模糊变过去里槽自身还会做等距反推（counter），自身 transform 也要计入（反推启动首帧量槽：rect 69 −（祖先 −48 + 自身 +48）= 69，错值 151 即少减自身 +48 的产物）；静止时位移和恒 0，桌面端路径零变化。同类先例：新条带 enter 动画首帧 y=±36px 时量槽会把错值写死（见 `posts-shell.ts` `syncSearchPos` 注释），那是「槽的子节点」被动画，这条是「槽的祖先」被动画，机制同源——**只要被量元素自身或其某个祖先正在被动画移动，rect 就是脏的**。
- **怎么确认**：CDP 在手机文章→列表转场中途（整页推拉 400ms 窗口内）读 `.posts-search-float` 内联 top：任何时刻都应收敛到 102.6 附近（±2px），不再出现 55 这类「差一个位移量」的值；转场后静止态 top=102.6、width=358 保持。

## 43. 同一元素上并发两个 motion 动画：收尾清理只挂先结束的那个，会被后结束动画的端点提交写回

- **症状**（搜索浮层转场代码整理后，静止态抽查才暴露）：`.posts-search-float` 静止时内联残留 `background-color: rgba(255,255,255,0)`（视觉无差——全透明，但内联不干净，`getComputedStyle` 返回透明白而非 CSS 默认透明黑，测试按严格字符串比对时误报）。
- **原因**：搜索的每次退场/入场都是**同元素上并发两个 `animate()`**——位移（move，300ms）与渐隐+白纱（fade，180/220ms）。motion 在动画完成时会把**关键帧端点提交成内联样式**（`finished` 时内联已是端点值）。旧收尾逻辑只挂在 move 的 `finished` 上清内联：当 fade 比 move **长**（如入场 320 > 300）时，move 先 `finished` → 清内联 → fade 继续跑并在 320ms 把端点（透明白）提交回内联 → 永久残留。两动画同时长（桌面位移与渐隐现为同时长）时是竞态，谁后 `finished` 谁赢。
- **处理**：收尾写成**幂等**函数（清 transform/background/visibility + 钉 opacity + 状态落定），**每个并发动画的 `finished` 各挂一次**——谁后结束谁负责最后清一遍，后完成动画的端点提交被下一次清理盖掉；`cancel`（reject）走 catch 不清理，残留内联由下次动作的 `settle()`（幂等起点）兜底。通用化：同元素并发多个 `animate()` 时，凡是需要「动画后清内联」的，清理必须挂到**所有**可能最后结束的那个动画上，或直接每个都挂（清理写成幂等即可）。
- **怎么确认**：转场结束后（入场 320ms + 余量）读 `.posts-search-float` 内联 `style`：transform/backgroundColor 均无残留，`getComputedStyle().backgroundColor` 回到 CSS 默认（alpha=0 即可，颜色通道不较真）；再切一次页、静止态复查仍干净。

## 44. astro-icon 的 symbol/use 引用在 swup 切页后悬空：持久壳里的图标「没颜色/不显示」，整页刷新恢复

- **症状**：从**首页**swup 切到文章区页面后，常驻侧栏名片（AuthorCard）的社交图标全部不显示（图标盒在、无形状，像「没颜色」）；从列表页出发切页则正常；在文章页**整页刷新**即恢复。
- **原因**：astro-icon 的 `<Icon>`（非 `is:inline` 模式）输出 `<svg><symbol id="ai:…">…</symbol><use href="#ai:…"/></svg>`，且**每页每个图标名只有第一个实例输出 `<symbol>`**（组件内部按渲染次序计数，`includeSymbol = i === 0`），其余实例只有 `<use>` 引用。图标形状的「宿主」因此落在**谁先渲染**谁头上——首页内容里的 GitHub 按钮先于侧栏名片渲染，`la:github` 的 symbol 就住在**首页的 #swup 内容**里；而侧栏名片在 #swup 之外的持久壳（切页永不替换）。swup 切走首页 = 连同 symbol 一起删掉，壳里名片的 `<use>` 引用悬空 → 图标消失。列表页/文章页恰好让名片自己是该图标的首次出现，symbol 就住在壳里，所以从那类页面出发一切正常——问题与具体图标无关，是「入口页 × 常驻位置」的组合。
- **处理**：全站 `<Icon>` 一律加 **`is:inline`**（72 处，2026-07 批量）：路径直接内联进 `<svg>`，无 symbol/use 引用，任何入口页、任何常驻位置都自包含。**swup 环境里不要用默认（symbol/use）模式的 astro-icon**；将来新增图标同样挂 `is:inline`。
- **怎么确认**：首页整页加载后 swup 切到文章区页面，侧栏名片的 `.author-social svg` 内 `path` 存在且 `getBBox()` 非零（修复前：svg 内只有 `use`、无 `path`，整页刷新前 `getElementById('ai:la:github')` 为 null）。构建产物抽查：文章页 HTML 的 `<svg class="social-icon">` 直接含 `<path>`，无 `<symbol>`。
- **同源先例**：astro.config.ts 的 `updateHead.persistAssets` 注释（离开项目页瞬间的巨型 GitHub 图标）是 head 资源孤儿化导致的同族问题——swup 环境下「资源/引用跨越替换边界」都要想一遍生命周期。

## 45. 断点跨界（768/1151）时搜索浮层错位一帧到十数帧（占位已换位、浮层内联值还是旧值）

- **症状**：不刷新页面，窗口/设备模拟跨越 768px（或 1151px）时，行级常驻搜索浮层（`.posts-search-float`）的位置/宽度**滞后**于布局翻转：桌面→手机方向浮层停在旧 top/left（手机宽下可能整个移出视口）持续约 10 帧（headless 实测 170ms），手机→桌面方向宽度停在旧值（358）约 2 帧。刷新后正常。
- **原因**：媒体查询在一次样式重算里就翻转布局结构（页头行↔列、行 `padding-top` 82↔73、槽负边距全宽化），占位符 `.posts-header-search` 当帧就位；而浮层的内联 top/left/width 靠**实测**（`syncSearchPos`），实测的触发者是锚元素的 `ResizeObserver`——RO 回调在布局**之后**才派发，中间存在「占位已换位、浮层还没重测」的帧。连续拖动缩放时 RO 持续触发还能跟上，唯独**跨界那一跳**的间隙最明显（布局结构跳变远大于逐帧宽度变化）。
- **处理**：给触发跨界翻转的两条 MQL（`(max-width: 768px)` / `(min-width: 1151px)`）挂 `change` 监听，回调里立刻 `syncOffset() + syncSearchPos()`——MQL change 在样式重算翻转的同一时刻同步派发，回调内 `getBoundingClientRect` 强制布局读到的是**新**媒体状态，内联新值与布局翻转同帧写入，错位帧清零（`posts-shell.ts`，RO 保留负责跨界后的连续缩放/标题换行重测）。同类「实测值滞后于媒体查询翻转」的叠放元素（将来若有）照此加 MQL 监听。
- **怎么确认**：页面内 rAF 逐帧记浮层与占位符 rect，跨界前后对比——修复前出现 `fl.top ≠ ph.top`（且宽度不同）的中间帧，修复后两个 rect 逐帧相等（无中间帧）。

## 47. 首访时 swup 实例就绪前点区内链接 = 原生整页跳转，落地首屏不播转场（搜索框 / 目录「没动效」）

- **症状**：第一次访问文章区（整页首载）时，预加载好之前点卡片 / 上下篇 / 面包屑等区内链接，页面照常跳转，但落地首屏的搜索框、目录转场动画完全不播；实例就绪之后（约 1.8s，生产）同样的点击一切正常。文章详情页的首屏早期点击（PostNav / 面包屑）同样中招。
- **原因**：两个坑叠加。① swup 实例在 `onIdleAfterLoad`（`load` 事件 + idle）才创建，从首屏画出到实例就绪之间存在「未就绪窗口」；窗口内点击时 swup 的点击委托还没挂载，走浏览器**原生整页导航**，而落地首屏的代码路径（`onReady(isSwap=false)`）按设计不播转场——转场只在 swup 切页（`astro:after-swap`）时播，所以「不播」是整页导航的预期表现。② `globalInstance: true` 暴露的 `window.swup` 在实例赋值前会经 Window 代理的 **DOM id 查询**回退到 `<main id="swup">` 元素——一个真值的 HTMLElement，`!!window.swup` 从首屏 DOM 解析起就是 `true`，而 `window.swup.cache` / `hooks` 一直 undefined——用 `!!window.swup` 判不出就绪，必须按实例自身特征甄别（`posts-shell.ts` 的 `realSwup()` 查 `hooks` + `navigate`；探针法：`Object.getOwnPropertyDescriptor(window, 'swup')` 无自有描述符 = id 回退）。
- **处理**：`posts-shell.ts` 加早期点击拦截（`onEarlyClick`，注册在 `onDocClick` 之前）：实例未就绪时点区内链接（`/posts/` 前缀 + 行在列表/文章变体，排除 `_blank` / `data-no-swup` / 修饰键 / 同页），`preventDefault` 拦掉原生导航，每 100ms 轮询实例，就绪后 `swup.navigate(href)` 转成正常 swup 切页——转场照常播；10s 超时回退原生跳转（覆盖实例创建失败的慢首载：load + idle 在冷缓存 / 慢网下可超 5s）。等待期间 `pendingEarlyNav` 保持到 `astro:before-swap`（`captureOld` 处清零）；`fetch:error` / `visit:abort` 时一并作废。跨区目的地本就无转场，不拦截；减动效（`REDUCE_MOTION`）不拦截。同批修掉一个潜伏 bug：`bindSwupHooks` 原来直接取 `window.swup`（未就绪时拿到 `<main>` 元素），手机端首次点击会在 `swup.hooks.on` 抛 TypeError 且已打上 `swupHooksBound` 污染标记，钩子从此绑不上（fetch 失败兜底失效）——改为 `realSwup()` 为空时直接返回、不打标记。
- **怎么确认**：CDP 持有 swup 核心 chunk（`_astro/Swup.*.js`）的动态 import 强制实例「未就绪」，等 boot splash 移除后 trusted 点击卡片——修复前：原生整页跳转、落地首屏无 `astro:before-swap` / `astro:after-swap`；修复后：无整页跳转，`navigate()` 在实例就绪后 ≤1 轮询周期触发，before/after-swap 正常触发，搜索退场（opacity 1→0 + 右移 48px）与目录入场（translateX 400px→0 + opacity 0→1）完整播放（列表→文章与文章→列表双向实测）。注意 headless 长主线程停顿后 WAAPI 帧可能滞后几十到几百毫秒（currentTime 先为负值再补上），属环境现象，非代码问题。
- **同源先例**：第 24 条（head 资源孤儿化）、第 44 条（图标 symbol 悬空）——swup 环境里「资源 / 引用 / 状态跨越就绪或替换边界」都要想一遍生命周期。

## 48. 文章列表快速点进文章、再快速回到列表，搜索框消失 / 快速再切进文章时搜索框被直接隐藏

- **症状**：文章列表上点文章卡片进文章后，约 0.3s 内（桌面退场动画窗口内）就点面包屑 / 导航回到列表——列表页搜索框 `.posts-search-float` 停在 `opacity: 0` 再也不出现（行变体类已翻回 `--listing`，CSS 的 visibility 正常，被内联 opacity 钉死）。条件：返回时旧页必须是**带目录**的文章详情（目录克隆占住相位链）；手机端同样必现（退场自 after-swap 起播，在途窗口与桌面端相同）。同触发条件的另一个表现（搜索**入场**未完就快速点卡片再进文章）：搜索框不走退场动画、**直接隐藏**，然后播文章目录入场——「先退场再入场」的退场那一拍凭空消失。
- **原因**：两层。① 搜索浮层状态机（`posts-shell.ts` 的 `floatCtl`，shown/hidden/exiting/entering 四态）入场只允许从 `'hidden'` 起步，兜底 `settle(newHadSearch)` 只在「本轮既无退出动作也无进入动作」时执行。快速回列表时：第一次 `astro:after-swap` 启动的搜索退场相位（320ms）还在途，`state === 'exiting'`；第二次 `astro:after-swap`（回到列表）判动作时入场 gate（`state === 'hidden'`）不成立、不设进入动作，而旧页目录克隆存在、目录退场动作占了 `exitAction`，`settle` 兜底那行也被跳过。旧退场动画（floatAnims 独立生命周期，`captureOld` 不连带 cancel）播完，`finish(false)` 把状态钉在 `'hidden'` + `opacity 0`，搜索框永久消失。② 改向（redirect）实现里踩的第二个坑：**motion 的 `cancel()` 不保留在途位姿**——它把元素**回退到首关键帧**（`keyframes[0]` 重写进内联，`JSAnimation.cancel → tick(0)`），cancel 之后再读内联拿到的是首关键帧：对入场动画而言首关键帧正是「屏外 / opacity 0」的隐藏态，改向退化的是一段 no-op 动画，搜索框直接跳到不可见（用户所见「直接隐藏」）；且切页瞬间行变体类先翻走、CSS `visibility: hidden` 生效，补完退场的窗口内不强制内联 visible 的话动画播了也看不见。
- **处理**：`playTransition` 开头加快速连切收口——在途相位与本轮目的地冲突时不静默掐断硬切，从飞行中位姿**改向**到本轮目的地的静止态（`floatCtl.redirect`，与目录克隆的中断处理同范式：停下、再走完整动效，时长按剩余位移/渐隐占全程的比例折算 25%–100%）：`newHadSearch && state === 'exiting'`（退场未完就切回列表）→ 自当前位置归位（「停下再回去」，手机端与 `enterMobile` 同样延迟 110ms 防叠卡片）；`!newHadSearch && state === 'entering'` → **区内**（`newIsPost`）自当前位置继续离场、补完退场动画（桌面列表→文章的退场 gate 同时放行 `exiting` 态，相位链等改向播完再播目录入场，保住「先退场再入场」），**跨区**（→ 普通页）仍 `settle(false)` 直接消失（守住用户指定「切到其他界面不渐隐」）。`redirect` 实现要点：① **先读**——cancel 前从 computed style（最后一帧渲染值）读在途位姿（transform matrix / opacity / backgroundColor），与 `nav-indicator.ts` 的 `currentX` 同范式；② cancel 在途动画（它回写的**首关键帧**位姿不可信）；③ **重钉**——把在途位姿写回内联：延迟期（手机端归位 150ms）motion 不写帧、元素停在内联值上，不重钉会暴露首关键帧位姿；④ 补完退场方向（`!show`）强制内联 `visibility: visible`（行变体已翻走隐藏容器，同 `exitDesktop`）；⑤ 兜底 `settle` 跳过在途态（redirect 自己收尾）。同触发条件的残留一并修掉：条带克隆（列表页头 / 面包屑条）没有标记类，快速二次导航 cancel 掉旧条带的模糊退场动画（motion cancel 使 `finished` reject、移除回调不跑）时，幽灵条带残留在行内直到 5s 兜底移除——条带克隆补 `posts-edge-clone` 标记类，`clearClones` 改为查 DOM 清 `.posts-edge-clone, .posts-toc-clone`（目录克隆本有标记，只缺条带这一支）。
- **怎么确认**：CDP 打开列表页，trusted 点击卡片后在 320ms 内点面包屑回列表——修复后：`.posts-search-float` 不退场到 0，而是从飞行中位姿归位（translateX 途中值→0 + opacity 途中值→1，时长按剩余量折算），终态 opacity 1、内联清空（「停下再回去」）；修复前：永久停在 opacity 0。反向（搜索入场未完就再点卡片进文章）：改向起点是 computed 读到的途中位姿（**不是** cancel 回写的首关键帧——cancel 入场后内联已是 x=48/opacity 0，可据此验证「位姿必须 cancel 前读」），搜索自途中位姿补完退场（→48px / opacity 0，途中补 `visibility: visible`），目录入场在其后；修复前：搜索框直接跳到不可见、目录入场紧跟。回列表瞬间查 DOM 无 `.posts-edge-clone` 残留（修复前旧页头幽灵可留到 5s）。
- **同源先例**：第 43 条（motion 的 finished 端点提交内联、收尾清理竞态）、`nav-indicator.ts` 快速连点改向（**先读 computed 在途位姿再改向**——cancel 后内联已被回写首关键帧，读晚必错）、文件头 d①③（快速连切保护）——swup 快速连切场景下，凡「在途相位」的状态机都要在每次 `astro:after-swap` 入口与本轮目的地核对一遍；凡要接在途动画改向的，位姿必须 cancel **前**从 computed 读。

## 49. 切页出入场动画与页面滚动在两个坐标系：钉视口、先退场再入场、坐标闸

- **症状**：深滚出发退场 / 入场时，旧目录克隆被滚顶「带走」向右下漂（或「先下移一段才停住」）；出入场交叉渐隐并行时两个目录同区半透明重叠（重影）；列表→文章搜索框先瞬移再右滑（钉 fixed 后内联 top/left 被写成行相对值、按视口解释）。
- **原因**：退出克隆是**文档坐标**（`position: absolute`），切页的滚顶 + 文档高度塌缩钳制让视口位 = 文档坐标 − scrollY，动画被滚动带走；两条方向相反的对滑并行必然中途占同区；搜索浮层钉 `fixed` 后内联是**视口坐标**，`syncSearchPos` 写行相对值等于瞬移，且列表→文章首次 RO 回调量到的是**克隆条带里的占位符**，把克隆坐标写进真浮层。
- **处理**（三个机制，现行有效）：
  1. **旧克隆创建即钉视口**（`astro:before-swap`：`position: fixed` + 实测视口 rect）——before-swap 早于滚顶启动与文档塌缩钳制，之后任何布局变化都带不走；退场播完 `el.remove()`。
  2. **先退场再入场**：退场与入场是顺序相位（各 320ms），任何时刻只有一个目录 / 搜索框可见，结构性消灭交叉重影；入场要等落位（sticky 夹持位到达，`scrollY ≤ yToc − 82` 判定，rAF + 2.5s 超时双退出）才播。
  3. **坐标闸**：浮层处于 `fixed` 钉住态时 `syncSearchPos` 直接返回（行相对值此刻无效，unpin 后下一轮重测补齐）；占位符只认真实页头的（排除 `.posts-edge-clone` 内的克隆占位符）。
- **共点**：页面滚动本身在动时，凡依赖「元素位置不变」前提的出入场必须先做出前提（钉视口 / 等落位）；钉视口期间任何写行相对坐标的同步逻辑必须让路；克隆子树里的同名节点不许参与测量。

## 50. 侧边「阅读进度」按钮圆角外侧冒出方形的直角亮块（进度条白辉光被矩形滤镜区域裁边）

- **症状**：滚动后右侧悬浮按钮列出现，唯独「阅读进度」那个按钮的圆角外侧多出一小块方形的直角亮块，其余按钮干净；滚动到不同进度，亮块沿环挪到别处。
- **原因**：`.progress-ring-bar` 上的 `filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.8))` 白辉光。CSS 滤镜的生效区域是元素 bbox 外扩 10% 的**矩形**，辉光在这个矩形边界被硬裁，圆角处就露出直边与直角；环本身又画在比按钮大一圈的盒子上（`inset: -1px` + `calc(100% + 2px)`），把被裁的辉光推到按钮轮廓之外，于是亮块直接戳在按钮外面。
- **处理**：删掉该 `filter`，进度环只留 0.9 白描边。通用结论：给 SVG 描边加 `drop-shadow` 时，辉光只存在于 bbox 矩形裁切框内，圆角 / 斜边处会出现直边裁切。
- **怎么确认**：headless 渲染按钮区域后量亮像素包围盒，按钮外形之外不再有高亮像素。

## 51. 一类受限内核（系统 WebView）：离屏栅格预算小

- **症状 A**：部分手机浏览器上文章**过长**时玻璃卡模糊「没了」（卡变透明）——元素超过每层栅格纹理上限（~4096px，GPU 纹理上限）时 `backdrop-filter` 被**静默丢弃**；修法见 `utilities.css` 的 `.glass-tall` 注释（模糊改由 100vh sticky 伪元素承担，采样区恒 ≤ 一屏）。
- **症状 B**：手机文章→完整列表，新列表标题渐显收尾处「闪一帧」，只有列表长到一屏放不下时可见。根因：闪 = **玻璃卡**（推入每帧位移令 N 卡 backdrop 重采样、串行栅格预算小）× **标题行脆弱态**（条带 260ms 渐显收尾后建立）× **终帧位移落在渐显收尾之后**（推入最后一帧位移 = 最终重采样突发，标题行丢一帧）。处理：**位移 200ms 达 0 并钉住**（关键帧 `[±48px, 0px, 0px]` + `times: [0, 0.5, 1]`，动画仍 400ms 结束）——终帧位移落在渐显中，丢帧被 alpha 变化掩盖；浮层时序按新速度整体重标定（退场 100ms 渐隐 / 入场延迟 110ms + 落回 50ms + 渐显 110ms），见 `posts-shell.ts` 文件头注释。
- **这类内核的共性（后续排查入口）**：① 每层栅格纹理上限 ~4096px，超了 backdrop 静默丢弃；② 离屏栅格内存预算小，backdrop 缓冲计入预算，超预算 → 静态场景整个效果丢弃、动态场景帧被推迟；③ backdrop 采样走串行、低优先级、每帧预算小的栅格路径，切页瞬间是新屏 N 卡缓冲建立突发、推入每帧位移又令 N 卡重采样；④ 范畴：系统 WebView 内核（小米自带浏览器、Via 走系统内核）中招，浏览器自带内核（夸克、雨见）预算更大无症状。
- **为什么面包屑不闪（面积大却没事）**：成本不在模糊「面积」，在**独立采样层数量**——文章页大卡是 `.glass-tall`、采样缓冲恒一屏；列表页是 N 张独立 `.post-card.glass`（实测 10 张 + 搜索胶囊）；面包屑无磨砂、出现不依赖 backdrop 栅格化。
- **已排除（别再重复劳动）**：transform 拆层（`translateY(0)` 保活不拆后仍闪）；条带 blur 终帧 `none ↔ blur(0px)` 重栅格（终帧保留 `blur(0px)`，见第 37 条）；退出克隆移除拆过滤层；水合（首帧标记全在 HTML）；进入侧逐帧 blur 关键帧（已改静态模糊副本 + 纯 alpha 交叉）；浮层 unpin 与推入收尾同窗口；标题行过滤层；「动画结束」事件本身——关键是终帧位移的落点，不是结束事件。

## 52. `is:inline` 首帧脚本被 swup 切页重跑（搜索框「移两次 / 闪一下」）

- **症状**：文章→列表时搜索框先以全不透明直接出现在页头终位（目录退场窗口内全程可见），入场动画起播的一瞬又渐隐 + 右移 48px，随后左滑渐显回终位——「移两次 / 闪了一下」。
- **原因**：`BaseLayout` body 尾的搜索框首帧叠放脚本（`is:inline`）被 **`@swup/scripts-plugin`**（`SwupScriptsPlugin`，默认 `reloadScripts: true`）在**每次切页**时重跑：插件以 `document` 为作用域，内联脚本经 `replaceWith` 重执行（module 脚本按 URL 去重不重跑）。脚本的首帧职责只对整页加载成立；切页时 `posts-shell.ts` 已全权负责定位与显隐，重跑纯冲突。
- **处理**：脚本标签加 `data-swup-ignore-script`（该插件官方 opt-out）——只跑整页首帧、切页不重跑。
- **排查入口**：任何「切页后某个首帧脚本的副作用又执行了一次」，先查 `@swup/scripts-plugin` 的全 document 重跑；需要只跑一次的内联脚本必须带 `data-swup-ignore-script` 豁免。

## 53. 电脑端首次列表→文章：搜索框出场「一瞬间消失」不播动画，目录入场跟着卡死

- **症状**：电脑端（≥851px）**首次** swup 从列表切进文章：搜索框不走「右移 48px + 渐隐 320ms」的退场，而是全可见状态下**一瞬间直接消失**；新目录入场跟着不启动（钉在屏外 `translateX(400px)/opacity 0` 不动）或延迟很久才播。第二、三次及以后的切换（热态）一切正常——「只有首次」。目录入场与搜索退场同一机制，同卡顿下目录入场同样卡死不播（用户报「文章目录可能也存在该问题」——属实）。
- **原因**：motion 的 `animate()`（JS 引擎路径）**墙钟从调用时刻起算**：构造时 `play()` 以 `driver.now()` 为起点，rAF tick 按 `currentTime = 帧时间戳 − 起点` 推进，rAF 只在合成器真正出帧时才跑。**首次**切进文章区时 `astro:after-swap` 之后主线程还忙几百 ms（dev：Vite 按需编译 + `PostSearch` 岛水合 + `category-tree` 懒加载 import；生产冷首载同理）——动画墙钟在卡顿里「空转」，出帧恢复后第一次 tick 的 `currentTime` 已越过整个时长（或大半），motion 一次性跳到终帧：用户所见「出场没播、一瞬间直接消失」；跳终帧的场景里 `finished` 要等出帧后才 resolve，等它的相位链（目录入场）跟着卡死。第二次切换全部热态、停顿窗口短于动画时长，照常播放。dev 下实测：after-swap 后主线程卡 ~900ms，远超 320ms 退场时长——退场被整个吃掉。
- **处理**：`posts-shell.ts` 的全部转场动画改**延迟起播**（文件头「转场机制」首段）：一律 `autoplay: false` 创建（时钟冻在首关键帧；起播前位姿由调用方在**同任务**内先同步 pre-pin——无绘制间隙、不闪），再等**下一个真正出帧的 rAF** 才 `play()`（`deferPlay`，并入 `track` / `trackFloat` 登记）——rAF 回调只在合成器出帧时运行，出帧时起播保证动画每一帧都被画出来；卡顿再长也只是退场推迟到卡顿结束，不再被吃掉。配套三处：① 首关键帧 ≠ 元素自然态的动画补**同步 pre-pin**填延迟起播的空窗帧（非 gate 目录入场 `opacity: 0`；新条带渐显 `opacity: 0`——同位模糊副本盖着；手机端推入根 / counter 槽 `translateY(±48px)`）；② `captureOld` 量克隆前清掉槽上 counter pre-pin 的残留位移（与推入根既有的清零对称）；③ 延迟 `play()` 以 `state === 'paused'` 为闸——`cancel()` 会走 `teardown` 把 state 置 `idle`，已取消的动画自然跳过、**不会复活**（motion 的 `cancel()` 不设 `isStopped`，无闸的 `play()` 会把它从 0 重启）。动画生命周期零改动：`animate()` 同步返回控制对象，`floatCtl` 状态机、退出→入场相位链、`finished` 收尾、`captureOld` 的 cancel 全部照旧，只是起播时刻从「after-swap 任务内」推迟到「下一出帧」。
- **怎么确认**：CDP 逐帧采样（headless 1440×900）。dev（bug 场景，首次列表→文章）：修复前 after-swap 后浮层恒 `opacity 1`、transform 零写入 1.6s+，新目录钉 `translateX(400px)/opacity 0` 不播；修复后 stall 结束的第一个出帧上退场完整起播（x 0→48px + opacity 1→0，320ms），退场收尾后目录入场按相位顺序播（opacity 0→1 + translateX 400px→0）。生产回归（headless 静态服务器）：首次切换退场中间帧齐全（cop 1→0.81→0、x 0.4→48px），目录入场随后播；文章→列表（目录克隆渐隐 + 搜索自右 48px 左滑渐显）正常；列表↔列表（分类卡）无退场属设计。手机 375×667 冒烟 PASS（推入根 / counter 槽 ±46→3.6→0 同步、保活写回、浮层退场播完）。已知环境现象：headless 无真实 vsync，合成器偶发在转场中途暂停发帧，动画会冻结在中间值、下一帧到达后恢复——rAF 心跳探针（取证脚本已清理）证实与本次改动无关（autoplay 与否的驱动登记行为一致），真实浏览器由显示器 vsync 持续供帧、不会发生。
- **同源先例**：第 47 条（「headless 长主线程停顿后 WAAPI 帧可能滞后」——同一「动画时钟与出帧脱钩」家族的现象）、第 49 条（dev 的 swap 窗口更宽——本条的停顿窗口同源）、文件头「转场机制」首段（延迟起播是全站转场动画的通用前置）。

## 54. 切页到分类 / 文章后，侧边栏分类树「只有箭头转了、内容不出来」（自动展开失效）

- **症状**：用 swup 切到某个分类或文章后，分类树里当前路径上的节点箭头旋成展开态（`aria-expanded="true"`、`.cat-node--open` 在位），但下面的子分类**不出现**；手动点一下箭头收起再展开才恢复。手机端筛选抽屉里、窄屏文章页回列表时同样偶发。
- **原因**：展开态是「类 + 端点高度」两件事，而端点高度的实现里有两个坑：
  1. **内联压住端点规则**：开合动画由 motion 驱动，`animate(wrap, { maxHeight })` / `animate(children, { y })` 把 `max-height` / `transform` 写成**内联**；内联优先级高于 `.cat-node--open > .cat-children-wrap { max-height: var(--cat-sub-h) }`。切页后由 `syncActive()` 补上的展开类撞上「上一轮动画留下的落点」（`max-height: 0px`、`translateY(-100%)`），视觉上就是箭头转了、内容不出来。
  2. **隐藏态量高写 0**：`#category-tree` 在 `.page-main--post`（≤1150px）与普通页、手机端抽屉未开时都是 `display: none`，此时 `offsetHeight` 全为 0；旧实现把 0 无条件写进 `--cat-sub-h`，上限归零 → 再可见时展开节点也是空的（等 ResizeObserver 重跑才恢复，慢一帧到几帧）。
- **处理**：`posts/category-tree.ts` 的 `measureAll` 改成 `syncSizes`——从最里层往外，① 量到 0（不可见）就**跳过不写**；② 每个窗口同时写 `--cat-sub-h` 与**内联** `max-height`（open = 实高、closed = `0px`），并清掉内层残留的 `transform`，即「开合状态全部由类决定、每次同步都把结果落实成内联端点」。落点三处共用它：模块 init / `astro:after-swap`（`syncHeights`）、容器 ResizeObserver、以及新暴露的 `window.__catTreeSync()`。最后一处由 `row-state.ts` 的 `syncActive()` 在补完自动展开的类之后**立即**调用——否则「先补类、后同步」之间有内联端点空窗（类在位但内联仍是旧落点）。
- **动效**：自动展开不是「啪一下到位」——`syncTree` 量之前先把每个窗口的当前高度记下（`before`），`syncSizes` 写完最终值后，把参与动画的窗口退回起点（刚展开的窗口 `max-height` 0、内层刚体 `translateY(-实高)`，祖先窗口退回展开前高度）再播，曲线 / 时长与点箭头完全同一套（同曲线同长，经 `util/expand-collapse.ts`）。`REDUCE_MOTION` 与首帧 `data-cat-init` 期间直接落位；容器不可见时标记留着，可见后由 ResizeObserver 补播。
  **换页同步必须单点**：`astro:after-swap` 上如果树自己也挂一个监听，同一次换页会同步两遍——第二遍在本任务里把动画起点改写成终值，浏览器先画一帧「已全展开」再从头播，看着是闪一下。所以换页同步只由 `posts-shell` 的 `syncActive()` → `__catTreeSync()` 驱动，树自己只在模块 init 同步一次。
- **怎么确认**：headless Chrome（CDP，`dist` 静态服务器，逐条内联写入）。①列表→分类：`devnotes` 窗口 `clientHeight` 0 → 58；②列表→文章：同样 58；③人为注入残留（`wrap.style.maxHeight='0px'` + `children.style.transform='translateY(-100%)'`）后调用 `__catTreeSync()`：0 → 58 恢复；④1000px 文章页（侧栏 `display:none`）→ 回分类：`--cat-sub-h` 全为 58、无 0 值；⑤375px 抽屉打开后：58；⑥1000px 首页（普通页）→ 分类：58；⑦动效逐帧（MutationObserver 记录每次内联写入）：`0px`（起点）→ 3.1 → 9.6 → 24.3 → 28.6 → 29px，约 340ms 单调爬升，无中间帧落到终值。
- **同源先例**：第 43 条（并发 motion 动画收尾会被另一条动画的端点提交写回——同一「内联端点与 CSS 端点谁说了算」家族）、第 42 条（不可见/位移中的祖先会污染量测）、条目「分类树开合」见 `ARCHITECTURE.md` 的 `posts/category-tree.ts` 行。

## 55. 换到 CSS 背景方案后，时间轴两端没有渐隐（只有图片方案才有）

- **症状**：`src/data/background.ts` 从 `type: 'image'` 换成任意 css 预设后，关于页「历程」时间轴左右两条渐隐带整条消失，卡片到边缘硬切。
- **原因**：渐隐层当时自己铺背景（`background-image: linear-gradient(压暗…), var(--bg-image)`）。`--bg-image` 只有图片方案才由 `Background.astro` 写到 `:root`，css 方案下该变量不存在 → 整条 `background-image` 声明在计算值阶段失效（`none`），渐隐层退化成什么都不画的透明层。同一段代码还把「背景怎么铺」复制了一份（`background-size` 的 `max()` 公式、`--bg-ratio`），图片方案一改铺法就得同步两处。
- **处理**：渐隐层只管裁剪 + 遮罩，画面交给里面一份**背景容器克隆**：`<div class="bg bg--clone">` + `<div class="bg-scrim">`。克隆与真实那层用同一个类、同一套铺法（`global.css` 里 `.bg--image, .bg--clone` 共用），预设的 `::before` / `::after` 自动跟着画，任何背景方案都不用改 `Timeline.svelte`。铺法规则从 `.bg--image` 抬到容器级，`--bg-image` 补 `none` 兜底；压暗层真实那层仍用 `::before`，克隆层用子元素（否则会占掉预设自己的 `::before`）。
- **怎么确认**：CDP（取证脚本已清理）。① 图片方案：克隆 `getBoundingClientRect()` = `0,0,1440,900` 与真实 `.bg` 一致，`background-image` / `size` / `position` / `repeat` 逐项相等——headless 里 `mask` 不会给 `position: fixed` 造包含块；② 与旧实现逐像素对比：1248×298 裁剪区差异 1.21%、最大通道差 6/255，且只落在两条渐隐带内（合成取整差，不是位移）；③ 藏掉渐隐层再拍：图片方案差 2.85%（最大 205）、css 方案 wave-dots 差 2.62%（最大 215），同样只落在两条带内——证明两条带确实在画背景（旧实现在 css 方案下这条差异会是 0）。
- **同源先例**：克隆只能待在渐隐层里、不能整体套 mask（会破坏卡片 backdrop 采样，见第 20 条）。

## 56. 构建失败：`inline-css 没能内联全部外链 CSS` / `strip-safe-comments 误伤了水合标记`

- **症状**：`pnpm build` 在 `astro:build:done` 阶段报错退出（`dist/` 已写出但内容不可用），报错里带具体页面与数字，例如「水合锚点 27 → 0，岛屿标记 5 → 5」或「残留 4 条，例如 `<link rel="stylesheet" href="/_astro/x.css">`」。
- **原因**：这是后处理自检在按设计工作——正则没匹配上（替换失效）或误删了水合锚点。**不是误报**：
  - 锚点/岛屿那条比较的是同一份产物删注释前后的计数，两边用同一个检测器；Astro 改锚点格式时两边一起变 0，不会触发。
  - 外链那条用的是比替换正则更宽的探测器，属性顺序、自闭合写法变了也照样认得出来。
- **处理**：按报错分别修——外链残留 → 改 `astro.config.ts` 里 `inlineCss()` 的替换正则；锚点减少 → 改 `isHydrationComment()` 认的锚点形状。改完重跑 `pnpm build`，绿了才算过。
- **怎么确认自检本身没坏**：故意把替换正则的 `rel="stylesheet"` 改成 `rel="stylesheets"` 构建，应报「没能内联全部外链 CSS」；把 `commentReplacer` 改成无条件返回空串构建，应报「误伤了水合标记」。两处都能如期报错，说明断言还活着（验证完记得还原）。

## 57. 日期整体早一天：构建机时区在 UTC 以西时，文章日期与 RSS `pubDate` 集体偏一天

- **症状**：文章页与列表页的日期比 frontmatter 里的 `date` 早一天；RSS 里的 `pubDate` 也跟着偏。
- **原因**：用本地时间取值（`getFullYear` / `getMonth` / `getDate`）格式化 ISO 日期。`new Date('2026-09-06')` 按 **UTC 零点**解析，在 UTC 以西的机器上本地日期是 9 月 5 日，取本地年月日就少一天。
- **处理**：日期一律走 UTC 取值——`d.toISOString().slice(0, 10)`。输入是 `YYYY-MM-DD` 时，UTC 解析 + UTC 截取 = 原始日历日，跨时区结果一致。
- **同类**：入坑天数（`DaysCounter.svelte`）不能拿 `Date.now()` 直接除毫秒算——起始日到「现在」的毫秒差除以 24 小时会在夏令时切换那天算错。改成按本地日历日解析起始日、与「今天零点」比自然日差。
- **怎么确认**：同一段实现挂四个 `TZ`（Asia/Shanghai / America/New_York / Pacific/Honolulu / UTC）跑一遍对照，输出应完全一致。

## 58. 目录竖线（活动指示条）整条看不见：高度一直为 0

- **症状**：手机端或窄屏打开目录抽屉，竖线（活动项指示条）完全不显示，滚动时才可能闪现；桌面端不受影响。
- **原因**：竖线高度在测量后写死，但测量时机早于抽屉把目录节点搬进宿主——此时节点不可见，量到的高度是 0，写进去就再也不更新。
- **处理**：高度同步与「活动项」分开——每次激活活动项都重新量一次活动项高度再写竖线；整体重测（remeasure）后补一次。写高度前跳过 `height <= 0` 的情况，避免用 0 覆盖已有值。
- **怎么确认**：窄屏打开目录抽屉，读竖线元素的 `style.height`：第一项应为几十像素（跟随活动项高度），不能是 `0px`。

## 59. 目录项是链接但键盘进不去：`<a>` 少了 `href`

- **症状**：目录里的每一项看起来是链接，鼠标能点，但 Tab 键走不到，读屏也不把它当链接播报。
- **原因**：渲染成 `<a>` 却没写 `href`。没有 `href` 的 `<a>` 既不进 Tab 序列，也不被辅助技术识别为链接。
- **处理**：补上 `href={'#' + heading.slug}`。点击行为仍由 `posts/toc.ts` 接管（`preventDefault` + 平滑滚动），`href` 只负责语义与键盘可达，不改交互。

## 60. dev 里改一篇文章就报错，刷新也不好了，只能重启 `pnpm dev`

- **症状**：`pnpm dev` 期间某次加载抛了错（例如刚保存的 markdown 恰好语法不完整），之后每次刷新都还是同一个错误，改好文件也不恢复，必须重启 dev server。
- **原因**：`lib/posts-data.ts` 的 `loadBlogData()` 缓存的是**构建 Promise 本身**。那次失败后，缓存里躺着一个已经 rejected 的 Promise，之后每次调用都直接返回它——不会重新构建，也就永远拿不到修正后的数据。
- **处理**：失败时把缓存清空，让下次调用重新构建。清空前要核对缓存里仍是本次那个 Promise（`if (cache === pending)`），否则会把别处刚建好的新缓存误清掉。
- **怎么确认**：断点停在 `loadBlogData`，故意让 `buildData()` 抛一次错；下次调用应重新进入 `buildData()`，而不是原地返回同一个 rejected Promise。

## 61. 转场时「目录不动了 / 抽屉打开是空的 / 筛选按钮跑出来」

**症状**：快速连切两次以上，期间目录竖线不跟随、手机端点目录按钮开出空抽屉；或切页动画还在播时侧边栏的筛选按钮突然出现。刷新即恢复，只在转场窗口内出现。

**原因**：`strip.cloneIntoRow` 做视觉副本时是 `cloneNode(true)`，克隆**保留原类名**（`.post-sidebar`、`.toc-nav`）并追加标记类挂进行内；而行的位置在 `main#swup` 之外、文档顺序比真节点更靠前。于是 `document.querySelector('.post-sidebar')` / `('.toc-nav')` 在克隆存活的那 5s 内会**先命中克隆**——那是一个 `pointer-events: none` + `aria-hidden` 的静态副本：

- `toc.ts` 把真目录节点 `appendChild` 进克隆，克隆 5s 后被删，目录跟着消失；
- 测量读到克隆的几何（脱离文档流、`position: absolute`），竖线全部错位；
- `swup-widgets.ts` 用 `.toc-nav .toc-link` 判断「本页有目录」，克隆让它恒真，筛选/目录按钮的出现区间随之错乱。

**修法**：查这两类节点一律走 `src/assets/js/util/post-sidebar.ts`——`queryPostSidebar()` / `queryTocNav()` 会跳过 `closest('.posts-toc-clone, .posts-edge-clone')` 的命中，`isTransitionClone()` 是同一条判据的复用形式。自己新写查询时别再直接 `document.querySelector('.post-sidebar')`。

同理，`.posts-header` 里的搜索占位符也有克隆副本，`posts-shell.ts` 已按 `closest('.posts-edge-clone')` 排除（见第 49 条）。

## 62. 长文里同屏出现两条滚动条（页面滚动条 + 目录滚动条）

**症状**：桌面端滚动长文时，屏幕右侧同时出现两条滚动条——视口右缘的全站页面滚动条，和侧栏目录右缘那条 2px 细滚动条，后者只要目录内容溢出就常驻。

**原因**：目录内层滚动容器 `.toc-scroll` 原先溢出即常显细滚动条；页面滚动条则在页面滚动或悬停右侧留白时显示。长文目录溢出时两者恰好在同一时刻可见，观感像多卡出一条。

**修法**：`.toc-scroll` 的滚动条改为默认隐藏，`:hover` / `:focus-within` 时显现（`src/components/posts/TableOfContents.astro` 的 scoped 样式：`scrollbar-color` 与 `::-webkit-scrollbar-thumb` 默认透明、悬停还原值，跨浏览器「三件套」保持齐全）。指针停在目录上时 `src/assets/js/posts/toc.ts` 拦截 wheel 不传给页面，页面滚动条此时不会显示；指针在正文滚动页面时目录滚动条处于透明默认态。两条从此不同屏。

**怎么确认**：长文里指针停在正文滚动，只应看到页面滚动条；指针移到目录上，2px 细滚动条才出现，且此时滚动只滚目录、页面不动。

## 63. 点目录项后 URL 尾部多出锚点（#xxx）；悬停目录项状态栏显示链接地址

**症状**：桌面端点文章目录项，URL 尾部立刻多出 `#标题slug`（如 `/posts/devnotes/css/selector/#11-通配选择器-`）并保留；用这个地址重进页面，浏览器首载就会跳到对应标题。另一个同源表现：鼠标悬停目录项时，浏览器左下角状态栏显示链接地址（`…#slug`）——目录项是页内滚动定位，不是导航链接，地址提示是噪音。

**原因**：目录项当时是真链接 `<a href="#slug">`。URL 问题：swup 4 内置同页锚点处理。swup 默认 `linkSelector` 是 `a[href]`，它在 document 上的点击委托也捕获目录链接：同页链接带 hash 时走 `link:anchor` 默认处理器——`updateHistoryRecord(url + hash)`（`history.pushState` 把 `#slug` 写进 URL，就是尾部锚点的直接来源）加 `scrollToContent`（它自己滚到锚点），与 `posts/toc.ts` 的平滑滚动并行、竞争落点。状态栏问题：Chromium 只对真链接（`a` / `area[href]`）显示悬停地址提示。

**修法**：目录项改为 `<button type="button">`（`src/components/posts/TableOfContents.astro`）。swup 的 `linkSelector`（`a[href]`）从此捕获不到它，同页锚点处理自然不发生；`posts/toc.ts` 的点击委托 + 平滑滚动不变，URL 不再变。button 无 href，状态栏不再显示地址。代价：目录项丢失中键 / 右键「在新标签打开标题」的深链能力（目录项本来就不是导航出口，刻意接受）。

**怎么确认**：长文里连点数次目录项，URL 尾部不出现 hash；页面落到对应标题（按导航高度偏移），目录高亮同步；悬停目录项，状态栏无地址提示。

## 64. 点目录项后目录滚动条常显，与页面滚动条同屏（第 62 条症状复发）

**症状**：桌面端点过一次目录项后，侧栏目录右缘的 2px 细滚动条不再自动隐藏；随后指针在正文滚动页面，视口右缘的页面滚动条与它同时可见，又是两条。

**原因**：指针点击目录项会把焦点带到该目录项上（点击的预激活阶段即完成聚焦，与是否拦截导航无关）。目录滚动条按第 62 条的修法在 `:focus-within` 时显现（给键盘用户滚动目录时的指示），焦点不离开目录它就恒真，滚动条一直可见。

**修法**：`src/assets/js/posts/toc.ts` 的点击委托里，指针点击（`e.detail > 0`）对目录项 `blur()`；键盘激活（Enter / 空格，detail 为 0）保留焦点，键盘用户滚动目录时的指示不丢。

**怎么确认**：点一次目录项后 `document.activeElement` 不再是目录项；指针在正文滚动时只看到页面滚动条，移回目录上 2px 细条才出现。

## 65. 长文滑到底、目录滑到顶后，目录右缘并排出现两条细滚动条

**症状**：桌面端长文，文章滑到最下方后把目录滑到最上方，目录右缘同时出现两条 2px 细滚动条并排——一条是目录内层滚动的悬停条（第 62 条的门控条），另一条从侧栏边缘「卡」出来。活动项仍在窗内时（目录居中跟随）不出现，只有活动项被推出目录可视窗才出现。

**原因**：活动项竖线 `.toc-active-bar` 是绝对定位，`translateY` 由活动项 offset 减目录 `scrollTop` 现算。文章在底部时活动项是最后一项，目录滚到顶后竖线被定位到目录可视窗下方数百像素处；`.toc-track` 原先不裁剪，竖线溢出计入其最近的滚动容器——sticky 的 `.post-sidebar`（`overflow-y: auto`，`src/layouts/PostsShell.astro`）——侧栏 `scrollHeight` 瞬间大于 `clientHeight` 变可滚，它自带的无门控细滚动条（0.1 alpha、2px）随之弹出，与悬停的目录条并排。

**修法**：`.toc-track` 加 `overflow: hidden`（`src/components/posts/TableOfContents.astro` 的 scoped 样式）。竖线在活动项出窗时被裁在轨道边缘（出窗本来就不该画在外面），溢出无从进入侧栏滚动区。单条 CSS 覆盖竖线位移的全部写入路径（滚轮现算、触摸 scroll 监听、retarget 过渡），不逐点改 JS 钳制；侧栏 `overflow-y: auto` 保留作防御。

**怎么确认**：文章滑到底、目录滑到顶，侧栏 `scrollHeight === clientHeight`（不可滚），同屏只剩目录自己的悬停细条一条；把目录滑回活动项在窗内，竖线照常贴住活动项。

## 66. 侧边悬浮按钮入场有动画、退场瞬间消失

**症状**：文章页右侧悬浮按钮列（返回顶部 / 目录 / 筛选 / 进度 / 评论 / 底部）滚过阈值后从右滑入淡入，滚回去移除 `.visible` 时却原地瞬间消失，没有退场动画。手机桌面均可复现，与端无关。

**原因**：`transition` 是单属性、不按列表合并。`src/assets/css/utilities.css` 的 `.hoverable.hoverable` 权重 (0,2,0)，声明的 transition 只含四个悬停属性（background / box-shadow / border-color / color），整条盖掉低权重基础规则里的 transition——opacity / transform / visibility 不再过渡，退场目标态（基础态）直接跳变。入场时 `.back-to-widget.visible` 同为 (0,2,0) 靠源码顺序胜出，所以入场正常，容易误判成「只坏退场」。

**修法**：基础规则提升为 `.side-widgets .back-to-widget`（(0,2,0)，`src/assets/css/global.css`），靠源码顺序压过 `.hoverable.hoverable`；transition 列表里四个悬停属性仍照写全，悬停过渡不丢。

**怎么确认**：按钮基础态的 `getComputedStyle` 中 `transitionProperty` 含 opacity / transform / visibility 加四个悬停属性；移除 `.visible` 后 opacity / transform 平滑过渡到 0 / 80px，播完 visibility 才切 hidden。

## 决定台账（刻意设计 / 已知不修 / 排查过不是 bug）

> 收「看起来有问题、其实不是，或已决定不改」的事。看到对应现象**别修**，按表处理。不记变更史，只记现行决定与理由；同类只登记一处。

### 已知不修（作者拍板）

| 事项                     | 决定                        | 为什么                                                                                        |
| ------------------------ | --------------------------- | --------------------------------------------------------------------------------------------- |
| 手机端站内菜单箭头       | 保持 `la:external-link-alt` | `la:angle-right` 看着像「展开」、`la:chevron-circle-right` 站内预览也不满意，都否掉后回退原版 |
| `rgba(255,255,255,0.08)` | 保持字面量、不收敛成令牌    | 与 `--ring` / `--hover-bg` 同值，同时承载「静止描边」和「悬停填底」两种语义                   |

### 刻意设计（不是 bug）

| 事项                                                                           | 为什么是刻意的                                                                                                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文章卡片封面图被拉伸变形（`object-fit: fill`）                                 | 卡片封面框固定 4:3，图片按比例**填满**（`fill`）而非裁切，保留完整画面、不裁掉主体                                                                 |
| 手机端列表页筛选键比同列其他键大一圈                                           | 筛选键「紧凑形态」用 `#posts-filter-fab.compact` 单独定尺寸，有意的视觉区分（信息量不同的按钮给不同大小）                                          |
| 正文里被 `<a>` 包住的图片点开只放大、不跳转                                    | 正文图片点击**统一交给灯箱**，不因外层有链接而改变行为；跳转走图片旁的文字链接                                                                     |
| 正文出现 `#` 级标题时目录里的 `###` 条目全部消失                               | 文章标题本身是 `#` 级（frontmatter 的 title），正文标题从 `##` 起算；正文出现 `#` 说明作者把正文当成了另一个层级，目录按「以 h1 为准」处理符合预期 |
| 抽屉标题栏与导航同用 56 / 68px                                                 | 两个数值只是视觉高度恰好相同；抽屉从视口顶开始、不避让导航，改导航高度不应连带改抽屉标题栏                                                         |
| `640px`（Footer）/ `1024px`（Quote+Clock）断点                                 | 页面专属断点，AGENTS §5 明文允许、明文「别拉齐」                                                                                                   |
| 四种 chip / 标签视觉分别定义                                                   | 分类筛选、文章标签、技术栈、项目主题承担的交互与密度不同；没有会造成功能失效的共变关系，不强行合并                                                 |
| 三套骨架各有不同块结构                                                         | 时钟、天数、项目卡的加载内容不同；共享颜色与闪烁动画已足够，结构随组件保留                                                                         |
| `--posts-offset-gap` 的镜像写法                                                | 侧栏偏移由运行时实测写入行内联变量，CSS 里的值是首帧默认值的镜像，刻意的                                                                           |
| `.hoverable.hoverable` 双类                                                    | 特异性 hack，原因见 `CSS.md`「悬浮反馈」                                                                                                           |
| 5 个背景预设彼此独立（含 ocean/wave-dots、blueprint/honeycomb 两对观感相近的） | 预设是独立视觉设计，刻意不合并                                                                                                                     |
| `BaseLayout` 首帧搜索框脚本复制                                                | `is:inline` 脚本不能 import、无法共享，复制是唯一解                                                                                                |
| `row-state` / `BaseLayout` 的行变体「双源」                                    | 构建期初值 + 运行时更新，swup 的标准模式，不是双写                                                                                                 |
| `dayscounter.ts` / `techstack.ts` 旧文件名                                     | 存量豁免（AGENTS §2.1），禁止新增、允许保留                                                                                                        |
| markdown 局部颜色、骨架 0.06/0.14、头像光环、时钟仪表配色                      | 在 `CSS.md`「硬编码值白名单」，不当遗漏                                                                                                            |
| 图片方案兜底纯黑 `#000`                                                        | 与首载 loading 屏衔接，见 `CSS.md`「全站背景」                                                                                                     |

### 排查过、确认不是 bug

| 疑点                                            | 结论                                                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `row-state.ts` 的 MQL 监听不销毁 → 会累积？     | 不会。模块脚本每文档只执行一次（ESM 缓存），swup 切页不重跑 module 脚本，无累积路径                                                |
| PostSearch 的 Pagefind 加载失败是静默的？       | 不是。带 `[PostSearch]` 前缀的 `console.error` + UI 错误态 + 2 次重试                                                              |
| `strip.ts` 的 5s 定时器是孤儿泄漏？             | 不是。有注释的兜底设计（「visit 被中断、after-swap 永不来」的孤儿克隆）；节点被 `clearClones` 移除后，定时回调对已脱离节点是 no-op |
| `body-scroll-lock` 会解锁成负数？               | 不会。`unlock` 有 0 下限                                                                                                           |
| `row-state.ts` 的标签文本匹配是宽判定？         | 刻意。注释明确「chip 只渲染真实标签，按文本匹配即可」，且每次必跑 toggle 防高亮残留                                                |
| `toc.ts` 空目录页会崩？                         | 不会。`measure()` 有空条目早返回                                                                                                   |
| `transition.ts` 两处 TOC 退场块分叉、观感不同？ | 无风险。两处退场已合并进共享核 `playTocExit`，时长 / 缓动天然一致                                                                  |
