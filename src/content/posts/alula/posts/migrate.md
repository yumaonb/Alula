---
title: "从其他博客迁移文章"
date: 2024-12-15
description: "从 Hexo、Hugo、Fuwari 等主流 Markdown 博客平台迁移到本博客的完整指南。"
image: ""
tags: ["博客", "教程", "迁移"]
pinned: false
---

## 快速迁移

不介意 URL 变动的话，只需三步：

1. 把所有 `.md` 文件复制到 `src/content/posts/`
2. 确保每篇有 `title` 和 `date` 字段
3. [非必要]添加 `categories` 字段（格式见[分类系统](/posts/yuswift/posts/categories/)）

文章会自动出现在 `/posts/` 路径下。

## 分类配置

不同平台的分类 URL 格式不同，通过 `src/data/posts.ts` 的 `categoryBase` 配置。详见[分类系统](/posts/yuswift/posts/categories/)。

## 各平台迁移指南

### Hexo

**文章位置：** `source/_posts/`

**迁移步骤：**

1. 将 `source/_posts/` 下所有 `.md` 文件复制到 `src/content/posts/`
2. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "" },
```

**Frontmatter 兼容性：**

| 字段 | Hexo 格式 | 本博客兼容 | 说明 |
|---|---|---|---|
| `title` | ✓ | ✓ | 直接使用 |
| `date` | ✓ | ✓ | 直接使用 |
| `tags` | ✓ | ✓ | 直接使用 |
| `categories` | ✓ | ✓ | 支持嵌套数组和字符串数组 |
| `description` | ✓ | ✓ | 直接使用 |
| `cover` / `thumbnail` | ✓ | ✗ | 需改为 `image` |
| `toc` | ✓ | ✗ | 不支持，使用自动生成 TOC |
| `top` / `sticky` | ✓ | ✗ | 需改为 `pinned: true` |
| `password` | ✓ | ✗ | 不支持文章加密 |

**已知问题：**

- Hexo 的「置顶」字段名是 `top` 或 `sticky`，需手动改为 `pinned: true`
- Hexo 的「密码保护」不支持
- Hexo 插件生成的内容（如 `hexo-generator-category`）不适用，分类由 frontmatter 或目录结构控制

**迁移示例：**

原 Hexo 文章：

```yaml
---
title: "Vue 3 入门指南"
date: 2024-01-15
tags: ["Vue", "JavaScript"]
categories:
  - 技术
  - 前端
top: true
cover: "/images/vue3.png"
---
```

迁移后：

```yaml
---
title: "Vue 3 入门指南"
date: 2024-01-15
tags: ["Vue", "JavaScript"]
categories:
  - 技术
  - 前端
pinned: true
image: "/images/vue3.png"
---
```

---

### Hugo

**文章位置：** `content/posts/` 或 `content/` 下的其他目录

**迁移步骤：**

1. 将 Hugo 的 content 目录下的 `.md` 文件复制到 `src/content/posts/`
2. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "categories" },
```

**Frontmatter 兼容性：**

| 字段 | Hugo 格式 | 本博客兼容 | 说明 |
|---|---|---|---|
| `title` | ✓ | ✓ | 直接使用 |
| `date` | ✓ | ✓ | 直接使用 |
| `tags` | ✓ | ✓ | 直接使用 |
| `categories` | ✓ | ✓ | 支持字符串数组 |
| `description` | ✓ | ✓ | 直接使用 |
| `draft` | ✓ | ✗ | Hugo 草稿不发布，迁移后需删除或设为 `false` |
| `weight` | ✓ | ✗ | 不支持排序权重，改用 `pinned` |
| `summary` | ✓ | ✗ | 使用 `description` 代替 |
| `params` | ✓ | ✗ | Hugo 自定义参数不适用 |

**已知问题：**

- Hugo 的 `draft: true` 文章不会发布，迁移后需手动处理
- Hugo 的分类 taxonomy 配置（`[taxonomies]`）不适用
- Hugo 的 `_index.md` 文件（章节文件）不适用，分类改为 frontmatter

**迁移示例：**

原 Hugo 文章：

```yaml
---
title: "Go 语言入门"
date: 2024-03-10
tags: ["Go", "后端"]
categories: ["编程", "Go"]
summary: "Go 语言基础教程"
weight: 10
---
```

迁移后：

```yaml
---
title: "Go 语言入门"
date: 2024-03-10
tags: ["Go", "后端"]
categories: ["编程", "Go"]
description: "Go 语言基础教程"
pinned: true
---
```

---

### Jekyll

**文章位置：** `_posts/`

**迁移步骤：**

