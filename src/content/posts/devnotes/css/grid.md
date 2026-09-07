---
title: "Grid网格布局"
date: 2026-09-06
description: "本文章记录CSS Grid网格布局相关知识，包含网格结构定义、对齐方式与项目定位等，算是个快速查阅的文档，整体偏向于教学性质"
image: ""
tags: ["CSS", "编程"]
pinned: false
---

## 一、开启 Grid 容器

### 1.1 开启网格布局 display: grid

匹配规则：将容器设为网格容器，所有直接子元素自动变为网格项目（grid items），默认按列排列，每列宽度由内容撑开。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
  <div>D</div>
</div>
```

```css
.container {
    display: grid;
}
```

结果：四个子元素变成网格项目，默认排成一行四列（若容器宽度不够则自动溢出）。

### 1.2 行内网格容器 display: inline-grid

匹配规则：将容器设为行内网格容器，宽度由内容撑开，不独占一行。

```html
<span class="container">
  <span>A</span>
  <span>B</span>
</span>
```

```css
.container {
    display: inline-grid;
}
```

结果：容器宽度由内容撑开，与周围文字在同一行内显示，内部子元素按网格排列。

## 二、定义网格结构

### 2.1 划分列数及每列宽度 grid-template-columns

匹配规则：定义网格有多少列，以及每列的宽度。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
  <div>D</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: 100px 200px 100px;  /* 三列，宽度分别为 100、200、100 */
}
```

结果：三列网格，第一列 100px，第二列 200px，第三列 100px。A 在第一列，B 在第二列，C 在第三列，D 自动折到下一行（隐式行）。

### 2.2 划分行数及每行高度 grid-template-rows

匹配规则：定义网格有多少行，以及每行的高度。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
  <div>D</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: 100px 100px;
    grid-template-rows: 80px 120px;  /* 两行，高度分别为 80、120 */
}
```

结果：两行两列网格。第一行高 80px，第二行高 120px。

### 2.3 按比例分配剩余空间（fr 单位） grid-template-columns: 1fr 2fr

匹配规则：使用 fr（fraction）单位，将容器剩余空间按份数分配给各列（或各行）。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;  /* 分成 4 份，中间占 2 份 */
}
```

结果：三列网格，容器剩余空间分成 4 份，A 和 C 各占 1/4，B 占 2/4（中间列是两侧的两倍宽）。

### 2.4 固定值 + fr 混合使用 grid-template-columns: 200px 1fr

匹配规则：列宽可以混合使用固定值和 fr 单位，第一列固定，其余列瓜分剩余空间。

```html
<div class="container">
  <div>侧边栏</div>
  <div>主内容</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: 200px 1fr;  /* 左侧固定 200px，右侧占满剩余空间 */
}
```

结果：左侧栏 200px 固定，右侧主内容自动填满容器剩余宽度（典型后台布局）。

### 2.5 重复相同模式 repeat() grid-template-columns: repeat(3, 1fr)

