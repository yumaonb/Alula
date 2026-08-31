---
title: "分类系统"
date: 2026-08-31
description: "本博客的分类识别机制详解，包括目录结构分类、Frontmatter 分类和配置文件用法。"
image: ""
tags: ["博客", "教程", "配置"]
pinned: false
---

## 概述

本博客支持两种分类方式，系统按以下优先级自动识别：

1. **Frontmatter 显式定义** — 在文章的 frontmatter 中写 `categories` 字段
2. **目录结构隐式推断** — 根据文章所在的目录路径自动生成分类

两种方式可以混用，Frontmatter 优先级更高。如果没有写任何分类信息，文章会归入根目录。

---

## 目录结构分类（推荐）

**最推荐的方式。** 只需将文章放入对应目录，分类自动识别，无需在每篇文章中重复写 `categories` 字段。

### 基本用法

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

文章 `tech/frontend/css-grid.md` 会自动获得分类路径 `["tech", "frontend"]`，URL 为 `/posts/tech/frontend/css-grid/`。

### 配置文件自定义显示名称

没有配置文件时，分类显示名就是目录名（如 `tech`）。想显示中文名，在对应目录下放一个配置文件即可：

```
src/content/posts/tech/
├── _category.yml              ← 分类配置文件
├── frontend/
│   ├── _category.yml          ← 子分类配置文件
│   └── css-grid.md
└── typescript.md
```

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

不放配置文件则直接使用目录名作为显示名。

### 支持的配置文件名

同级目录下存在多个配置文件时，按优先级取第一个生效：

| 优先级 | 文件名 | 格式 |
|---|---|---|
| 1 | `_category.yml` / `_category.yaml` | YAML |
| 2 | `.category.yml` | YAML |
| 3 | `category.json` | JSON |
| 4 | `index.json` | JSON |
| 5 | `_category.toml` | TOML |
| 6 | `index.md` | Markdown frontmatter |

### 配置文件字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | **是** | 分类显示名称，如 `"前端"`。不填则使用目录名 |
| `description` | `string` | 否 | 分类描述，显示在分类列表页标题下方 |
| `title` | `string` | 否 | 备用标题字段，功能与 `name` 相同 |

> `name` 是唯一有实际用途的必填字段。如果只写其他字段而不写 `name`，分类显示名将回退为目录名。

### 各格式完整示例

**YAML（`_category.yml` 或 `_category.yaml`）：**

```yaml
name: "前端"
description: "HTML、CSS、JavaScript、框架等前端技术"
```

**YAML 隐藏文件风格（`.category.yml`）：**

```yaml
name: "前端"
description: "HTML、CSS、JavaScript、框架等前端技术"
```

**JSON（`category.json`）：**

```json
{
  "name": "前端",
  "description": "HTML、CSS、JavaScript、框架等前端技术"
}
```

**JSON 索引文件（`index.json`）：**

```json
{
  "name": "前端",
  "description": "HTML、CSS、JavaScript、框架等前端技术"
}
```

**TOML（`_category.toml`）：**

```toml
name = "前端"
description = "HTML、CSS、JavaScript、框架等前端技术"
```

**Markdown frontmatter（`index.md`）：**

```markdown
---
name: "前端"
description: "HTML、CSS、JavaScript、框架等前端技术"
---

本分类包含前端相关技术文章。
```

---

## Frontmatter 分类（备选方式）

如果不方便使用目录结构，也可以在每篇文章的 frontmatter 中写 `categories` 字段。

### 字段名

支持三种写法，按优先级自动识别：

| 优先级 | 字段名 | 示例 |
|---|---|---|
| 1 | `categories` | `categories: ["技术", "前端"]` |
| 2 | `category` | `category: "技术/前端"` |
| 3 | `分类` | `分类: ["技术", "前端"]` |

### 支持的值格式

| 格式 | 示例 | 识别结果 |
|---|---|---|
| 字符串数组 | `categories: ["技术", "前端"]` | `["技术", "前端"]` |
| 嵌套数组 | `categories: [["技术", "前端"]]` | `["技术", "前端"]` |
| 对象数组 | `categories: [{name: "前端", parent: "技术"}]` | `["技术", "前端"]` |
| 斜杠字符串 | `categories: "技术/前端"` | `["技术", "前端"]` |
| 大于号字符串 | `categories: "技术 > 前端"` | `["技术", "前端"]` |
| 纯字符串 | `categories: "技术"` | `["技术"]` |

> 对象数组格式中，系统会自动识别 `parent` 字段构建层级关系，最终提取出从根到叶的路径。

### 示例

```yaml
---
title: "CSS Grid 完全指南"
categories: ["技术", "前端"]
tags: ["CSS", "布局"]
---

正文内容...
```

---

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

不同平台的推荐配置：

| 平台 | 原 URL 格式 | `categoryBase` |
|---|---|---|
| Hexo | `/编程/Python/` | `""` |
| Hugo | `/categories/python/` | `"categories"` |
| WordPress | `/category/python/` | `"category"` |
| Typecho | `/category/python/` | `"category"` |
| VuePress | `/categories/前端/` | `"categories"` |
| VitePress | `/categories/前端/` | `"categories"` |

---

## 标签与分类的区别

标签和分类是两套独立的系统：

| | 分类 | 标签 |
|---|---|---|
| **组织方式** | 层级结构（树形） | 扁平结构（横向关联） |
| **定义位置** | 目录结构或 frontmatter `categories` | frontmatter `tags` |
| **一篇文章** | 通常属于一个分类路径 | 可以有多个标签 |
| **URL** | `/posts/tech/frontend/` | `/posts/?tag=CSS` |

```yaml
---
categories: ["技术", "前端"]
tags: ["CSS", "布局", "教程"]
---
```

---

## 自动识别流程

```
文章的 frontmatter 有 categories / category / 分类 字段？
  ├── 有且非空 → 使用 frontmatter 定义的分类
  └── 没有 → 从文件目录路径推断分类
              ├── 目录下有配置文件？→ 使用配置文件中的 name 作为显示名
              └── 没有配置文件 → 直接使用目录名作为显示名
```

**优先级总结：**

1. Frontmatter `categories` > Frontmatter `category` > Frontmatter `分类`
2. Frontmatter 分类 > 目录结构推断
3. 配置文件 `name` > 目录名
4. 配置文件优先级：`_category.yml` > `.category.yml` > `category.json` > `index.json` > `_category.toml` > `index.md`