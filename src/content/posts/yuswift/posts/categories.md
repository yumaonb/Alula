---
title: "分类系统"
date: 2024-12-15
description: "本博客的分类识别机制详解，包括 Frontmatter 分类、目录结构分类和配置文件用法。"
image: ""
tags: ["博客", "教程", "配置"]
pinned: false
---

## 推荐方式：目录结构分类

**最推荐使用目录结构来组织分类。** 只需将文章放入对应目录，分类自动识别，无需在每篇文章中重复写 `categories` 字段。

例如：

```
src/content/posts/
├── tech/
│   ├── frontend/
│   │   ├── css-grid.md        → 自动分类: ["tech", "frontend"]
│   │   └── react/
│   │       └── hooks.md       → 自动分类: ["tech", "frontend", "react"]
│   └── typescript.md          → 自动分类: ["tech"]
└── life/
    └── travel.md              → 自动分类: ["life"]
```

文章 `tech/frontend/css-grid.md` 会自动获得分类 `["tech", "frontend"]`，完全不用在 frontmatter 里写任何分类字段。

### 配合配置文件自定义显示名称

没有配置文件时，分类显示名就是目录名（如 `tech`）。想显示中文名，在对应目录下放一个配置文件即可：

**`tech/_category.yml`：**

```yaml
name: "技术"
description: "前端、后端、DevOps 等技术文章"
```

**`tech/frontend/_category.yml`：**

```yaml
name: "前端"
description: "HTML、CSS、JavaScript、框架等前端技术"
```

**不放配置文件则直接使用目录名。**

### 支持的配置文件名

| 文件名 | 格式 |
|---|---|
| `_category.yml` / `_category.yaml` | YAML |
| `category.json` | JSON |
| `_category.toml` | TOML |
| `.category.yml` | YAML |

### 目录分类的优先级

Frontmatter 中的 `categories` 字段优先级高于目录推断。如果两者都有，以 frontmatter 为准。

## Frontmatter 分类（备选方式）

如果不方便使用目录结构，也可以在每篇文章的 frontmatter 中写 `categories` 字段。具体格式见[文章字段参考](/posts/yuswift/posts/fields/)。

### 支持的格式速查

| 格式 | 示例 |
|---|---|
| 字符串数组 | `categories: ["技术", "前端"]` |
| 嵌套数组 | `categories: [["技术", "前端"]]` |
| 对象数组 | `categories: [{name: "前端", parent: "技术"}]` |
| 斜杠字符串 | `categories: "技术/前端"` |
| 大于号字符串 | `categories: "技术 > 前端"` |
| 纯字符串 | `categories: "技术"` |

字段名支持 `categories`、`category`、`分类` 三种写法，按优先级自动识别。

## 分类 URL 配置

通过 `src/data/posts.ts` 的 `categoryBase` 控制分类 URL 中的路径前缀：

```typescript
export const posts: PostsConfig = {
  contentRoot: "content/posts",
  category: {
    // "" → /posts/前端/
    // "categories" → /posts/categories/前端/
    // "category" → /posts/category/前端/
    categoryBase: "",
  },
};
```

| 平台 | 原 URL 格式 | `categoryBase` |
|---|---|---|
| Hexo | `/编程/Python/` | `""` |
| Hugo | `/categories/python/` | `"categories"` |
| WordPress | `/category/python/` | `"category"` |
| Typecho | `/category/python/` | `"category"` |
| VuePress | `/categories/前端/` | `"categories"` |
| VitePress | `/categories/前端/` | `"categories"` |

## 文章标签

标签通过 frontmatter 的 `tags` 字段定义，与分类是独立的两套系统：

```yaml
---
tags: ["Vue", "JavaScript", "前端"]
---
```

标签显示在文章卡片和详情页中，点击可跳转到按标签筛选的列表页。分类用于层级组织，标签用于横向关联。

## 自动识别规则总结

```
文章的 frontmatter 有 categories 字段？
  ├── 有 → 使用 frontmatter 的分类
  └── 没有 → 从文件目录路径推断分类
              ├── 目录下有配置文件？→ 使用配置文件中的 name
              └── 没有配置文件 → 直接使用目录名
```