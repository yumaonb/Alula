---
title: "CSS文本与字体排版"
date: 2026-09-04
description: "本文章记录CSS字体样式与文本排版相关知识，包含字体、字号、行高、对齐与省略号等，算是个快速查阅的文档，整体偏向于教学性质"
tags: ["CSS", "编程"]
---

## 一、字体样式（控制文字本身的样子）

### 1.1 设置字体族 font-family

匹配规则：决定文字使用什么字体。可以指定多个字体作为备选（用逗号隔开），浏览器从左到右依次尝试，直到找到系统里存在的那个。中文字体必须加引号，英文字体如果名字有空格也要加引号。

```html
<p class="sans">这是无衬线字体，现代感强</p>
<p class="serif">这是衬线字体，适合正文阅读</p>
<p class="mono">这是等宽字体，适合代码</p>
```

```css
.sans {
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;  /* 中文用苹方/雅黑，都没有就回退到系统无衬线 */
}
.serif {
    font-family: Georgia, "Times New Roman", serif;  /* 衬线字体 */
}
.mono {
    font-family: "Fira Code", "Courier New", monospace;  /* 等宽字体 */
}
```

结果：第一段显示为现代圆润的无衬线字体，第二段显示为带笔锋装饰的衬线字体，第三段显示为每个字母宽度相同的等宽字体。

### 1.2 设置字体大小 font-size

匹配规则：控制文字的大小。可以使用 px（绝对）、rem（相对于根元素）、em（相对于父元素）、%（相对于父元素）等单位。

```html
<p class="small">小号文字 12px</p>
<p class="normal">正常文字 16px（浏览器默认）</p>
<p class="large">大号文字 2rem（约 32px）</p>
```

```css
.small {
    font-size: 12px;
}
.normal {
    font-size: 16px;  /* 大多数浏览器默认就是 16px，不写也行 */
}
.large {
    font-size: 2rem;  /* 16px × 2 = 32px */
}
```

结果：三个段落文字大小依次增大。实际开发中推荐用 rem，方便用户调整浏览器字号时整体缩放。

### 1.3 设置字体粗细 font-weight

匹配规则：控制文字的粗细。可以用数值（100~900，整百递增）或关键字（normal = 400，bold = 700）。

```html
<p class="light">细体 300</p>
<p class="normal">常规 400（默认）</p>
<p class="bold">粗体 700（加粗）</p>
<p class="black">特粗 900</p>
```

```css
.light {
    font-weight: 300;
}
.normal {
    font-weight: normal;  /* 等价于 400 */
}
.bold {
    font-weight: bold;    /* 等价于 700 */
}
.black {
    font-weight: 900;
}
```

结果：文字从细到粗依次变浓。注意：有些字体不支持所有粗细值，设置后可能不会变化。

### 1.4 设置字体样式（斜体） font-style

匹配规则：控制文字是否倾斜。通常用来表示强调、书名或引用。

```html
<p class="italic">这段文字是斜体</p>
<p class="normal">这段文字是正体（默认）</p>
```

```css
.italic {
    font-style: italic;  /* 使用字体的斜体版本 */
}
.normal {
    font-style: normal;  /* 恢复正常（取消斜体） */
}
```

结果：第一段倾斜，第二段正常。

### 1.5 字体简写 font（合并写法）

匹配规则：font-style、font-weight、font-size、line-height、font-family 的简写。必须按顺序写，且 font-size 和 font-family 是必填项。

```css
/* 顺序：style weight size/line-height family */
p {
    font: italic bold 16px/1.8 "PingFang SC", sans-serif;
}
```

结果：等价于分别写了 font-style: italic; font-weight: bold; font-size: 16px; line-height: 1.8; font-family: "PingFang SC", sans-serif;。节省代码量，但不建议新手用（容易写错顺序）。

## 二、文本布局（控制文字的排列方式）

### 2.1 设置文字水平对齐 text-align

匹配规则：控制文字在块级元素内的水平对齐方式。常用值：left（左对齐，默认）、center（居中）、right（右对齐）、justify（两端对齐——左右边缘都贴齐，适合大段文章）。

```html
<div class="left">我是左对齐（默认）</div>
<div class="center">我是居中对齐</div>
<div class="right">我是右对齐</div>
<div class="justify">我是两端对齐，每行文字左右都贴边，适合长文章阅读，看起来更整齐。</div>
```

```css
.left {
    text-align: left;
}
.center {
    text-align: center;
}
.right {
    text-align: right;
}
.justify {
    text-align: justify;
    width: 300px;
}
```

结果：文字分别靠左、居中、靠右、两端对齐。

### 2.2 设置文字装饰（下划线/删除线） text-decoration

匹配规则：给文字加装饰线。常用值：none（去掉下划线，用于超链接）、underline（下划线）、line-through（删除线）、overline（上划线）。

```html
<a href="#" class="link">我是超链接，默认有下划线</a>
<a href="#" class="no-underline">我去掉了下划线</a>
<p class="del">原价 199 元</p>
<p class="sale">现价 99 元（带删除线）</p>
```

