---
title: "Flex弹性布局"
date: 2026-09-05
description: "本文章记录Flex弹性布局相关知识，包含容器属性与子项属性等，算是个快速查阅的文档，整体偏向于教学性质"
tags: ["CSS", "编程"]
---

## 一、开启 Flex 容器

### 1.1 开启弹性布局 display: flex

匹配规则：将容器设为弹性容器，所有直接子元素自动变成弹性项目（flex items），默认水平排列。

```html
<div class="container">
  <div>项目 1</div>
  <div>项目 2</div>
  <div>项目 3</div>
</div>
```

```css
.container {
    display: flex;
}
```

结果：三个子元素水平排列在一行，高度自动拉伸对齐。

### 1.2 行内弹性容器 display: inline-flex

匹配规则：将容器设为行内弹性容器，宽度由内容撑开，不独占一行，子元素同样变为弹性项目。

```html
<span class="container">
  <span>项目 A</span>
  <span>项目 B</span>
</span>
```

```css
.container {
    display: inline-flex;
}
```

结果：容器宽度由内容撑开，与周围文字在同一行内显示，内部子元素水平排列。

## 二、父容器属性（控制整体排列）

### 2.1 水平从左到右排列 flex-direction: row

匹配规则：子元素沿主轴水平排列，方向为从左到右。这是默认值。

```html
<div class="container">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>
```

```css
.container {
    display: flex;
    flex-direction: row;
}
```

结果：1、2、3 从左到右水平排列。

### 2.2 水平从右到左排列 flex-direction: row-reverse

匹配规则：子元素沿主轴水平排列，方向为从右到左。

```html
<div class="container">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>
```

```css
.container {
    display: flex;
    flex-direction: row-reverse;
}
```

结果：3、2、1 从右到左水平排列（视觉顺序反转）。

### 2.3 垂直从上到下排列 flex-direction: column

匹配规则：子元素沿主轴垂直排列，方向为从上到下。

```html
<div class="container">
  <div>顶部</div>
  <div>中间</div>
  <div>底部</div>
</div>
```

```css
.container {
    display: flex;
    flex-direction: column;
}
```

结果：顶部、中间、底部从上到下垂直排列。

### 2.4 垂直从下到上排列 flex-direction: column-reverse

匹配规则：子元素沿主轴垂直排列，方向为从下到上。

```html
<div class="container">
  <div>顶部</div>
  <div>中间</div>
  <div>底部</div>
</div>
```

```css
.container {
    display: flex;
    flex-direction: column-reverse;
}
```

结果：底部、中间、顶部从下到上垂直排列（视觉顺序反转）。

### 2.5 子项靠左（起点）对齐 justify-content: flex-start

匹配规则：子元素在主轴起点对齐，剩余空间留在终点方向。这是默认值。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: flex;
    justify-content: flex-start;
}
```

结果：A、B、C 紧贴在容器左侧（起点），右侧留白。

### 2.6 子项靠右（终点）对齐 justify-content: flex-end

匹配规则：子元素在主轴终点对齐，剩余空间留在起点方向。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: flex;
    justify-content: flex-end;
}
```

结果：A、B、C 紧贴在容器右侧（终点），左侧留白。

### 2.7 子项整体居中 justify-content: center

匹配规则：子元素在主轴方向居中对齐，剩余空间在两侧均分。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: flex;
    justify-content: center;
}
```

结果：A、B、C 整体居中，左右留白相等。

### 2.8 子项两端对齐，中间等距 justify-content: space-between

匹配规则：第一个子元素贴起点，最后一个贴终点，其余子元素之间间距相等。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: flex;
    justify-content: space-between;
}
```

结果：A 贴左，C 贴右，B 在正中间，A-B 和 B-C 间距相等。

### 2.9 子项两侧间距相等 justify-content: space-around

匹配规则：每个子元素两侧的间距相等，边缘间距是中间间距的一半。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: flex;
    justify-content: space-around;
}
```

结果：A 和 B 之间、B 和 C 之间间距相等，A 左侧和 C 右侧的间距是中间的一半。

### 2.10 所有间距完全相等 justify-content: space-evenly

匹配规则：所有子元素之间的间距以及边缘间距完全相等。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: flex;
    justify-content: space-evenly;
}
```

结果：A 左侧、A-B 之间、B-C 之间、C 右侧四个间距完全相等。

### 2.11 子项拉伸填满容器高度 align-items: stretch

匹配规则：子元素在交叉轴方向拉伸填满容器高度（或宽度）。这是默认值。

```html
<div class="container" style="height:200px;">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: flex;
    align-items: stretch;
}
```