匹配规则：使用 repeat() 函数简化重复的列宽定义。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
  <div>D</div>
  <div>E</div>
  <div>F</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);  /* 三列等宽，等价于 1fr 1fr 1fr */
}
```

结果：三列等宽，每列占 1/3 容器宽度。A、B、C 在第一行，D、E、F 在第二行。

### 2.6 按固定间距划分列 auto-fill 与 minmax() 配合实现响应式

匹配规则：使用 repeat(auto-fill, minmax(最小宽, 最大宽))，让浏览器自动决定能放下多少列，宽度不足时自动换行，实现响应式网格。

```html
<div class="container">
  <div>卡片 1</div>
  <div>卡片 2</div>
  <div>卡片 3</div>
  <div>卡片 4</div>
  <div>卡片 5</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
}
```

结果：每个卡片至少 200px 宽，容器宽了自动多放列，窄了自动减少列并换行。所有卡片等宽（1fr）。

### 2.7 命名网格区域 grid-template-areas

匹配规则：给网格区域起名字，然后用 grid-area 将子元素放入对应区域，实现可视化布局。

```html
<div class="container">
  <div class="header">头部</div>
  <div class="sidebar">侧栏</div>
  <div class="main">主内容</div>
  <div class="footer">底部</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: 200px 1fr;
    grid-template-rows: 80px 1fr 60px;
    grid-template-areas:
        "header header"
        "sidebar main"
        "footer footer";
}
.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.footer { grid-area: footer; }
```

结果：头部占一整行，侧栏（200px）和主内容（剩余空间）在第二行，底部占一整行。布局结构一目了然。

### 2.8 设置行与列之间的间距 gap

匹配规则：设置网格项目之间的行列间距，容器边缘不会产生间距。

```html
<div class="container">
  <div>A</div>
  <div>B</div>
  <div>C</div>
  <div>D</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px 10px;  /* 行间距 20px，列间距 10px */
}
```

结果：两行两列网格，项目之间横向间距 10px，纵向间距 20px，容器边缘没有间距。

## 三、父容器属性（控制整体对齐）

### 3.1 网格项目在单元格内的水平对齐 justify-items

匹配规则：控制所有网格项目在各自单元格内的水平对齐方式。默认值为 stretch（拉伸填满）。

```html
<div class="container">
  <div style="width:50px;">A</div>
  <div style="width:80px;">B</div>
  <div style="width:60px;">C</div>
  <div style="width:90px;">D</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: repeat(2, 200px);
    justify-items: center;  /* 水平居中 */
}
```

结果：每个网格项目在各自的 200px 宽单元格内水平居中，不再拉伸填满。

### 3.2 网格项目在单元格内的垂直对齐 align-items

匹配规则：控制所有网格项目在各自单元格内的垂直对齐方式。默认值为 stretch（拉伸填满）。

```html
<div class="container">
  <div style="height:40px;">A</div>
  <div style="height:70px;">B</div>
  <div style="height:50px;">C</div>
  <div style="height:80px;">D</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-rows: repeat(2, 150px);
    align-items: center;  /* 垂直居中 */
}
```

结果：每个网格项目在各自的 150px 高单元格内垂直居中，不再拉伸填满。

### 3.3 整个网格在容器内的水平对齐 justify-content

匹配规则：当网格总宽度小于容器宽度时，控制整个网格区域在容器内的水平对齐方式。

```html
<div class="container" style="width:600px;">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: 100px 100px 100px;  /* 总宽 300px，容器 600px，有剩余空间 */
    justify-content: center;  /* 整个网格水平居中 */
}
```

结果：三列网格作为一个整体在容器内水平居中，左右留白相等。

### 3.4 整个网格在容器内的垂直对齐 align-content

匹配规则：当网格总高度小于容器高度时，控制整个网格区域在容器内的垂直对齐方式。

```html
<div class="container" style="height:500px;">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: repeat(3, 100px);
    grid-template-rows: 80px;  /* 总高 80px，容器 500px，有剩余空间 */
    align-content: center;  /* 整个网格垂直居中 */
}
```

结果：网格整体在容器内垂直居中，上下留白相等。

## 四、子项目属性（控制个体行为）

### 4.1 让某个项目横跨多列 grid-column

匹配规则：控制当前项目跨越几列。格式为 grid-column: 起始列 / 结束列（结束列号+1）。

```html
<div class="container">
  <div class="span2">横跨两列</div>
  <div>B</div>
  <div>C</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
}
.span2 {
    grid-column: 1 / 3;  /* 从第 1 列开始，到第 3 列之前结束，即占第 1、2 列 */
}
```

结果：A 横跨第一列和第二列，B 在第三列，C 自动折到下一行。

### 4.2 让某个项目横跨多行 grid-row

匹配规则：控制当前项目跨越几行。格式为 grid-row: 起始行 / 结束行（结束行号+1）。

```html
<div class="container">
  <div class="span2">竖跨两行</div>
  <div>B</div>
  <div>C</div>
  <div>D</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 100px);
}
.span2 {
    grid-row: 1 / 3;  /* 从第 1 行开始，到第 3 行之前结束，即占第 1、2 行 */
}
```

结果：A 占第一行和第二行的第一列，B 在第一行第二列，C 在第二行第二列，D 自动新增一行。

### 4.3 使用命名区域定位项目 grid-area

匹配规则：将当前项目放入 grid-template-areas 定义的某个命名区域中。

```html
<div class="container">
  <div class="header">头部</div>
  <div class="main">主内容</div>
  <div class="footer">底部</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 80px 1fr 60px;
    grid-template-areas:
        "header"
        "main"
        "footer";
}
.header { grid-area: header; }
.main { grid-area: main; }
.footer { grid-area: footer; }
```

结果：三个项目分别占据上、中、下三个区域，header 高 80px，main 占满剩余空间，footer 高 60px。

### 4.4 控制单个项目的水平对齐 justify-self

匹配规则：单独覆盖父级 justify-items 的设置，控制当前项目在单元格内的水平对齐方式。

```html
<div class="container">
  <div>A</div>
  <div class="right">B（靠右）</div>
  <div>C</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: repeat(3, 200px);
    justify-items: center;  /* 父级统一水平居中 */
}
.right {
    justify-self: end;  /* B 单独改为靠右对齐 */
}
```

结果：A 和 C 在各自单元格内水平居中，B 单独靠右。

### 4.5 控制单个项目的垂直对齐 align-self

匹配规则：单独覆盖父级 align-items 的设置，控制当前项目在单元格内的垂直对齐方式。

```html
<div class="container">
  <div>A</div>
  <div class="bottom">B（贴底）</div>
  <div>C</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-rows: repeat(3, 150px);
    align-items: center;  /* 父级统一垂直居中 */
}
.bottom {
    align-self: end;  /* B 单独改为贴底对齐 */
}
```

结果：A 和 C 在各自单元格内垂直居中，B 单独贴在单元格底部。

## 五、现代增强

### 5.1 子网格继承父级网格线 subgrid

匹配规则：当子元素自身也是网格容器时，使用 subgrid 让它继承父级的列或行定义，实现嵌套网格与父级网格线对齐。

```html
<div class="parent">
  <div class="child-grid">
    <div>子项 1</div>
    <div>子项 2</div>
    <div>子项 3</div>
  </div>
  <div>父级项目 B</div>
</div>
```

```css
.parent {
    display: grid;
    grid-template-columns: 100px 1fr 100px;  /* 父级三列 */
}
.child-grid {
    display: grid;
    grid-template-columns: subgrid;  /* 继承父级的三列 */
    grid-column: 1 / 3;  /* 子网格占父级第 1 到第 3 列 */
}
```

结果：子网格内部的子项直接对齐父级的列线，不再重新计算列宽。适合表头与表体对齐的场景。

### 5.2 瀑布流/砖墙式排列 grid-template-rows: masonry

匹配规则：使用 masonry 值，让网格项目像瀑布流一样排列——项目按列填充，每列高度由内容决定，不再强制行高对齐。

```html
<div class="container">
  <div style="height:150px;">A</div>
  <div style="height:200px;">B</div>
  <div style="height:100px;">C</div>
  <div style="height:250px;">D</div>
  <div style="height:120px;">E</div>
  <div style="height:180px;">F</div>
</div>
```

```css
.container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: masonry;  /* 瀑布流模式 */
    gap: 16px;
}
```

结果：项目像 Pinterest 一样排列，每个项目高度不同，自动填充到当前最短的那一列下方，不再要求行高一致。