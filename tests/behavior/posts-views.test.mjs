// tests/behavior/posts-views.test.mjs — 文章视图口径的行为测试
// 用法：pnpm test:behavior（node --test 自动发现本目录）
//
// 这些口径错的时候构建全绿，只会在部署后变成静默 404 或侧栏错位（耦合扫描结论），
// 测试把它们钉死：排序、隐藏文章去留、标签路由并集、缺字段默认值。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPostUrl, buildPostViews } from '../../src/features/posts/lib/posts-views.ts';

/** 造一个最小集合条目：id 是相对 content/posts 的无扩展名路径 */
function entry(id, data = {}, body = '') {
  return { id, body, data };
}

test('文章 URL：目录层级全部保留，首尾带斜杠', () => {
  assert.equal(buildPostUrl('hello'), '/posts/hello/');
  assert.equal(buildPostUrl('devnotes/css/at-rule'), '/posts/devnotes/css/at-rule/');
});

test('allPosts：置顶优先，同级按日期倒序，无日期排最后', () => {
  const views = buildPostViews(
    [
      entry('a', { date: new Date('2026-01-03') }),
      entry('b', { date: new Date('2026-01-02') }),
      entry('pinned', { date: new Date('2026-01-01'), pinned: true }),
      entry('nodate', {}),
    ],
    {},
  );
  assert.deepEqual(
    views.allPosts.map((p) => p.slug),
    ['pinned', 'a', 'b', 'nodate'],
  );
});

test('posts：隐藏文章被排除，但仍保留在 allPosts 里供路由生成', () => {
  const views = buildPostViews(
    [
      entry('hidden-one', { date: new Date('2026-01-02'), hidden: true }),
      entry('visible', { date: new Date('2026-01-01') }),
    ],
    {},
  );
  assert.deepEqual(
    views.posts.map((p) => p.slug),
    ['visible'],
  );
  assert.deepEqual(
    views.allPosts.map((p) => p.slug),
    ['hidden-one', 'visible'],
  );
});

test('chronological：只看日期，置顶文章不改变「谁比谁新」', () => {
  const views = buildPostViews(
    [
      entry('old-pinned', { date: new Date('2026-01-01'), pinned: true }),
      entry('newer', { date: new Date('2026-01-05') }),
    ],
    {},
  );
  assert.deepEqual(
    views.chronological.map((p) => p.slug),
    ['newer', 'old-pinned'],
  );
});

test('allTags：并集含隐藏文章的标签，去重并排序', () => {
  const views = buildPostViews(
    [
      entry('hidden-one', { tags: ['隐藏标签', 'css'], hidden: true }),
      entry('visible', { tags: ['css'] }),
    ],
    {},
  );
  assert.equal(views.allTags.includes('隐藏标签'), true);
  assert.equal(views.allTags.includes('css'), true);
  assert.equal(views.allTags.length, 2);
});

test('tags 计数：只统计可见文章，数量倒序', () => {
  const views = buildPostViews(
    [
      entry('a', { tags: ['css'] }),
      entry('b', { tags: ['css'] }),
      entry('hidden', { tags: ['css'], hidden: true }),
    ],
    {},
  );
  assert.deepEqual(views.tags, [{ name: 'css', count: 2 }]);
});

test('标签名含斜杠直接抛错，不让它变成上线后的坏链', () => {
  assert.throws(() => buildPostViews([entry('a', { tags: ['a/b'] })], {}), /不能包含/);
});

test('分类树：隐藏文章不计入', () => {
  const views = buildPostViews(
    [entry('dev/css/one', { hidden: true }), entry('dev/css/two', {})],
    {},
  );
  const dev = views.categoryTree.find((n) => n.path === 'dev');
  assert.equal(dev.count, 1);
});

test('缺字段默认值：无标题 / 无日期 / 无图 / 无标签 / 未置顶 / 未隐藏', () => {
  const [p] = buildPostViews([entry('lonely')], {}).allPosts;
  assert.equal(p.title, '无标题');
  assert.equal(p.date, '');
  assert.equal(p.image, '');
  assert.deepEqual(p.tags, []);
  assert.equal(p.pinned, false);
  assert.equal(p.hidden, false);
  assert.deepEqual(p.categoryTrail, []);
  assert.equal(p.basePath, 'content/posts');
});

test('有分类：categoryTrail 逐级带分类页 URL，basePath 跟分类走', () => {
  const views = buildPostViews([entry('devnotes/css/at-rule', { title: 'x' })], {
    devnotes: { name: '开发速查' },
  });
  const [p] = views.allPosts;
  assert.equal(p.category, 'devnotes/css');
  assert.deepEqual(p.categoryTrail, [
    { name: '开发速查', url: '/posts/devnotes/' },
    { name: 'css', url: '/posts/devnotes/css/' },
  ]);
  assert.equal(p.basePath, 'content/posts/devnotes/css');
});
