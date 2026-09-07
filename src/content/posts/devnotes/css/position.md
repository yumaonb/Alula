---
title: "CSS定位"
date: 2026-09-03
description: "本文章记录CSS定位相关知识，包含 static、relative、absolute、fixed、sticky 与层叠顺序等，算是个快速查阅的文档，整体偏向于教学性质"
image: ""
tags: ["CSS", "编程"]
pinned: false
---

## 一、定位类型（position 属性）

### 1.1 默认文档流定位 position: static

匹配规则：元素按照正常文档流从上到下、从左到右排列，top / right / bottom / left / z-index 等定位属性完全无效。这是所有元素的默认值。

```html
<div class="box">静态定位（默认）</div>
<div class="box">我排在它下面</div>
```

```css
.box {
    position: static;  /* 默认值，其实不用写 */
    width: 200px;
    padding: 20px;
    background: #e2eaf3;
    top: 50px;  /* 写了也没用，static 下 top 无效 */
}
```

结果：两个盒子一上一下正常排列，top: 50px 被完全忽略。绝大多数元素都是这种状态，只有当你需要"特殊位置"时，才改成其他定位值。

### 1.2 相对自身偏移 position: relative

匹配规则：元素依然占据原来的位置（其他元素不会挤过来），但你可以用 top / left 等属性让它相对于自己的原始位置进行偏移。视觉上它移动了，但"物理占位"还在原地。

```html
<div class="box">正常盒子 A</div>
<div class="box offset">相对定位：向右下偏移</div>
<div class="box">正常盒子 C</div>
```

```css
.box {
    width: 200px;
    padding: 20px;
    background: #e2eaf3;
    margin-bottom: 10px;
}
.offset {
    position: relative;
    top: 20px;    /* 向下移 20px */
    left: 40px;   /* 向右移 40px */
    background: #ffd6a8;
}
```

结果：中间的盒子向右下方偏移了，但它原来占的位置依然空在那里，A 和 C 之间的空隙就是证据。relative 最常用的场景是作为绝对定位子元素的参考容器（见 2.1）。

### 1.3 相对于最近定位祖先定位 position: absolute

匹配规则：元素完全脱离文档流（不再占据空间，其他元素会挤上来），然后相对于最近的非 static 定位祖先元素进行定位。如果所有祖先都是 static，则相对于整个浏览器窗口（<html>）定位。

```html
<div class="parent">
  <div class="box absolute">我是绝对定位</div>
  <div class="box">我是正常文档流中的兄弟</div>
</div>
```

```css
.parent {
    position: relative;  /* 成为 absolute 子元素的参考物 */
    width: 400px;
    height: 200px;
    background: #f0f0f0;
    margin-bottom: 20px;
}
.absolute {
    position: absolute;
    bottom: 10px;   /* 距离父容器底部 10px */
    right: 20px;    /* 距离父容器右侧 20px */
    background: #ffb3b3;
    padding: 10px;
}
.box {
    padding: 10px;
    background: #b3d9ff;
}
```

结果：绝对定位的盒子出现在父容器的右下角（距离底部 10px，右侧 20px），它原本的位置被兄弟元素挤占（因为脱离文档流）。这是 absolute 最常见的用法："父 relative + 子 absolute"，让子元素相对于父容器进行精确定位。

### 1.4 相对于浏览器窗口固定 position: fixed

匹配规则：元素完全脱离文档流，相对于浏览器窗口（视口） 定位。页面滚动时，它纹丝不动，始终固定在屏幕的指定位置。

```html
<div class="fixed-bar">我是固定导航，滚动页面我也一直在</div>
<div style="height:2000px; background:#f5f5f5;">往下滚动看看效果</div>
```

```css
.fixed-bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    padding: 15px 20px;
    background: #333;
    color: #fff;
    z-index: 1000;  /* 确保盖在其他内容上面 */
}
```

结果：无论页面滚动到哪里，这个导航栏始终固定在屏幕顶部。常用于顶部导航、底部悬浮按钮、回到顶部按钮。

### 1.5 滚动到特定位置时吸顶 position: sticky

匹配规则：元素不脱离文档流（占位保留），但当你滚动页面，元素到达指定位置时，它会"粘"在那里不动，像吸住了一样。简单理解：relative 和 fixed 的结合体——没到位置时是 relative，到了阈值就变成 fixed。