1. 将 `_posts/` 下所有 `.md` 文件复制到 `src/content/posts/`
2. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "" },
```

**Frontmatter 兼容性：**

| 字段 | Jekyll 格式 | 本博客兼容 | 说明 |
|---|---|---|---|
| `title` | ✓ | ✓ | 直接使用 |
| `date` | ✓ | ✓ | 直接使用 |
| `tags` | ✓ | ✓ | 直接使用 |
| `categories` | ✓ | ✓ | 支持字符串数组 |
| `description` | ✓ | ✓ | 直接使用 |
| `layout` | ✓ | ✗ | Jekyll 布局不适用 |
| `permalink` | ✓ | ✗ | 不支持自定义永久链接 |
| `published` | ✓ | ✗ | 设为 `false` 的文章不迁移 |

**已知问题：**

- Jekyll 的分类嵌入文章 URL（如 `/编程/2024/01/01/hello.html`）**无法保留**，迁移后 URL 格式会变
- Jekyll 的 `layout` 字段不适用
- Jekyll 的 `permalink` 自定义不支持
- Jekyll 的 Liquid 模板语法在 Markdown 中不渲染

---

### WordPress（需 Markdown 导出）

**前提：** 需要将 WordPress 文章导出为 Markdown 格式（使用插件如 Jekyll Exporter 或 WP import/export）。

**迁移步骤：**

1. 使用导出插件将文章转为 `.md` 文件
2. 将导出的 `.md` 文件复制到 `src/content/posts/`
3. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "category" },
```

**已知问题：**

- WordPress 的富文本内容（Gutenberg 块）转 Markdown 可能丢失格式
- WordPress 的分类/标签 slug 与名称可能不同，需手动核对
- WordPress 的评论、点赞数等动态数据不迁移
- WordPress 的媒体文件（图片等）需手动迁移并更新路径

---

### Typecho

**迁移步骤：**

1. 从 Typecho 后台导出文章为 Markdown（需插件支持）
2. 将 `.md` 文件复制到 `src/content/posts/`
3. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "category" },
```

**已知问题：**

- Typecho 默认不支持 Markdown 导出，需安装导出插件
- Typecho 的分类 URL 格式与 WordPress 类似，`categoryBase` 设为 `"category"`
- Typecho 的模板标签不适用

---

### VuePress / VitePress

**文章位置：** `docs/` 或自定义目录

**迁移步骤：**

1. 将 Markdown 文件复制到 `src/content/posts/`
2. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "categories" },
```

**Frontmatter 兼容性：**

| 字段 | VuePress/VitePress 格式 | 本博客兼容 | 说明 |
|---|---|---|---|
| `title` | ✓ | ✓ | 直接使用 |
| `date` | ✓ | ✓ | 直接使用 |
| `tags` | ✓ | ✓ | 直接使用 |
| `categories` | ✓ | ✓ | 支持字符串数组 |
| `description` | ✓ | ✓ | 直接使用 |
| `sidebar` | ✓ | ✗ | 文档侧边栏不适用 |
| `prev` / `next` | ✓ | ✗ | 不支持手动指定上下篇 |

**已知问题：**

- VuePress/VitePress 的 sidebar 配置不适用
- VuePress 的文件路径即 URL 的规则不适用，迁移后 URL 会变
- VitePress 的 `layout: "page"` 等布局选项不适用

---

### Docusaurus

**文章位置：** `docs/` 或 `blog/`

**迁移步骤：**

1. 将 Markdown 文件复制到 `src/content/posts/`
2. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "category" },
```

**Frontmatter 兼容性：**

| 字段 | Docusaurus 格式 | 本博客兼容 | 说明 |
|---|---|---|---|
| `title` | ✓ | ✓ | 直接使用 |
| `date` | ✓ | ✓ | 直接使用 |
| `tags` | ✓ | ✓ | 直接使用 |
| `sidebar_label` | ✓ | ✗ | 不适用 |
| `sidebar_position` | ✓ | ✗ | 不支持排序 |
| `slug` | ✓ | ✗ | 不支持自定义 slug |

**已知问题：**

- Docusaurus 的 `slug` 自定义不支持
- Docusaurus 的侧边栏配置不适用
- Docusaurus 的 MDX 语法（JSX 组件）不渲染

---

### Fuwari（Astro 博客主题）

**文章位置：** `src/content/posts/`（与本博客相同）

**迁移步骤：**

1. Fuwari 基于 Astro，文章已在 `src/content/posts/` 下，直接使用
2. 如需调整分类 URL，修改 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "" },
```

**Frontmatter 兼容性：**

| 字段 | Fuwari 格式 | 本博客兼容 | 说明 |
|---|---|---|---|
| `title` | ✓ | ✓ | 直接使用 |
| `date` | ✓ | ✓ | 直接使用 |
| `tags` | ✓ | ✓ | 直接使用 |
| `categories` | ✓ | ✓ | 支持字符串数组和对象数组 |
| `description` | ✓ | ✓ | 直接使用 |
| `image` | ✓ | ✓ | 直接使用 |
| `published` | ✓ | ✗ | 不支持，需删除或忽略 |
| `order` | ✓ | ✗ | 不支持排序权重，改用 `pinned` |

