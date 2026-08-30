---
title: "CSS选择器"
date: 2026-08-30
description: "本文章记录CSS选择器相关代码，算是个快速查阅的文档，整体偏向于教学性质"
image: ""
tags: ["CSS", "编程"]
pinned: false
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

## 三、属性选择器

### 3.1 存在性属性选择器 [attr]

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

### 3.2 完全匹配 [attr="val"]

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

### 3.3 开头匹配 [attr^="val"]

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

### 3.4 结尾匹配 [attr$="val"]

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

### 3.5 包含匹配 [attr*="val"]

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

## 四、特殊选择器

这类选择器不按标签、类、ID 或属性来选元素，而是按逻辑关系或特殊匹配方式来选，功能更灵活。

### 4.1 否定选择器 :not()

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

### 4.2 任意匹配选择器 :is()

匹配规则：将多个选择器打包分组，匹配其中任意一个就能命中（相当于“或”的关系）。

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

### 4.3 零权重分组选择器 :where()

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

### 4.4 关系选择器 :has()

匹配规则：选中包含某个子元素或满足某种条件的父元素（相当于“父级选择器”）。

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

### 4.5 伪类组合连写（通用规则）

多个选择器（含伪类）可以紧挨着连写（中间无空格），表示“且”的关系（必须同时满足所有条件）。

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

```

## 五、伪类（单冒号 :）

### 5.1 状态伪类

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

### 5.2 位置伪类（结构伪类）

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

### 5.3 否定与其它

#### :not(selector)

匹配规则：排除匹配指定选择器的元素。

```html
<ul>
  <li>第 1 项</li>
  <li class="active">第 2 项（激活）</li>
  <li>第 3 项</li>
</ul>
```

```css
li:not(.active) {
  color: gray;
}
```

结果：第 1 项和第 3 项变灰，第 2 项不变（被排除了）。

## 六、伪元素（双冒号 ::）

### 6.1 ::before / ::after

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

### 6.2 ::first-line

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

## 七、优先级权重（防冲突）

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
- `!important` 拥有最高特权（具体用法看下面），日常开发尽量避免：它会破坏 CSS 层叠规则，导致后期修改只能不断追加 `!important`，维护成本极高。仅限极少数场景（如覆盖第三方库且无其他办法）才谨慎使用。

注意：`!important` 不属于选择器，它是写在属性值后面的修饰符。

```css
div {
  color: green !important; /* 无论外部样式权重多少，这条强制生效，除非另一个与其冲突的也使用了!important且权重更高 */
}