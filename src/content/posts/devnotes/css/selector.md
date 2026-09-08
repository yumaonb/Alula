---
title: "CSS选择器"
date: 2026-09-08
description: "本文章记录CSS选择器相关代码，算是个快速查阅的文档，整体偏向于教学性质"
tags: ["CSS", "编程"]
---

## 一、基础选择器

---

### 1.1 通配选择器 *

匹配规则：匹配页面中所有元素。

```html
<div>div 元素</div>
<p>p 元素</p>
<span>span 元素</span>
```

```css
* {
  color: red;
}
```

结果：div、p、span 全部变红。

---

### 1.2 标签选择器 div

匹配规则：匹配指定标签名的所有元素。

```html
<div>div 元素</div>
<p>p 元素</p>
<div>另一个 div 元素</div>
```

```css
div {
  color: red;
}
```

结果：两个 div 变红，p 不变。

---

### 1.3 类选择器 .class

匹配规则：匹配具有指定 class 属性的所有元素，可复用。

```html
<div class="box">div 盒子</div>
<p class="box">p 盒子</p>
<span>span 元素</span>
```

```css
.box {
  color: red;
}
```

结果：div 和 p 都变红，span 不变。

---

### 1.4 ID 选择器 #id

匹配规则：匹配具有指定 id 属性的元素，页面内唯一。

```html
<div id="header">页头</div>
<div id="footer">页脚</div>
```

```css
#header {
  color: red;
}
```

结果：只有"页头"变红，"页脚"不变。

---

### 1.5 存在性属性选择器 [attr]

匹配规则：匹配带有指定属性名的元素，不管属性值是什么。

```html
<input type="text" placeholder="用户名">
<input placeholder="密码">
<button>登录</button>
```

```css
[placeholder] {
  background: yellow;
}
```

结果：用户名框和密码框 背景变黄，button 不变（没有 placeholder 属性）。

---

### 1.6 完全匹配 [attr="val"]

匹配规则：属性值完全等于指定值。

```html
<input type="text">
<input type="password">
<input type="text">
```

```css
[type="text"] {
  border: 2px solid red;
}
```

结果：两个 type="text" 的输入框 加红边框，密码框不变。

---

### 1.7 开头匹配 [attr^="val"]

匹配规则：属性值以指定值开头。

```html
<a href="https://example.com">安全链接</a>
<a href="http://example.com">不安全链接</a>
```

```css
[href^="https"] {
  color: green;
}
```

结果：第一个链接 变绿（以 https 开头），第二个不变（http 开头）。

---

### 1.8 结尾匹配 [attr$="val"]

匹配规则：属性值以指定值结尾。

```html
<img src="photo.jpg">
<img src="icon.png">
<img src="photo.gif">
```

```css
[src$=".png"] {
  border: 3px solid blue;
}
```

结果：只有 icon.png 加蓝边框，其他不变。

---

### 1.9 包含匹配 [attr*="val"]

匹配规则：属性值包含指定子串。

```html
<div class="btn-primary">主要按钮</div>
<div class="btn-danger">危险按钮</div>
<div class="header">页头</div>
```

```css
[class*="btn"] {
  color: white;
  background: black;
}
```

结果：前两个 div 变白字黑底（class 里包含"btn"），第三个不变。

## 二、组合选择器（层级与兄弟关系）

### 2.1 后代选择器（空格）A B

匹配规则：选中 A 内部所有层级的 B 元素，儿孙全算，不限层级。

```html
<div class="box">
  <p>儿子 p</p>
  <div>
    <p>孙子 p</p>
  </div>
</div>
```

```css
.box p {
  color: red;
}
```

结果：儿子 p 和孙子 p 全都变红。

---

### 2.2 子代选择器（大于号）A > B

匹配规则：只选 A 的直接子元素 B，隔一层就不算。

```html
<div class="box">
  <p>儿子 p</p>
  <div>
    <p>孙子 p</p>
  </div>
</div>
```

```css
.box > p {
  color: red;
}
```

结果：只有"儿子 p"变红。"孙子 p"被 `<div>` 包着，隔了一层，选不中。

---

### 2.3 相邻兄弟选择器（加号）A + B

匹配规则：选中紧跟在 A 后面的第一个同级兄弟 B，必须紧挨着，中间不能有任何标签。

```html
<h2>标题</h2>
<p>紧挨着的 p</p>
<p>隔了一个的 p</p>
```

```css
h2 + p {
  color: red;
}
```

