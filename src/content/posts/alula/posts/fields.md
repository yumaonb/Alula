---
title: "文章元数据"
date: 2024-12-15
description: "完整的文章 frontmatter 元数据说明，包括必填和可选元数据的数据类型与用法。"
image: ""
tags: ["博客", "教程", "配置"]
pinned: false
---

## 必填元数据

### title

文章标题，字符串类型。显示在文章详情页和文章卡片中。

```yaml
---
title: "我的第一篇文章"
---
```

### date

发布日期，日期类型。支持 `YYYY-MM-DD` 格式，用于文章排序和日期显示。

```yaml
---
date: 2024-12-15
---
```

## 可选元数据

### description

文章摘要，字符串类型。显示在文章卡片中，同时用于 SEO 的 meta description。

```yaml
---
description: "这篇文章介绍了如何使用 CSS Grid 布局"
---
```

### image

文章封面图片路径，字符串类型。显示在文章详情页标题下方和文章卡片中。

```yaml
---
image: "/images/cover.png"
---
```

支持相对路径和绝对路径。相对路径基于 `public/` 目录。

### tags

标签数组，字符串数组类型。用于文章分类和筛选，点击标签可跳转到按标签筛选的列表页。

```yaml
---
tags: ["CSS", "前端", "布局"]
---
```

### pinned

是否置顶，布尔类型。置顶文章会显示在列表最前面，并带有置顶图标。

```yaml
---
pinned: true
---
```

默认为 `false`。

### categories

分类元数据，支持多种格式。详细说明见[分类系统](/posts/alula/posts/categories/)。

```yaml
---
# 字符串数组（推荐）
categories: ["技术", "前端", "React"]

# 嵌套数组
categories: [["技术", "前端"]]

# 对象数组
categories:
  - name: "React"
    parent: "前端"

# 斜杠字符串
categories: "技术/前端"

# 大于号字符串
categories: "技术 > 前端"

# 纯字符串
categories: "技术"
---
```

元数据名支持 `categories`、`category`、`分类` 三种写法，主题会按优先级自动识别。

### category

`categories` 的简写形式，效果相同。二选一使用即可。

```yaml
---
category: "技术"
---
```

## 完整示例

```yaml
---
title: "CSS Grid 布局完全指南"
date: 2024-11-20
description: "深入理解 CSS Grid 布局，从基础到高级用法。"
image: "/images/css-grid-cover.png"
tags: ["CSS", "前端", "布局"]
pinned: false
categories: ["技术", "前端"]
---
```

## 元数据兼容性对照

从其他博客平台迁移时，以下元数据的对应关系：

| 本博客元数据 | Hexo | Hugo | WordPress | Jekyll | Fuwari |
|---|---|---|---|---|---|
| `title` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `date` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `description` | ✓ | `summary` | ✓ | ✓ | ✓ |
| `image` | `cover`/`thumbnail` | ✗ | ✗ | ✗ | ✓ |
| `tags` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `pinned` | `top`/`sticky` | `weight` | ✗ | ✗ | `order` |
| `categories` | ✓ | ✓ | ✓ | ✓ | ✓ |

`✓` 表示元数据名和格式完全兼容，直接使用。其余需按平台说明转换。