---
title: "文章元数据"
date: 2024-12-15
description: "完整的文章 frontmatter 元数据说明，包括各字段的类型、默认行为与用法。"
image: ""
tags: ["博客", "教程", "配置"]
pinned: false
---

## 元数据一览

frontmatter 里的字段在 `src/content.config.ts` 中定义。所有字段都是可选的——缺省时 schema 会给出默认值，但缺省越多，文章在列表里的表现就越不完整，所以标题、日期、标签建议每篇都写。

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `title` | `string` | `"无标题"` | 文章标题，显示在详情页与文章卡片 |
| `date` | `string`/`Date` | 无（不显示、排最后） | 发布日期，经 `z.coerce.date()` 转为 `Date`，页面只显示日期部分 |
| `description` | `string` | 无 | 文章摘要，显示在卡片，同时用作详情页的 SEO meta description |
| `image` | `string` | 无 | 封面图路径，显示在详情页标题下方与卡片右侧 |
| `tags` | `string[]` | `[]` | 标签数组，用于标签筛选与侧栏标签云 |
| `pinned` | `boolean` | `false` | 是否置顶，置顶文章排在列表最前并带图钉图标 |

> 其他博客常见的 `categories` / `category` / `分类` 等字段在 schema 中会被放行（不会报错），但**一律忽略**，不参与分类也不展示。文章分类只由目录结构决定，详见[分类系统](/posts/alula/posts/categories/)。

## 核心字段

### title

文章标题，字符串类型。显示在文章详情页标题和文章卡片中。不填时默认显示为「无标题」。

```yaml
---
title: "我的第一篇文章"
---
```

### date

发布日期。支持 `YYYY-MM-DD`（或任何能被 `new Date()` 解析的格式），schema 会自动转成 `Date` 类型。页面仅取日期部分按 `YYYY-MM-DD` 显示，并用于列表排序：**置顶优先，同级按日期倒序**。

不填 `date` 时文章不显示日期，且在排序时排在有日期的文章之后。

```yaml
---
date: 2024-12-15
---
```

## 可选字段

### description

文章摘要，字符串类型。显示在文章卡片中，同时作为详情页的 SEO meta description。

```yaml
---
description: "这篇文章介绍了如何使用 CSS Grid 布局"
---
```

### image

文章封面图路径，字符串类型。显示在文章详情页标题下方和文章卡片右侧。支持两种写法：

- **`/` 开头**：从 `public/` 目录提供，如 `/images/cover.png` 对应 `public/images/cover.png`，原样引用不做处理。
- **相对路径**（不以 `/` 开头）：视为本地图片，交给 `astro:assets` 压缩并重命名（产物在 `/_astro/` 下）。路径以**文章所在目录**为基准解析，最终落在 `src/` 内。例如位于 `src/content/posts/2024/` 的文章写 `../../assets/images/x.jpg`，实际指向 `src/content/assets/images/x.jpg`。

建议把图片统一放进 `src/content/assets/images/` 或 `public/`，方便管理。

```yaml
---
image: "/images/cover.png"
---
```

### tags

标签数组，字符串数组类型。用于标签筛选与侧栏标签云，点击标签可跳转到按标签筛选的列表页。

```yaml
---
tags: ["CSS", "前端", "布局"]
---
```

默认值为 `[]`。

### pinned

是否置顶，布尔类型。置顶文章会显示在列表最前面，并带有置顶图标。

```yaml
---
pinned: true
---
```

默认值为 `false`。

## 完整示例

```yaml
---
title: "CSS Grid 布局完全指南"
date: 2024-11-20
description: "深入理解 CSS Grid 布局，从基础到高级用法。"
image: "/images/css-grid-cover.png"
tags: ["CSS", "前端", "布局"]
pinned: false
---
```