结果：A、B、C 的高度都被拉伸到 200px，填满容器。

### 2.12 子项顶部对齐 align-items: flex-start

匹配规则：子元素在交叉轴起点对齐（水平排列时就是顶部对齐）。

```html
<div class="container" style="height:200px;">
  <div style="height:60px;">A</div>
  <div style="height:100px;">B</div>
  <div style="height:80px;">C</div>
</div>
```

```css
.container {
    display: flex;
    align-items: flex-start;
}
```

结果：A、B、C 的顶部对齐在容器顶部，底部参差不齐。

### 2.13 子项底部对齐 align-items: flex-end

匹配规则：子元素在交叉轴终点对齐（水平排列时就是底部对齐）。

```html
<div class="container" style="height:200px;">
  <div style="height:60px;">A</div>
  <div style="height:100px;">B</div>
  <div style="height:80px;">C</div>
</div>
```

```css
.container {
    display: flex;
    align-items: flex-end;
}
```

结果：A、B、C 的底部对齐在容器底部，顶部参差不齐。

### 2.14 子项垂直居中 align-items: center

匹配规则：子元素在交叉轴方向居中对齐（水平排列时就是垂直居中）。

```html
<div class="container" style="height:200px;">
  <div style="height:60px;">A</div>
  <div style="height:100px;">B</div>
  <div style="height:80px;">C</div>
</div>
```

```css
.container {
    display: flex;
    align-items: center;
}
```

结果：A、B、C 在容器垂直方向居中对齐，顶部和底部的留白相等。

### 2.15 子项文字基线对齐 align-items: baseline

匹配规则：子元素按第一行文字的基线对齐，让不同字号文字视觉上整齐。

```html
<div class="container" style="height:200px;">
  <div style="font-size:30px;">A</div>
  <div style="font-size:16px;">B</div>
  <div style="font-size:24px;">C</div>
</div>
```

```css
.container {
    display: flex;
    align-items: baseline;
}
```

结果：A、B、C 的文字底部（基线）对齐在同一水平线上，不同字号的文字看起来整齐排列。

### 2.16 不换行，子项被压缩 flex-wrap: nowrap

匹配规则：子元素不换行，总宽度超过容器时自动压缩子元素。这是默认值。

```html
<div class="container" style="width:300px;">
  <div style="width:120px;">A</div>
  <div style="width:120px;">B</div>
  <div style="width:120px;">C</div>
</div>
```

```css
.container {
    display: flex;
    flex-wrap: nowrap;
}
```

结果：三个 120px 的项目挤在 300px 容器内，每个被压缩到约 100px。

### 2.17 换行，放不下折到下一行 flex-wrap: wrap

匹配规则：子元素总宽度超过容器时换行，放不下的折到下一行。

```html
<div class="container" style="width:300px;">
  <div style="width:120px;">A</div>
  <div style="width:120px;">B</div>
  <div style="width:120px;">C</div>
</div>
```

```css
.container {
    display: flex;
    flex-wrap: wrap;
}
```

结果：A 和 B 在第一行（各 120px），C 在第二行（120px），行首留有 60px 空隙。

### 2.18 换行，但行的顺序颠倒 flex-wrap: wrap-reverse

匹配规则：子元素换行，但行的顺序反转，第一行出现在最下面。

```html
<div class="container" style="width:300px;">
  <div style="width:120px;">A</div>
  <div style="width:120px;">B</div>
  <div style="width:120px;">C</div>
</div>
```

```css
.container {
    display: flex;
    flex-wrap: wrap-reverse;
}
```

结果：A 和 B 在第二行（下方），C 在第一行（上方）。

### 2.19 多行拉伸填满容器 align-content: stretch

匹配规则：当有多行时，行在交叉轴方向拉伸填满容器。这是默认值。

```html
<div class="container" style="width:300px; height:300px; flex-wrap:wrap;">
  <div style="width:120px;">A</div>
  <div style="width:120px;">B</div>
  <div style="width:120px;">C</div>
  <div style="width:120px;">D</div>
</div>
```

```css
.container {
    display: flex;
    flex-wrap: wrap;
    align-content: stretch;
}
```

结果：两行均匀拉伸，填满 300px 高度，各行高度自动分配。

### 2.20 多行整体如何对齐 align-content

匹配规则：当有多行时，控制行组在交叉轴方向的对齐方式，可选值与 justify-content 相同（flex-start、flex-end、center、space-between、space-around、space-evenly），默认值为 stretch。

