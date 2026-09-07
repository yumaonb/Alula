---
title: "CSS盒模型"
date: 2026-09-02
description: "本文章记录CSS盒模型相关知识，包含盒模型尺寸计算、padding、border、margin 与外边距合并等，算是个快速查阅的文档，整体偏向于教学性质"
tags: ["CSS", "编程"]
---

## 一、盒模型核心

### 1.1 控制宽高是否包含内边距和边框 box-sizing

匹配规则：决定当你给元素设置 width / height 时，这个尺寸算的是"内容区域"的尺寸，还是"内容 + 内边距 + 边框"的总尺寸。

```html
<div class="box content-box">宽高=内容区</div>
<div class="box border-box">宽高=总尺寸</div>
```

```css
.box {
    width: 200px;
    height: 100px;
    padding: 20px;
    border: 5px solid #333;
    margin-bottom: 20px;
    background: #f0f0f0;
}

.content-box {
    box-sizing: content-box;  /* 默认值：200px 只算内容 */
}

.border-box {
    box-sizing: border-box;   /* 200px = 内容 + padding + border */
}
```

结果：

· content-box（默认）：内容区宽 200px。加上左右 padding（40px）和左右边框（10px），实际总宽度变成 250px。这常常导致元素溢出容器，是新手最易踩的坑。
· border-box：内容区被压缩到 200 - 40 - 10 = 150px，实际总宽度始终是 200px。更符合直觉，因此实际开发中强烈推荐全局设置 * { box-sizing: border-box; }。

### 1.2 设置内容区域的宽高 width / height

匹配规则：直接设置盒子"内容区域"的宽度和高度（具体是否包含 padding/border，由上面的 box-sizing 决定）。

```html
<div class="box">固定宽高 200x100</div>
<div class="box-auto">宽高由内容撑开</div>
```

```css
.box {
    width: 200px;
    height: 100px;
    background: #b3d9ff;
}
.box-auto {
    width: auto;   /* 默认，块级元素撑满父容器宽度 */
    height: auto;  /* 默认，高度由内容自动撑开 */
    background: #ffe6b3;
}
```

结果：第一个盒子固定宽 200px、高 100px。第二个盒子宽度填满父容器，高度随文字内容自动增加。

### 1.3 限制最大/最小尺寸 min-width / max-width / min-height / max-height

匹配规则：给元素设置一个"弹性范围"，防止内容过多把盒子撑得太离谱，或者窗口缩小时元素变得看不见。

```html
<div class="box">内容很多时，最大宽度限制为 300px，超过则换行或溢出</div>
```

```css
.box {
    min-width: 100px;   /* 缩小时不小于 100px */
    max-width: 300px;   /* 放大时不超过 300px */
    min-height: 50px;   /* 内容少时也至少 50px 高 */
    background: #d4edda;
}
```

结果：盒子宽度在 100px 到 300px 之间自适应，高度至少 50px，内容多了再继续撑高。

## 二、内部空间与边框

### 2.1 设置内容与边框的内部间距 padding

匹配规则：在内容区域和边框之间增加透明空间。注意：padding 会撑大盒子（除非你设置了 box-sizing: border-box）。

```html
<div class="box">这个盒子有内边距，文字不会贴边</div>
<div class="box no-padding">这个盒子没内边距，文字紧贴边框</div>
```

```css
.box {
    width: 200px;
    padding: 20px 30px;  /* 上下 20px，左右 30px */
    border: 1px solid #999;
    background: #f8f9fa;
}
.no-padding {
    padding: 0;  /* 去掉内边距 */
}
```

结果：第一个盒子文字与边框之间有 20px（上下）和 30px（左右）的呼吸空间。第二个盒子文字直接贴着边框，看起来很拥挤。

```css
/* padding 的四种写法 */
padding: 20px;          /* 四边相同 */
padding: 10px 20px;     /* 上下 10，左右 20 */
padding: 10px 20px 30px;/* 上 10，左右 20，下 30 */
padding: 10px 20px 30px 40px; /* 上 10，右 20，下 30，左 40（顺时针） */
```

### 2.2 设置元素边框线 border

匹配规则：在内边距（或内容）外围画一条线。边框会占据空间，同样会撑大盒子（除非使用 border-box）。

```html
<div class="box">我有边框</div>
<div class="box no-border">我没有边框</div>
```

```css
.box {
    width: 200px;
    padding: 20px;
    border: 3px solid #007bff;  /* 宽度 3px，实线，蓝色 */
}
.no-border {
    border: none;  /* 无边框 */
}
```

结果：第一个盒子外围有一条蓝色的线包裹。第二个盒子无边框。

```css
/* 常见 border 写法 */
border: 1px solid #ccc;   /* 最常用：细实线灰色 */
border: 2px dashed red;   /* 红色虚线边框 */
border: 4px dotted green; /* 绿色点状边框 */

/* 单独控制某一边 */
border-top: 1px solid #000;
border-bottom: 2px dashed #666;
```

## 三、外部空间

### 3.1 设置元素之间的外部间距 margin

匹配规则：在当前元素外部增加透明空间，用于拉开与其他元素的距离。注意：margin 不会撑大盒子本身，但会影响盒子在页面中占用的总空间。

```html
<div class="box">我有下边距 30px，下面的元素会离我远一些</div>
<div class="box">我是紧跟着的第二个盒子</div>
```

```css
.box {
    width: 200px;
    padding: 10px;
    background: #e2eaf3;
    margin-bottom: 30px;  /* 当前盒子下方留 30px 空白 */
}
```

结果：第一个盒子和第二个盒子之间拉开了 30px 的距离。

```css
/* margin 写法与 padding 相同 */
margin: 20px;          /* 四边相同 */
margin: 10px 20px;     /* 上下 10，左右 20 */
margin: 10px 20px 30px 40px; /* 上 10，右 20，下 30，左 40（顺时针） */

/* 常用技巧：让块级元素水平居中 */
margin: 0 auto;        /* 前提：元素有固定宽度，且父容器宽度大于它 */
```

### 3.2 注意：相邻外边距合并（Margin Collapse）

匹配规则：当两个块级元素垂直相邻时，它们的外边距不会相加，而是取两者中的最大值。这是很多新手觉得"间距不对"的根本原因。

```html
<div class="box-a">下边距 30px</div>
<div class="box-b">上边距 20px</div>
<!-- 两个盒子之间的实际间距不是 30+20=50px，而是 30px（取大的那个） -->
```

```css
.box-a {
    margin-bottom: 30px;
}
.box-b {
    margin-top: 20px;
}
```

结果：两个盒子的距离不是 50px，而是 30px（两者取大）。如果你想要 50px，只需给其中一个设置 50px 即可，或使用 padding 代替部分 margin。Flex 和 Grid 容器内的子项不会有外边距合并问题，这也是它们受欢迎的原因之一。

### 3.3 让元素水平居中 margin: 0 auto

匹配规则：给块级元素设置左右外边距为 auto，浏览器会自动平分剩余空间，从而实现水平居中。

```html
<div class="parent">
  <div class="child">我在父容器中水平居中</div>
</div>
```

```css
.parent {
    width: 400px;
    background: #f0f0f0;
}
.child {
    width: 200px;
    margin: 0 auto;  /* 左右自动平分剩余空间 */
    background: #b3d9ff;
    text-align: center;
}
```

结果：子元素在父容器中水平居中，左右留白相等。这是最常用的块级居中方式。