```html
<div class="header">页面头部内容</div>
<div class="sticky-nav">我是粘性导航，滚到我时我就吸顶</div>
<div style="height:2000px; background:#f5f5f5;">滚动看看效果</div>
```

```css
.sticky-nav {
    position: sticky;
    top: 0;  /* 滚动到距离视口顶部 0px 时吸住 */
    padding: 15px 20px;
    background: #007bff;
    color: #fff;
    z-index: 100;
}
```

结果：页面滚动时，导航在到达顶部之前正常跟随页面滚动；一旦到达顶部，就固定在那里。常用于表格表头、分类导航、分段标题。

## 二、偏移与叠放

### 2.1 控制偏移位置 top / right / bottom / left

匹配规则：配合 position: relative / absolute / fixed / sticky 使用，控制元素在不同方向上的偏移距离。

```html
<div class="parent">
  <div class="child">离四边各 20px</div>
</div>
```

```css
.parent {
    position: relative;
    width: 400px;
    height: 200px;
    background: #f0f0f0;
}
.child {
    position: absolute;
    top: 20px;
    right: 20px;
    bottom: 20px;
    left: 20px;
    background: #b3d9ff;
    padding: 10px;
}
```

结果：子元素被拉伸到距离父容器四边各 20px 的位置，相当于在父容器内"缩进去"一块。不一定要同时设四个方向，可以只用 top + left 来定点。

### 2.2 控制层叠顺序 z-index

匹配规则：当多个定位元素重叠时，z-index 决定谁在上面谁在下面。数值越大越靠上，默认值为 auto（相当于 0）。只有定位元素（position 不为 static）才生效。

```html
<div class="box red">红色：z-index: 1</div>
<div class="box blue">蓝色：z-index: 3（最上层）</div>
<div class="box green">绿色：z-index: 2</div>
```

```css
.box {
    position: absolute;
    width: 150px;
    height: 100px;
    padding: 10px;
    opacity: 0.8;
}
.red {
    top: 20px;
    left: 20px;
    background: red;
    z-index: 1;
}
.blue {
    top: 60px;
    left: 60px;
    background: blue;
    z-index: 3;  /* 数值最大，在最上面 */
    color: #fff;
}
.green {
    top: 100px;
    left: 100px;
    background: green;
    z-index: 2;
    color: #fff;
}
```

结果：三个盒子叠在一起，蓝色在最上层（z-index: 3），绿色在中间（2），红色在最底层（1）。z-index 只比较同一层叠上下文中的兄弟元素，父子之间的 z-index 比较要更复杂一些，但日常用"谁的数值大谁在上面"基本够用。

## 三、经典场景

### 3.1 子元素在父容器中居中定位（父 relative + 子 absolute + transform）

匹配规则：让绝对定位的子元素在父容器中完美居中（不管父容器多大）。结合 top: 50%; left: 50%; 加上 transform: translate(-50%, -50%)。

```html
<div class="parent">
  <div class="child">我居中啦</div>
</div>
```

```css
.parent {
    position: relative;
    width: 400px;
    height: 300px;
    background: #f0f0f0;
}
.child {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #007bff;
    color: #fff;
    padding: 20px 40px;
    border-radius: 8px;
}
```

结果：子元素无论在父容器中如何变化，始终位于正中心。这是最常用的绝对定位居中技巧。

### 3.2 固定底部按钮（fixed 悬浮在右下角）

匹配规则：让一个按钮始终固定在屏幕右下角，不随页面滚动移动。

```css
.btn-fixed {
    position: fixed;
    bottom: 30px;
    right: 30px;
    padding: 15px 30px;
    background: #28a745;
    color: #fff;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    z-index: 999;
}
```

结果：按钮始终在屏幕右下角，适合做"回到顶部"或"在线客服"悬浮按钮。

### 3.3 粘性表头（sticky 让表格头吸顶）

匹配规则：表格滚动时，表头始终固定在顶部，方便查看数据对应的列名。

```html
<table>
  <thead class="sticky-header">
    <tr><th>姓名</th><th>年龄</th><th>城市</th></tr>
  </thead>
  <tbody>
    <!-- 很多行数据 -->
  </tbody>
</table>
```

```css
.sticky-header {
    position: sticky;
    top: 0;
    background: #333;
    color: #fff;
}
```

结果：滚动表格数据时，表头会在到达页面顶部后固定不动。