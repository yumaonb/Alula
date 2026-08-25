---
title: "TypeScript 入门指南"
date: 2024-11-15
description: "从零开始学习 TypeScript，掌握类型系统的基础知识。"
image: ""
tags: ["TypeScript", "JavaScript", "教程"]
pinned: true
---

## 什么是 TypeScript

TypeScript 是 JavaScript 的超集，添加了可选的静态类型和基于类的面向对象编程。

## 为什么要用 TypeScript

- 编译时错误检查
- 更好的 IDE 支持
- 代码更易维护

## 基础类型

```typescript
let name: string = "羽毛";
let age: number = 20;
let isStudent: boolean = true;
```

## 接口

```typescript
interface User {
  name: string;
  age: number;
  email?: string;
}
```