```css
.link {
    text-decoration: underline;  /* 超链接默认就有，可以不写 */
}
.no-underline {
    text-decoration: none;  /* 最常用：去掉 a 标签的下划线 */
}
.del {
    text-decoration: line-through;  /* 删除线 */
}
.sale {
    text-decoration: line-through;
    color: #999;
}
```

结果：第一个链接有下划线，第二个没有。原价文字带删除线，表示已被划掉。

### 2.3 设置行高 line-height

匹配规则：控制两行文字之间的垂直距离（行距）。数值不带单位时表示当前字号的倍数（如 1.5 表示行高是字号的 1.5 倍）。行高也常用于单行文字的垂直居中。

```html
<p class="tight">这是紧凑行高（1.2），文字挤在一起，阅读费力。</p>
<p class="comfort">这是舒适行高（1.8），适合正文阅读，眼睛不累。</p>
<div class="center-line">我用行高实现了垂直居中</div>
```

```css
.tight {
    line-height: 1.2;  /* 字号 × 1.2，很挤 */
    font-size: 16px;
}
.comfort {
    line-height: 1.8;  /* 字号 × 1.8，宽松舒适 */
    font-size: 16px;
}
.center-line {
    line-height: 60px;  /* 行高等于容器高度，文字就垂直居中了 */
    height: 60px;
    background: #f0f0f0;
    text-align: center;
    border: 1px solid #ccc;
}
```

结果：第一段文字紧凑，第二段宽松。第三个盒子中的文字在 60px 高的容器中垂直居中。

### 2.4 设置字间距 letter-spacing

匹配规则：控制字符之间的间距（俗称"字距"）。正值让文字变疏，负值让文字变紧。

```html
<p class="normal">正常字间距</p>
<p class="loose">疏散字间距（常用于标题）</p>
<p class="tight">紧凑字间距</p>
```

```css
.normal {
    letter-spacing: normal;  /* 默认，0 */
}
.loose {
    letter-spacing: 4px;  /* 每个字之间增加 4px */
}
.tight {
    letter-spacing: -1px;  /* 字距缩小 1px，慎用负值 */
}
```

结果：第二段每个字之间的距离明显变大，适合做标题增加"高级感"。第三段文字略显拥挤。

## 三、文本溢出与换行（防止文字把布局撑坏）

### 3.1 设置换行方式 word-break

匹配规则：控制长单词或 URL 在容器边缘如何换行。默认情况下，长英文单词不会断，会溢出容器。

```html
<div class="break-all">supercalifragilisticexpialidocious</div>
<div class="break-word">supercalifragilisticexpialidocious</div>
<div class="keep-all">这是一段很长的中文文字，它默认就可以在任意字符处换行</div>
```

```css
.break-all {
    width: 100px;
    border: 1px solid #ccc;
    word-break: break-all;  /* 强行在任意字符处断开，连单词都会劈开 */
}
.break-word {
    width: 100px;
    border: 1px solid #ccc;
    word-break: break-word;  /* 尽量完整显示单词，实在放不下再断开 */
}
.keep-all {
    width: 100px;
    border: 1px solid #ccc;
    word-break: keep-all;  /* 中文/日文/韩文不断词，英文不断单词 */
}
```

结果：第一个盒子里的长单词被硬生生劈成多段，第二个盒子尽量保持单词完整再换行。

### 3.2 控制空白字符和换行 white-space

匹配规则：控制代码中的空格、换行符是否在页面上显示。默认情况下，连续空格会被压缩成一个，换行符会被忽略。

```html
<div class="normal">Hello     World
换行被忽略了</div>
<div class="pre">Hello     World
换行保留了</div>
<div class="nowrap">这段文字很长很长，但就是不换行，会溢出容器</div>
```

```css
.normal {
    white-space: normal;  /* 默认值：压缩空格，忽略换行 */
}
.pre {
    white-space: pre;     /* 保留空格和换行（类似 <pre> 标签） */
}
.nowrap {
    white-space: nowrap;  /* 强制不换行，超出容器也不换，搭配 text-overflow 使用 */
    width: 150px;
    border: 1px solid #ccc;
    overflow: hidden;     /* 配合溢出隐藏 */
}
```

结果：第一个盒子的多个空格被压缩成一个，换行失效。第二个盒子保留了多个空格和换行。第三个盒子文字死活不换行，直接溢出（或隐藏）。

### 3.3 溢出显示省略号（单行截断） text-overflow: ellipsis

匹配规则：当文字超出容器宽度时，在末尾显示 ...。必须同时满足：容器有固定宽度、overflow: hidden、white-space: nowrap。

```html
<div class="ellipsis">这是一段很长很长的文字，超出容器后会在末尾显示省略号</div>
```

```css
.ellipsis {
    width: 200px;
    white-space: nowrap;     /* 强制不换行 */
    overflow: hidden;        /* 溢出的藏起来 */
    text-overflow: ellipsis; /* 用 ... 表示被藏掉的部分 */
    border: 1px solid #ccc;
    padding: 8px;
}
```

结果：宽 200px 的盒子只显示"这是一段很长很长的文字，超..."，末尾加三个点。这是日常开发高频使用的技巧，几乎每个列表标题都会用到。