结果：第一个 `<p>` 变红，第二个不变（不紧挨 h2）。

---

### 2.4 通用兄弟选择器（波浪号）A ~ B

匹配规则：选中 A 后面所有的同级兄弟 B，不要求紧挨，隔了其他标签也能继续抓。

```html
<h2>标题</h2>
<p>第一个 p</p>
<div>中间隔了 div</div>
<p>第二个 p</p>
```

```css
h2 ~ p {
  color: red;
}
```

结果：第一个 p 和第二个 p 全都变红，中间隔了 div 也不影响。

---

### 2.5 并集选择器（分组选择器）h1, .title, #main

匹配规则：用逗号 `,` 把多个选择器打成一组，同时选中其中任意一个命中的元素（相当于"或"的关系），常用于把多个元素的相同样式合并成一条规则。

```html
<h1>一级标题</h1>
<p class="title">类名为 title 的段落</p>
<div id="main">id 为 main 的区块</div>
<span>普通 span</span>
```

```css
h1, .title, #main {
  color: red;
}
```

结果：h1、.title、#main 三个元素全部变红，span 不变。

注意：逗号列表属于"非宽容"选择器——只要列表里任何一个选择器写错或浏览器不认识，整条规则都会失效。如果想让某一项失效不影响整体，可以用 `:is()` 包裹，但 `:is()` 的权重取括号内选择器的最高权重，与逗号列表里各项独立计算权重的方式不同。

## 三、伪类选择器（单冒号 :）

### 3.1 动态伪类

#### :hover

匹配规则：鼠标悬停时触发。

```html
<button>悬停我</button>
```

```css
button:hover {
  background: red;
  color: white;
}
```

结果：鼠标放上去，按钮 背景变红，字变白。

---

#### :focus

匹配规则：表单元素获得焦点时触发（点击输入框或 Tab 键切换）。

```html
<input type="text" placeholder="点击我">
<input type="text" placeholder="点我试试">
```

```css
input:focus {
  border: 3px solid blue;
  outline: none;
}
```

结果：点击哪个输入框，哪个就 加蓝边框。

---

#### :link

匹配规则：匹配尚未被访问过的链接（带 href 属性的 `<a>`）。页面刚打开时，所有链接默认都处于 :link 状态。

```html
<a href="https://example.com">未被访问的链接</a>
<a href="https://example.org">另一个链接</a>
```

```css
a:link {
  color: blue;
  text-decoration: none;
}
```

结果：两个链接都显示为蓝色、无下划线（未访问状态）。

---

#### :visited

匹配规则：匹配已经被用户访问过（点击打开过）的链接。出于隐私保护，浏览器只允许 :visited 修改颜色类属性，其他样式一律无效。

```html
<a href="https://example.com">访问过的链接</a>
```

```css
a:visited {
  color: purple;
}
```

结果：访问过的链接变紫，未访问的链接保持 :link 的蓝色。

---

#### :active

匹配规则：匹配鼠标按下但还没松开的瞬间被激活的元素，常用于点击按钮时给出"按下"的反馈。

```html
<button>点我</button>
```

```css
button:active {
  transform: scale(0.95);
  background: #e0e0e0;
}
```

结果：按钮按下的瞬间缩小并变灰，松手后恢复。

注意：链接相关的伪类书写顺序必须为 `:link` → `:visited` → `:hover` → `:active`（记忆口诀：Love Hate），顺序错误会导致样式失效。

---

### 3.2 结构伪类

#### :first-child / :last-child

匹配规则：first-child 选父元素中的第一个子元素，last-child 选最后一个。

```html
<ul>
  <li>第 1 项</li>
  <li>第 2 项</li>
  <li>第 3 项</li>
</ul>
```

```css
li:first-child {
  color: red;
}
li:last-child {
  color: blue;
}
```

结果：第 1 项变红，第 3 项变蓝，第 2 项不变。

---

#### :nth-child(n)

匹配规则：选父元素中的第 n 个子元素。n 从 1 开始，也支持 odd（奇数）、even（偶数）、2n+1 等公式。

```html
<ul>
  <li>第 1 项</li>
  <li>第 2 项</li>
  <li>第 3 项</li>
  <li>第 4 项</li>
</ul>
```

```css
li:nth-child(2) {
  background: yellow;
}
li:nth-child(odd) {
  color: red;
}
li:nth-child(even) {
  color: blue;
}
```

结果：

· 第 2 项 黄色背景
· 第 1、3 项 红色字（奇数）
· 第 2、4 项 蓝色字（偶数）

