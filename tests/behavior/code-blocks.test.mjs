// tests/behavior/code-blocks.test.mjs — 代码块扫描器的行为测试
// 用法：pnpm test:behavior
//
// 构建后处理（注释剥离、残留外链样式表检查）需要知道 <script>/<style> 块的确切范围，
// 才不会把脚本里的字符串字面量当成 HTML 处理。
// 这里钉住的核心规则：结束标签只在字符串、模板串、注释、正则字面量之外才被认。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { codeBlockRanges, splitOutsideCode } from '../../astro-code-blocks.ts';

function blockOf(html) {
  const ranges = codeBlockRanges(html);
  assert.equal(ranges.length, 1, `应当只扫出一个块：${html}`);
  return html.slice(ranges[0][0], ranges[0][1]);
}

test('脚本内的 "</script>" 字符串不会截断块', () => {
  const html = '<div>a</div><script>const s = "</script>"; x();</script><div>b</div>';
  const parts = splitOutsideCode(html);
  assert.equal(parts[0], '<div>a</div>');
  assert.equal(parts[1], '<script>const s = "</script>"; x();</script>');
  assert.equal(parts[2], '<div>b</div>');
});

test('字符串里的转义引号不结束字符串', () => {
  const html = '<script>var a = "a\\"b</script>c";</script>';
  assert.equal(blockOf(html), '<script>var a = "a\\"b</script>c";</script>');
});

test('模板串里的 "</script>" 与花括号表达式都能跨过', () => {
  const html = '<script>const t = `${{a:1}} ${x => {}}`;</script>';
  assert.equal(blockOf(html), html);
});

test('行注释与块注释里的结束标记不算数', () => {
  const html = '<script>// </script>\n/* </script> */\nconsole.log(1);</script>';
  assert.equal(blockOf(html), html);
});

test('正则字面量里的 "<\\/script>" 不算数', () => {
  const html = '<script>const re = /<\\/script>/; re.test("x");</script>';
  assert.equal(blockOf(html), html);
});

test('连续除号不被当成正则字面量', () => {
  const html = '<script>const a = 10 / 2 / 3; const b = 1 / 4;</script>';
  assert.equal(blockOf(html), html);
});

test('样式块直接找结束标签，同一行的 url() 不受行注释干扰', () => {
  const html = '<div>1</div><style>.a{background:url(http://x/y.png)}</style><div>2</div>';
  const parts = splitOutsideCode(html);
  assert.equal(parts[0], '<div>1</div>');
  assert.equal(parts[1], '<style>.a{background:url(http://x/y.png)}</style>');
  assert.equal(parts[2], '<div>2</div>');
});

test('开标签里引号包裹的 ">" 不结束标签', () => {
  const html = '<script data-x="a>b">x();</script>';
  assert.equal(blockOf(html), '<script data-x="a>b">x();</script>');
});

test('开闭标签大小写不敏感', () => {
  const html = '<SCRIPT>x();</SCRIPT>';
  assert.equal(blockOf(html), html);
});

test('scriptfoo 不是 script 标签', () => {
  const html = '<div><scriptfoo>text</scriptfoo></div>';
  assert.deepEqual(codeBlockRanges(html), []);
  assert.deepEqual(splitOutsideCode(html), [html]);
});

test('结束标签缺失时把剩余内容整体当代码', () => {
  const html = '<div>1</div><script>const x = 1;';
  const ranges = codeBlockRanges(html);
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0][1], html.length);
  const parts = splitOutsideCode(html);
  assert.equal(parts[0], '<div>1</div>');
  assert.equal(parts[2], '');
});

test('多个块按出现顺序依次切出', () => {
  const html = '<style>.a{}</style><script>a();</script>中间<script>const s = "</style>";</script>';
  const parts = splitOutsideCode(html);
  assert.equal(parts[0], '');
  assert.equal(parts[1], '<style>.a{}</style>');
  assert.equal(parts[2], '');
  assert.equal(parts[3], '<script>a();</script>');
  assert.equal(parts[4], '中间');
  assert.equal(parts[5], '<script>const s = "</style>";</script>');
});
