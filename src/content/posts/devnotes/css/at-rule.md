---
title: "CSS At-rule（@规则）"
date: 2026-09-01
description: "本文章记录CSS At-rule相关指令，算是个快速查阅的文档，整体偏向于教学性质"
image: ""
tags: ["CSS", "编程"]
pinned: false
---

> At-rule 是 CSS 中以 @ 符号开头的指令式语句，用于控制样式表行为、定义变量、引入外部资源或设置条件规则。

与普通样式规则的区别：

- 样式规则：`选择器 { 属性: 值; }` —— 直接给元素施加样式
- At-rule：`@标识符 规则内容;` 或 `@标识符 { ... }` —— 告诉 CSS 引擎“在什么条件下做什么事”

## 一、基础声明类

### 1.1 @charset —— 声明字符编码

匹配规则：指定样式表使用的字符编码，必须写在文件最最开头，且前面不得有任何字符。

```css
@charset "UTF-8";
```

结果：样式表使用 UTF-8 编码解析。如果有多个 @charset 被声明，只有第一个生效。

### 1.2 @import —— 引入外部样式表

匹配规则：将另一个 CSS 文件的内容导入当前样式表，必须写在文件顶部（@charset 之后、其他规则之前）。

```css
@import url("reset.css");
@import "theme.css";
```

结果：reset.css 和 theme.css 的内容被合并到当前样式表中。注意：每多一个 @import 就多一个 HTTP 请求，生产环境建议用构建工具合并。

### 1.3 @namespace —— 声明命名空间

匹配规则：为样式表定义默认命名空间或命名空间前缀，选择器仅在命名空间匹配时才生效。主要用于 XML/HTML 混合场景（如 SVG、MathML）。

```css
@namespace svg "http://www.w3.org/2000/svg";
svg|a { color: red; }
```

结果：只有 SVG 命名空间下的 `<a>` 元素变红。

## 二、条件组规则

### 2.1 @media —— 媒体查询

匹配规则：根据设备特征（视口宽度、屏幕类型等）条件性地应用样式，做响应式的核心工具。

```css
@media (max-width: 768px) {
  .container { flex-direction: column; }
}

@media print {
  .nav { display: none; }
}
```

结果：视口宽度 ≤ 768px 时容器变为纵向排列；打印时导航栏自动隐藏。

### 2.2 @supports —— 特性检测

匹配规则：检测浏览器是否支持某个 CSS 特性，支持时才应用内部样式。

```css
@supports (display: grid) {
  .container { display: grid; }
}
@supports not (display: grid) {
  .container { display: flex; }
}
```

结果：支持 Grid 的浏览器用 Grid 布局，不支持的用 Flex 降级。

### 2.3 @container —— 容器查询

匹配规则：根据父容器的尺寸（而非视口）条件性地应用样式。首先需要在容器元素上声明 container-type 属性。

```css
.post {
  container-type: inline-size;
}

.card h2 { font-size: 1em; }

@container (width > 700px) {
  .card h2 { font-size: 2em; }
}
```

结果：当 .post 容器宽度大于 700px 时，卡片标题字体放大为 2em。

## 三、资源与定义类

### 3.1 @font-face —— 自定义字体

匹配规则：定义服务器上的字体文件位置及样式特征，让页面可以使用非系统默认字体。

```css
@font-face {
  font-family: "MyFont";
  src: url("myfont.woff2") format("woff2");
  font-weight: 400;
}
body { font-family: "MyFont", sans-serif; }
```

结果：页面文字使用 myfont.woff2 渲染。

### 3.2 @keyframes —— 定义动画关键帧

匹配规则：定义一个动画序列，配合 animation 属性使用。

```css
@keyframes slide-in {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
.box { animation: slide-in 0.5s ease; }
```

结果：.box 元素从左侧滑入，持续 0.5 秒。

### 3.3 @property —— 注册自定义属性

匹配规则：显式注册一个 CSS 自定义属性（变量），指定其类型、初始值和继承行为，属于 CSS Houdini API 的一部分。

```css
@property --my-color {
  syntax: "<color>";
  inherits: false;
  initial-value: #c0ffee;
}
.box { color: var(--my-color); }
```

结果：--my-color 被注册为只接受 `<color>` 类型值的变量，默认值为 #c0ffee。

## 四、打印与分页

### 4.1 @page —— 打印页面样式

匹配规则：修改打印或导出为 PDF 时的页面布局，包括尺寸、方向和边距。

```css
@page {
  size: A4 landscape;
  margin: 2.54cm;
}

@page :first {
  margin-top: 3cm;
}

@page :right {
  margin-left: 4cm;
}
```

结果：打印时页面为 A4 横向，首页顶部边距 3cm，右侧页左边距 4cm。

## 五、级联与作用域管理

### 5.1 @layer —— 样式层级管理

匹配规则：将样式分配到指定的“层”中，控制不同层之间的优先级顺序。后声明的层优先级更高，且层之间的优先级高于选择器权重。

```css
/* 先声明层的顺序（越靠后优先级越高） */
@layer reset, theme, components;

@layer reset {
  * { margin: 0; }
}
@layer theme {
  .btn { background: blue; }
}
@layer components {
  .btn { background: red; }  /* 覆盖 theme 层的蓝色 */
}
```

结果：按钮背景为红色（components 层优先级高于 theme 层），无需 !important。未定义在层中的样式优先级最高。

### 5.2 @scope —— 样式作用域

匹配规则：将样式限制在指定的 DOM 子树内，防止样式泄漏到全局，同时避免写过于具体的选择器。

```css
@scope (.card) {
  /* 只作用于 .card 内部的 .title */
  .title { font-size: 1.5rem; }
}

@scope (.article-body) to (figure) {
  /* 从 .article-body 开始，到 figure 之前停止 */
  img { border: 5px solid black; }
}
```

结果：第一个例子中只有 .card 内部的 .title 生效；第二个例子中只有 .article-body 内、figure 之前的 img 生效。

## 六、计数器样式

### 6.1 @counter-style —— 自定义计数器

匹配规则：定义自定义列表计数器样式，扩展预定义的列表样式。

```css
@counter-style thumbs {
  system: cyclic;
  symbols: "\1F44D";
  suffix: " ";
}

ul { list-style-type: thumbs; }
```

结果：列表项标记变为 👍 图标。