---

#### :nth-of-type(n)

匹配规则：在同类型标签中选第 n 个，忽略其他类型的标签干扰。

```html
<div>
  <p>第 1 个 p</p>
  <span>span</span>
  <p>第 2 个 p</p>
  <p>第 3 个 p</p>
</div>
```

```css
p:nth-of-type(2) {
  color: red;
}
```

结果：只有"第 2 个 p"变红。如果是用 :nth-child(2)，选中的反而是 span。

---

#### :nth-last-child(n)

匹配规则：从父元素的最后一个子元素往前数，选第 n 个，同样支持 odd、even、2n+1 等公式。

```html
<ul>
  <li>第 1 项</li>
  <li>第 2 项</li>
  <li>第 3 项</li>
  <li>第 4 项</li>
</ul>
```

```css
li:nth-last-child(1) {
  color: red;
}
```

结果：倒数第 1 个（第 4 项）变红。

---

#### :first-of-type

匹配规则：选父元素中同类型的第一个子元素。与 :first-child 的区别：:first-child 要求必须是"第一个孩子且类型匹配"，:first-of-type 只要求是"同类型中第一个出现的"，前面有其他标签挡着也没关系。

```html
<div>
  <span>span</span>
  <p>第 1 个 p</p>
  <p>第 2 个 p</p>
</div>
```

```css
p:first-of-type {
  color: red;
}
```

结果："第 1 个 p"变红（它是 p 元素中第一个出现的）；如果改用 `p:first-child` 则选不中（它前面还有 span）。

---

#### :last-of-type

匹配规则：选父元素中同类型的最后一个子元素，规则和 :first-of-type 正好相反。

```html
<div>
  <p>第 1 个 p</p>
  <span>span</span>
  <p>第 2 个 p</p>
</div>
```

```css
p:last-of-type {
  color: red;
}
```

结果："第 2 个 p"变红，span 不影响计数。

---

#### :only-child

匹配规则：选父元素中唯一的那个子元素。

```html
<div>
  <p>唯一的 p</p>
</div>
<div>
  <p>第 1 个 p</p>
  <p>第 2 个 p</p>
</div>
```

```css
p:only-child {
  color: red;
}
```

结果：第一个 div 里的 p 变红（它是唯一子元素）；第二个 div 有两个 p，都不算唯一子元素，不变。

---

#### :only-of-type

匹配规则：选父元素中同类型里唯一的元素，允许旁边有其他不同类型的兄弟元素。

```html
<div>
  <p>唯一的 p</p>
  <span>span</span>
</div>
<div>
  <p>第 1 个 p</p>
  <p>第 2 个 p</p>
</div>
```

```css
p:only-of-type {
  color: red;
}
```

结果：第一个 div 里的 p 变红（虽然旁边有 span，但 p 类型只有它一个）；第二个 div 有两个 p，不变。

---

#### :root

匹配规则：匹配文档根元素，即 `<html>`。最常用于在根元素上声明全局 CSS 自定义变量（变量对整棵文档树的所有后代生效）。

```html
<div>普通文字</div>
```

```css
/* 在根元素声明全局变量 */
:root {
  --main-color: #e74c3c;
}

div {
  color: var(--main-color); /* 任何后代元素都可以使用 */
}
```

结果：div 的文字颜色使用 :root 声明的变量 --main-color（红色）。

---

#### :empty

匹配规则：匹配没有任何子节点的元素——不能有标签、不能有文本，连空格都不能有，常用于空状态占位。

```html
<div class="empty"></div>
<div>有文本</div>
<div class="empty"> </div>
```

```css
.empty:empty {
  background: #eee;
  height: 50px;
}
```

结果：第一个空 div 显示灰底占位；第二个有文本、第三个里面有空格都不算空，样式不生效。

---

#### :target

匹配规则：匹配当前 URL 锚点（#id）指向的元素，可用于纯 CSS 实现手风琴、选项卡切换等交互。

```html
<a href="#section-1">打开区块一</a>
<div id="section-1">区块一的内容</div>
<div id="section-2">区块二的内容</div>
```

```css
:target {
  background: yellow;
}
```

结果：当 URL 变成 `页面地址#section-1` 时，对应的区块一出现黄底；点击其他锚点链接则跟着切换。

---

说明：`div:first-child`（必须是第一个孩子且为 div）与 `div:first-of-type`（第一个出现的 div）含义不同，使用时需注意区分。

---

### 3.3 表单状态伪类

