// tests/behavior/category.test.mjs — 分类逻辑的行为测试
// 用法：pnpm test:behavior（node --test 自动发现本目录）
//
// 用例直接取自修过的真 bug，每条注明来历——没走过一次真实故障的断言，
// 很容易写成"照着现在的实现抄一遍"，那种测试改代码时会一起改，抓不到回归。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCategoryTree,
  buildCategoryUrl,
  buildCategoryTrail,
  buildTagUrl,
  formatDate,
  postMatchesCategory,
  postPathSegments,
  activeCategoryOf,
  activeTagOf,
  visiblePosts,
  isPostAreaPath,
} from '../../src/lib/category.ts';

/** 造一条最小文章记录，只覆盖被测字段 */
function post(overrides = {}) {
  return {
    slug: 'x',
    title: 'x',
    date: '2026-01-01',
    description: '',
    image: '',
    tags: [],
    pinned: false,
    hidden: false,
    category: '',
    categoryTrail: [],
    basePath: '',
    url: '/posts/x/',
    words: 0,
    ...overrides,
  };
}

test('分类树：根节点按「含子树」的总数排序', () => {
  // 来历：B-52。子目录有 9 篇、自己一篇没直挂的分类，曾被排到只有 1 篇的分类后面。
  const posts = [
    ...Array.from({ length: 9 }, () => post({ category: 'deep/sub' })),
    post({ category: 'one' }),
  ];
  const tree = buildCategoryTree(posts, {});
  assert.equal(tree[0].path, 'deep');
  assert.equal(tree[0].count, 9);
  assert.equal(tree[1].path, 'one');
  assert.equal(tree[1].count, 1);
});

test('分类树：父节点计数含子树，自身直挂的也计入', () => {
  const posts = [post({ category: 'a/b' }), post({ category: 'a/b' }), post({ category: 'a' })];
  const tree = buildCategoryTree(posts, {});
  const a = tree.find((n) => n.path === 'a');
  assert.equal(a.count, 3);
  assert.equal(a.children.find((n) => n.path === 'a/b').count, 2);
});

test('分类树：中间层节点也会生成，且有 index.json 时用其名称', () => {
  const tree = buildCategoryTree([post({ category: 'devnotes/css' })], {
    devnotes: { name: '开发速查' },
  });
  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, '开发速查');
  // 没给 meta 的层级用目录名兜底
  assert.equal(tree[0].children[0].name, 'css');
});

test('分类树：同一层按名称排序', () => {
  const tree = buildCategoryTree([post({ category: 'b' }), post({ category: 'a' })], {});
  assert.deepEqual(
    tree.map((n) => n.path),
    ['a', 'b'],
  );
});

test('分类树：根目录文章不进树', () => {
  assert.deepEqual(buildCategoryTree([post({ category: '' })], {}), []);
});

test('分类匹配：本层与子层都算命中，前缀相同的兄弟不命中', () => {
  const p = post({ category: 'devnotes/css' });
  assert.equal(postMatchesCategory(p, 'devnotes'), true);
  assert.equal(postMatchesCategory(p, 'devnotes/css'), true);
  assert.equal(postMatchesCategory(p, 'devnotes-css'), false);
  assert.equal(postMatchesCategory(post({ category: '' }), 'devnotes'), false);
});

test('URL 构造：分类与标签都带首尾斜杠', () => {
  assert.equal(buildCategoryUrl(['devnotes', 'css']), '/posts/devnotes/css/');
  assert.equal(buildCategoryUrl([]), '/posts/');
});

test('URL 构造：标签里的斜杠 / 空格 / 中文 / # 必须编码', () => {
  // 来历：B-42。标签名含 `/` 时未编码，链接指向的静态路径对不上，构建后 404。
  assert.equal(buildTagUrl('a/b'), '/posts/tag/a%2Fb/');
  assert.equal(buildTagUrl('前端 笔记'), '/posts/tag/%E5%89%8D%E7%AB%AF%20%E7%AC%94%E8%AE%B0/');
  assert.equal(buildTagUrl('c#'), '/posts/tag/c%23/');
});

test('日期：按 UTC 输出 YYYY-MM-DD，不因构建机时区挪前一天', () => {
  // 来历：B-43。date 缺省或格式错时静默出错。
  assert.equal(formatDate('2026-01-01'), '2026-01-01');
  assert.equal(formatDate(new Date('2026-01-01T23:00:00-05:00')), '2026-01-02');
  assert.equal(formatDate('不是日期'), '');
});

test('可见文章：隐藏文章被过滤掉', () => {
  const list = [post({ hidden: true }), post({ hidden: false })];
  assert.equal(visiblePosts(list).length, 1);
});

test('路径解析：只取文章区之后的部分', () => {
  assert.deepEqual(postPathSegments('/posts/devnotes/css/at-rule/'), [
    'devnotes',
    'css',
    'at-rule',
  ]);
  assert.deepEqual(postPathSegments('/about/'), []);
  assert.deepEqual(postPathSegments('/posts/'), []);
});

test('文章区判定：首段为文章根路由即为文章区', () => {
  // 来历：区内切换标记 is-post-swap 的目标页判定（swup 的 visit.to.url 带 search 参数）
  assert.equal(isPostAreaPath('/posts/'), true);
  assert.equal(isPostAreaPath('/posts/devnotes/css/at-rule/'), true);
  assert.equal(isPostAreaPath('/posts/tag/css/'), true);
  assert.equal(isPostAreaPath('/posts/about?foo=bar'), true);
  assert.equal(isPostAreaPath('/'), false);
  assert.equal(isPostAreaPath('/about/'), false);
  assert.equal(isPostAreaPath('/projects/'), false);
});

test('当前分类：取已知分类里的最长前缀', () => {
  const known = new Set(['devnotes', 'devnotes/css']);
  assert.equal(activeCategoryOf(['devnotes', 'css', 'at-rule'], known), 'devnotes/css');
  assert.equal(activeCategoryOf(['devnotes', 'other'], known), 'devnotes');
  assert.equal(activeCategoryOf(['unknown'], known), '');
});

test('当前分类：畸形百分号编码不会抛错', () => {
  // 来历：孤立 `%` 会让 decodeURIComponent 抛 URIError，一个坏链接能把侧栏搞崩。
  const known = new Set(['100%']);
  assert.doesNotThrow(() => activeCategoryOf(['100%'], known));
});

test('当前标签：只在 /posts/tag/<tag>/ 这一种形状下取值', () => {
  assert.equal(activeTagOf(['tag', 'css']), 'css');
  assert.equal(activeTagOf(['tag', 'a%20b']), 'a b');
  assert.equal(activeTagOf(['tag']), '');
  assert.equal(activeTagOf(['devnotes', 'css']), '');
});

test('分类链：逐级生成名称与 URL', () => {
  const trail = buildCategoryTrail('devnotes/css', { devnotes: { name: '开发速查' } });
  assert.deepEqual(trail, [
    { name: '开发速查', url: '/posts/devnotes/' },
    { name: 'css', url: '/posts/devnotes/css/' },
  ]);
});
