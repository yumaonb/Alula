---
title: "CSS Grid 布局完全指南"
date: 2024-11-20
description: "深入理解 CSS Grid 布局，从基础到高级用法。"
image: ""
tags: ["CSS", "前端", "布局"]
pinned: false
---

## Grid 基础

CSS Grid 是一个二维布局系统，可以同时处理行和列。

## 定义网格

```css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
```

## 网格项 placement

```css
.item {
  grid-column: 1 / 3;
  grid-row: 1 / 2;
}
```

## 响应式网格

```css
.container {
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}
```