表单相关的状态伪类数量多、逻辑独立，在日常开发中使用频率很高，因此单独拆成独立章节。

#### :enabled / :disabled

匹配规则：:enabled 匹配可编辑、可用的表单控件；:disabled 匹配被禁用的表单控件（设置了 disabled 属性）。

```html
<input type="text" placeholder="可用">
<input type="text" placeholder="禁用" disabled>
```

```css
input:enabled {
  background: white;
}

input:disabled {
  background: #eee;
  color: #999;
}
```

结果：第一个输入框保持白底；第二个变灰底灰字（禁用状态，无法编辑）。

---

#### :read-only / :read-write

匹配规则：:read-only 匹配只读的表单控件（设置了 readonly 属性）；:read-write 匹配可读写的表单控件（默认状态）。

```html
<input type="text" value="只读框" readonly>
<input type="text" placeholder="可编辑框">
```

```css
input:read-only {
  background: #f5f5f5;
  border: 1px dashed #999;
}

input:read-write {
  background: white;
}
```

结果：只读框灰底虚线边框，可编辑框保持白底。

---

#### :required / :optional

匹配规则：:required 匹配设置了 required 属性的必填控件；:optional 匹配没设 required 的非必填控件。

```html
<form>
  <input type="text" required placeholder="必填项">
  <input type="text" placeholder="选填项">
</form>
```

```css
input:required {
  border: 2px solid #e74c3c;
}

input:optional {
  border: 2px solid #ccc;
}
```

结果：必填框红边框，选填框灰边框。

---

#### :valid / :invalid

匹配规则：:valid 匹配内容通过浏览器内置校验规则的表单控件；:invalid 匹配校验失败的控件（比如 type="email" 的内容不是邮箱格式）。

```html
<form>
  <input type="email" placeholder="邮箱" value="hello">
  <input type="email" placeholder="邮箱" value="a@b.com">
</form>
```

```css
input:valid {
  border: 2px solid #2ecc71;
}

input:invalid {
  border: 2px solid #e74c3c;
}
```

结果：第一个邮箱格式错误变红框，第二个格式正确变绿框。

---

#### :in-range / :out-of-range

匹配规则：:in-range 匹配数值在 min / max 范围内的输入框；:out-of-range 匹配超出范围的值。

```html
<input type="number" min="0" max="10" value="5">
<input type="number" min="0" max="10" value="20">
```

```css
input:in-range {
  border: 2px solid #2ecc71;
}

input:out-of-range {
  border: 2px solid #e74c3c;
}
```

结果：5 在 0~10 范围内变绿框；20 超出范围变红框。

---

#### :placeholder-shown

匹配规则：匹配当前正在显示占位文本（placeholder）的输入框，常用于判断用户是否还没输入内容。

```html
<input type="text" placeholder="请输入用户名">
```

```css
input:placeholder-shown {
  border: 2px dashed #999;
}
```

结果：输入框显示占位文字时是灰色虚线边框；一旦用户输入内容，占位文字消失，样式自动取消。

---

#### :checked

匹配规则：单选框或复选框被选中时触发。

```html
<input type="checkbox"> 接受条款
<input type="checkbox" checked> 已勾选
```

```css
input:checked {
  outline: 2px solid red;
}
```

结果：默认勾选的那个 出现红描边，另一个不变。

---

#### :default

匹配规则：匹配表单中默认被选中的元素（例如带 checked 属性的单选框/复选框，或带 selected 属性的 option），页面刷新或重置后仍指向它。

```html
<form>
  <input type="radio" name="opt" checked> 选项一
  <input type="radio" name="opt"> 选项二
</form>
```

```css
input:default {
  outline: 2px solid blue;
}
```

结果：选项一（默认选中项）加蓝描边；用户手动切换选中其他选项后，:default 仍然指向最初的默认项。

---

#### :indeterminate

匹配规则：匹配处于"不确定"状态的复选框或单选框，典型场景是"全选框"的部分选中（半选）状态。

```html
<input type="checkbox" id="all"> 全选
<input type="checkbox" checked> 子项一
<input type="checkbox"> 子项二
```

```css
#all:indeterminate {
  outline: 2px solid orange;
}
```

结果：当通过 JS 将全选框的 indeterminate 属性设为 true 后，它呈现半选状态（框内显示一条横线）并加橙描边；该状态需要配合 JS 触发。

---

### 3.4 逻辑与关系伪类

这类选择器不按标签、类、ID 或属性来选元素，而是按逻辑关系或特殊匹配方式来选，功能更灵活。

