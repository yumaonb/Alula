---
title: "分类系统"
date: 2026-08-31
description: "本博客的分类由文章所在的目录结构决定；目录下的 index.json 可配置分类显示名与描述。"
tags: ["博客", "教程", "配置"]
---

## 概述

本博客的分类**只由目录结构决定**：把文章放进 `src/content/posts/` 下某个目录，该目录路径就是文章的分类，无需在 frontmatter 里写任何分类字段。不识别其他博客的 `categories` / `category` 等字段。

## 目录结构分类

将文章放入对应目录，目录路径即分类路径，分类页与文章 URL 都与目录一一对应：

```
src/content/posts/
├── tech/
│   ├── frontend/
│   │   ├── css-grid.md   → 分类 tech/frontend，URL /posts/tech/frontend/css-grid/
│   │   └── ...
│   └── typescript.md     → 分类 tech，URL /posts/tech/typescript/
└── life/
    └── travel.md         → 分类 life，URL /posts/life/travel/
```

规则：

- 文章所在目录相对 `src/content/posts/` 的路径就是它的分类，侧栏分类树按目录自动生成、递归展开
- 分类可嵌套任意层级，每个中间目录都是可访问的分类页
- 直接放在 `src/content/posts/` 根目录下的文章**没有分类**
- 分类页 URL 与文章页共用 `/posts/` 前缀：`/posts/{分类路径}/`

## 分类显示名

目录名默认就是分类显示名；想自定义显示名或补上描述，在该目录下放一个 `index.json` 即可，`name` 会覆盖目录名作为显示名：

```
src/content/posts/devnotes/
├── index.json      ← devnotes 分类的配置
├── css/
│   ├── index.json  ← devnotes/css 分类的配置
│   ├── at-rule.md
│   └── selector.md
```

**`devnotes/index.json`（当前真实内容）：**

```json
{
  "name": "开发速查",
  "description": "本分类是专门给我自己做的，方便开发时查文档，本分类下的文档偏向于教学性质，感兴趣的也可以看看"
}
```

而 `devnotes/css/index.json` 把 `name` 配成了 `"CSS"`，所以该分类在侧栏与分类页显示为 **CSS** 而非目录名 `css`。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | 否 | 分类显示名；不写则用目录名 |
| `description` | `string` | 否 | 分类描述 |

> `index.json` 只是目录配置，不会当作文章发布；同一目录下可以既有配置又有文章。

## 标签与分类的区别

| | 分类 | 标签 |
|---|---|---|
| **组织方式** | 目录结构（树形） | 扁平结构（横向关联） |
| **定义位置** | 文章所在目录 | frontmatter `tags` |
| **一篇文章** | 属于所在目录的单一分类路径 | 可以有多个标签 |
| **URL** | `/posts/tech/frontend/` | `/posts/tag/CSS/` |

```yaml
---
tags: ["CSS", "布局", "教程"]
---
```

## 从其他平台导入文章

本主题不解析任何其他博客的分类字段，从其他平台导入时先把文件整理成上面的目录结构即可（后续会提供迁移工具辅助整理）。