**已知问题：**

- Fuwari 的分类页面使用查询参数格式（`/archive/?category=xxx`），本博客使用层级路径（`/posts/xxx/`），**分类 URL 会变**
- Fuwari 的 `published: false` 文章不发布，迁移后需手动删除或忽略
- Fuwari 的 `order` 排序不支持，改用 `pinned: true` 置顶
- Fuwari 的 Astro 组件语法（`.astro` 文件中的组件）不适用

**迁移示例：**

原 Fuwari 文章：

```yaml
---
title: "Hexo 迁移到 Fuwari"
date: 2024-06-01
tags: ["Hexo", "Fuwari"]
categories: ["技术", "博客"]
published: true
order: 5
---
```

迁移后：

```yaml
---
title: "Hexo 迁移到 Fuwari"
date: 2024-06-01
tags: ["Hexo", "Fuwari"]
categories: ["技术", "博客"]
pinned: false
---
```

---

### Eleventy (11ty)

**文章位置：** `_posts/` 或自定义目录

**迁移步骤：**

1. 将 Markdown 文件复制到 `src/content/posts/`
2. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "" },
```

**已知问题：**

- Eleventy 的 Nunjucks/Liquid 模板语法不渲染
- Eleventy 的数据文件（`_data/`）不适用
- Eleventy 的自定义集合不适用

---

### Gatsby（gatsby-plugin-mdx）

**前提：** Gatsby 使用 MDX 插件，文章可能是 `.mdx` 格式。

**迁移步骤：**

1. 将 `.mdx` 文件重命名为 `.md`（去除 JSX 语法）
2. 复制到 `src/content/posts/`
3. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "" },
```

**已知问题：**

- Gatsby 的 MDX 组件（JSX）不渲染，需转为纯 Markdown
- Gatsby 的 GraphQL 查询不适用
- Gatsby 的图片优化（`gatsby-plugin-image`）不适用

---

### Sapper / SvelteKit

**文章位置：** `src/routes/blog/` 或自定义目录

**迁移步骤：**

1. 将 Markdown 文件复制到 `src/content/posts/`
2. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "" },
```

**已知问题：**

- Svelte 组件语法不渲染
- SvelteKit 的 load 函数不适用

---

### Pelican

**文章位置：** `content/` 或 `content/articles/`

**迁移步骤：**

1. 将 Markdown 文件复制到 `src/content/posts/`
2. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "" },
```

**已知问题：**

- Pelican 的 `CATEGORY_SAVE_AS` 等配置不适用
- Pelican 的 reStructuredText 格式不支持（仅支持 Markdown）

---

### Nikola

**文章位置：** `posts/`

**迁移步骤：**

1. 将 `posts/` 下的 `.md` 文件复制到 `src/content/posts/`
2. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "" },
```

**已知问题：**

- Nikola 的 Meta 语法（`.. meta::`）不渲染
- Nikola 的诗歌格式（PSV）不支持

---

### Lume（Deno 静态站点生成器）

**文章位置：** `src/` 或自定义目录

**迁移步骤：**

1. 将 Markdown 文件复制到 `src/content/posts/`
2. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "" },
```

**已知问题：**

- Lume 的 Ventana 模板语法不渲染
- Lume 的 URL 生成规则不适用

---

### Sober（Typecho 主题框架）

**迁移步骤：**

1. 从 Typecho 数据库导出文章
2. 转为 Markdown 格式后复制到 `src/content/posts/`
3. 配置 `src/data/posts.ts`：

```typescript
contentRoot: "content/posts",
category: { categoryBase: "" },
```

**已知问题：**

- Sober 的对象数组分类格式（`{name, parent}`）已支持
- Sober 的 Blade 模板语法不适用

## 通用注意事项

### 所有平台都会遇到的问题

1. **URL 格式变化** — 除非原平台的 URL 格式与本博客完全一致，否则迁移后 URL 会变
2. **图片路径** — 如果图片使用相对路径且文件位置变了，需要更新路径
3. **代码高亮** — 本博客使用 Shiki 做代码高亮，支持主流语言（JavaScript、TypeScript、Python、Go、Rust 等）。如果原平台使用 Prism.js 或 highlight.js，高亮主题和行号样式会不同
4. **HTML 标签** — Markdown 中的 `<img>`、`<a>`、`<details>` 等常见标签可正常使用，但 `<iframe>`、`<video>` 等可能被安全策略过滤
5. **数学公式** — 本博客支持 KaTeX 渲染（通过 remark-math + rehype-katex），但需要在 frontmatter 或配置中启用。如果原平台使用 MathJax，公式语法可能需要微调

### 迁移后检查清单

- [ ] 所有文章的 `title` 和 `date` 字段正确
- [ ] 分类（`categories`）字段格式正确
- [ ] 图片路径可访问
- [ ] 代码块语法正确
- [ ] 链接指向正确
- [ ] 标签（`tags`）格式正确