#### 否定选择器 :not()

匹配规则：选中不匹配括号里选择器的元素（排除法）。

```html
<ul>
  <li>第 1 项</li>
  <li class="active">第 2 项（激活）</li>
  <li>第 3 项</li>
</ul>
<input type="text" disabled>
<input type="text" placeholder="可用">
```

```css
/* 排除 class="active" 的 li */
li:not(.active) {
  color: gray;
}

/* 排除禁用状态，且获得焦点的输入框（多选择器连用） */
input:not(:disabled):focus {
  border-color: blue;
}
```

结果：第 1、3 项变灰（第 2 项不变）；可用的输入框获得焦点时加蓝边框（禁用的输入框无法获得焦点，所以不变）。

---

#### 任意匹配选择器 :is()

匹配规则：将多个选择器打包分组，匹配其中任意一个就能命中（相当于"或"的关系）。

```html
<header class="header"><p>头部段落</p></header>
<footer class="footer"><p>底部段落</p></footer>
<section><p>普通段落</p></section>
```

```css
/* 等价于 .header p, .footer p，且权重等于 0,0,1,1（类+标签） */
:is(.header, .footer) p {
  color: red;
}
```

结果：头部和底部的段落变红，普通段落不变。

:is() 在旧浏览器兼容性不如 :where()，使用时注意。

---

#### 零权重分组选择器 :where()

匹配规则：和 :is() 用法完全一样，也是打包分组。唯一区别：权重恒为 0，哪怕括号里写 #id，整体权重也是 0,0,0,0。

```html
<nav class="nav"><a href="#">首页</a></nav>
<footer class="footer"><a href="#">隐私</a></footer>
<div class="special"><a href="#">特别链接</a></div>
```

```css
/* 等价于 .nav a, .footer a，但权重仅为 a（0,0,0,1） */
:where(.nav, .footer) a {
  color: blue;
}

/* 一个类选择器（权重 0,0,1,1）就能轻松覆盖上面的蓝色 */
.special a {
  color: red;
}
```

结果：导航和页脚的链接默认蓝色；而 .special 里的链接变红（无需 !important 就能覆盖）。

---

#### 关系选择器 :has()

匹配规则：选中包含某个子元素或满足某种条件的父元素（相当于"父级选择器"）。

```html
<div class="card">
  <h2>标题</h2>
  <p>内容段落</p>
</div>
<div class="card">
  <h2>标题</h2>
</div>
```

```css
/* 选中包含 <p> 子元素的 .card */
.card:has(p) {
  border: 2px solid red;
}
```

结果：第一个 .card 加红边框（因为里面有 `<p>`），第二个不变。

兼容性注意：:has() 是较新的选择器，部分旧浏览器不支持，现代项目可用。

---

### 3.5 伪类组合连写（通用规则）

多个选择器（含伪类）可以紧挨着连写（中间无空格），表示"且"的关系（必须同时满足所有条件）。

```css
/* 悬停且被激活的链接 */
a:hover:active {
  color: orange;
}

/* 第一个子元素且被悬停的 li */
li:first-child:hover {
  background: gray;
}

/* 结合 :not() 使用：未被禁用且获得焦点的输入框 */
input:not(:disabled):focus {
  border-color: blue;
}
```

两个致命细节：

1. 顺序影响效果（LVHA 规则）：
      针对 `<a>` 标签，伪类必须按 :link → :visited → :hover → :active 顺序写（记忆口诀：Love Hate），否则在部分浏览器中可能失效。
2. 伪元素必须放最后：
      如果混用伪类与伪元素（如 ::before），伪元素必须写在所有伪类后面。
      正确：div:hover::before { }
      错误：div::before:hover { }（浏览器无法解析，直接忽略）

权重累加：链式组合的伪类越多，权重越高（如 div:hover:not(.active) 权重为 0,0,2,1）。

## 四、伪元素（双冒号 ::）

### 4.1 ::before / ::after

匹配规则：在元素内部最前面（before）或最后面（after）创建一个虚拟子元素，必须写 content 属性才能显示。

```html
<div class="box">内容</div>
```

```css
.box::before {
  content: "【前缀】";
  color: red;
}
.box::after {
  content: "【后缀】";
  color: blue;
}
```

结果：页面上显示为 【前缀】内容【后缀】 ，前缀红字，后缀蓝字。

---

### 4.2 ::first-line

匹配规则：选中块级元素中的第一行文本（根据浏览器中显示的换行的情况，不是根据代码里面的回车之类的换行）。