```html
<div class="container" style="width:300px; height:300px; flex-wrap:wrap;">
  <div style="width:120px;">A</div>
  <div style="width:120px;">B</div>
  <div style="width:120px;">C</div>
  <div style="width:120px;">D</div>
</div>
```

```css
.container {
    display: flex;
    flex-wrap: wrap;
    align-content: center;
}
```

结果：两行作为一个整体在容器垂直方向居中。

### 2.21 设置子项之间的间距 gap

匹配规则：设置子元素之间的行列间距，容器边缘不会产生间距。

```html
<div class="container" style="width:320px; flex-wrap:wrap;">
  <div style="width:100px;">A</div>
  <div style="width:100px;">B</div>
  <div style="width:100px;">C</div>
</div>
```

```css
.container {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 10px;  /* 行间距 20px，列间距 10px */
}
```

结果：子元素之间横向间距 10px，纵向间距 20px，容器边缘没有间距。

### 2.22 方向+换行合并写法 flex-flow

匹配规则：flex-direction 和 flex-wrap 的简写属性。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: flex;
    flex-flow: row wrap;  /* 水平排列 + 允许换行 */
}
```

结果：等价于 flex-direction: row; flex-wrap: wrap;。

## 三、子项目属性（控制个体行为）

### 3.1 让子项平分或按份数分配多余宽度 flex-grow

匹配规则：容器有多余空间时，子项目按比例分配剩余空间。默认值为 0（不放大）。

```html
<div class="container" style="width:500px;">
  <div style="flex-grow:1;">A</div>
  <div style="flex-grow:2;">B</div>
  <div style="flex-grow:1;">C</div>
</div>
```

```css
.container {
    display: flex;
}
```

结果：总剩余空间分成 4 份（1+2+1），A 分 1 份，B 分 2 份，C 分 1 份。B 的宽度是 A 和 C 的两倍。

### 3.2 容器变窄时子项按比例收窄 flex-shrink

匹配规则：容器空间不足时，子项目按比例缩小。默认值为 1（允许缩小）。

```html
<div class="container" style="width:300px;">
  <div style="width:150px; flex-shrink:1;">A</div>
  <div style="width:150px; flex-shrink:3;">B</div>
</div>
```

```css
.container {
    display: flex;
}
```

结果：总宽度 300px，两个项目各 150px，原本刚好。若容器缩到 200px，B（shrink:3）缩得比 A（shrink:1）更多。

### 3.3 设置子项的基础宽度（放大前的底子） flex-basis

匹配规则：在分配剩余空间之前，子项目占据的基础尺寸。默认值为 auto（即自身的 width/height）。

```html
<div class="container" style="width:500px;">
  <div style="flex-basis:100px; flex-grow:1;">A</div>
  <div style="flex-basis:200px; flex-grow:1;">B</div>
</div>
```

```css
.container {
    display: flex;
}
```

结果：A 先占 100px，B 先占 200px，剩余 200px 两人平分，最终 A = 200px，B = 300px。

### 3.4 放大/缩小/基础宽度三合一 flex

匹配规则：flex-grow、flex-shrink、flex-basis 的简写。默认值为 0 1 auto。

```html
<div class="container" style="width:600px;">
  <div style="flex:1;">A</div>
  <div style="flex:2;">B</div>
  <div style="flex:1;">C</div>
</div>
```

```css
.container {
    display: flex;
}
```

结果：空间分成 4 份，A 占 1/4，B 占 2/4，C 占 1/4。

flex: 1 等价于 flex-grow: 1; flex-shrink: 1; flex-basis: 0%;
flex: none 等价于 0 0 auto（不放大也不缩小，宽度由内容决定）;
flex: auto 等价于 1 1 auto（先按内容大小，再分配剩余空间）。

### 3.5 让某个子项单独不听父级对齐命令 align-self

匹配规则：单独覆盖父容器 align-items 的设置，控制当前项目在交叉轴上的对齐方式。默认值为 auto（继承父级）。

```html
<div class="container" style="height:200px; align-items:center;">
  <div>A</div>
  <div style="align-self:flex-end;">B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: flex;
    align-items: center;  /* 父级统一垂直居中 */
}
```

结果：A 和 C 垂直居中，B 单独贴在底部。

### 3.6 不改变HTML顺序，仅调整显示顺序 order

匹配规则：控制子项目的视觉排列顺序。默认值为 0，数值越小越靠前。

```html
<div class="container">
  <div style="order:2;">A</div>
  <div style="order:0;">B</div>
  <div style="order:1;">C</div>
</div>
```

```css
.container {
    display: flex;
}
```

结果：视觉顺序为 B（order:0）、C（order:1）、A（order:2），DOM 顺序不变。