```html
<p>这是第一行，这是第一行，这是第一行，这是第一行，这是第一行，这是第一行，这是第一行。</p>
```

```css
p::first-line {
  font-weight: bold;
  color: red;
}
```

结果：第一行变粗变红，后面行不变。

---

### 4.3 ::first-letter

匹配规则：选中块级元素的首字母（中文即第一个字），常用于制作首字下沉效果。

```html
<p>山重水复疑无路，柳暗花明又一村。</p>
```

```css
p::first-letter {
  font-size: 2em;
  font-weight: bold;
  color: red;
}
```

结果：首字"山"放大加粗变红，形成首字下沉的视觉效果。

---

### 4.4 ::selection

匹配规则：匹配用户用鼠标高亮选中的文本区域，可自定义选中文字的颜色和背景。

```html
<p>选中我试试看。</p>
```

```css
::selection {
  background: #ffd700;
  color: #000;
}
```

结果：页面任意文字被选中时，背景金黄、文字变黑（覆盖浏览器默认的蓝底白字）。

---

### 4.5 ::placeholder

匹配规则：匹配输入框的占位提示文本，用来单独给占位文字设置样式，只能修改颜色等少数文字属性。

```html
<input type="text" placeholder="请输入用户名">
```

```css
input::placeholder {
  color: #999;
  font-style: italic;
}
```

结果：占位文字显示为灰字斜体；用户输入内容后占位文本消失，样式不再生效。

---

### 4.6 ::marker

匹配规则：匹配列表项前面的项目标记符号（圆点、序号等），可修改标记的颜色、字号等。

```html
<ul>
  <li>苹果</li>
  <li>香蕉</li>
</ul>
```

```css
li::marker {
  color: red;
  font-weight: bold;
}
```

结果：列表前的圆点标记变红加粗，列表文字本身不变。

---

### 4.7 ::backdrop

匹配规则：匹配全屏模式（Fullscreen API）或 `<dialog>` 弹窗背后的背景层，常用来给弹窗加一层半透明蒙层。

```html
<dialog open>
  <p>弹窗内容</p>
</dialog>
```

```css
dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}
```

结果：弹窗后面的区域出现半透明黑色蒙层，突出弹窗内容。

## 五、优先级权重（防冲突）

当多个选择器同时指向同一个元素时，哪个规则生效？按权重从高到低排列：

| 类型 | 权重值 | 示例 |
|------|--------|------|
| 行内样式 | 1,0,0,0 | `<div style="color:red;">` |
| ID 选择器 | 0,1,0,0 | `#header` |
| 类 / 伪类 / 属性选择器 | 0,0,1,0 | `.box`、`:hover`、`[type="text"]` |
| 标签 / 伪元素 | 0,0,0,1 | `div`、`::before` |
| 通配符 / 组合符 | 0,0,0,0 | `*`、`>`、`+`、`~` |

```html
<div id="box" class="box" style="color: yellow;">什么颜色？</div>
```

```css
#box { color: red; }      /* ID 权重 0100 */
.box { color: blue; }     /* 类 权重 0010 */
div { color: green; }     /* 标签 权重 0001 */
```

结果：文字是黄色。行内样式权重最高（1000），压过了所有外部样式。

选择器权重计算规则如下：

- `:not()` 本身的权重不计，总权重由括号内选择器的最高权重决定。例如 `:not(.box)` 权重等于 `.box`（0,0,1,0），而 `:not(#id)` 权重等于 `#id`（0,1,0,0）。
- `:is()` 取括号内选择器的最高权重（如 `:is(.header, .footer)` 权重等于类选择器 0,0,1,0）。
- `:where()` 权重恒为 0，哪怕括号里写 `#id`，整体权重也是 0,0,0,0。专门用于"低优先级兜底样式"。
- `:has()` 的权重计算方式与 `:is()` 相同，取括号内选择器的最高权重；但它在匹配时需要遍历相关节点，性能开销比普通选择器大，建议谨慎使用。
- `!important` 拥有最高特权（具体用法看下面），日常开发尽量避免：它会破坏 CSS 层叠规则，导致后期修改只能不断追加 `!important`，维护成本极高。仅限极少数场景（如覆盖第三方库且无其他办法）才谨慎使用。

注意：`!important` 不属于选择器，它是写在属性值后面的修饰符。

```css
div {
  color: green !important; /* 无论外部样式权重多少，这条强制生效，除非另一个与其冲突的也使用了!important且权重更高 */
}
```