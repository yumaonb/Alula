// tests/behavior/nav.test.mjs — 导航高亮的行为测试
// 用法：pnpm test:behavior
//
// navMatch 同时被构建期（首屏高亮）和浏览器侧（切页后重算）使用，
// 两边判定必须一致——这里钉住的是「什么算命中」这条规则本身。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { navMatch } from '../../src/lib/nav-match.ts';

test('首页只在自己那一页命中', () => {
  assert.equal(navMatch('/', '/'), true);
  assert.equal(navMatch('/', ''), true);
  assert.equal(navMatch('/', '/about/'), false);
});

test('文章区：列表页与所有子页都命中', () => {
  assert.equal(navMatch('/posts', '/posts'), true);
  assert.equal(navMatch('/posts', '/posts/'), true);
  assert.equal(navMatch('/posts', '/posts/devnotes/css/at-rule/'), true);
});

test('同前缀的兄弟路径不算命中', () => {
  // 少了结尾斜杠的判定，/posts 会命中 /posts-archive
  assert.equal(navMatch('/posts', '/posts-archive'), false);
  assert.equal(navMatch('/posts', '/posts-archive/x'), false);
});

test('链接末尾带不带斜杠都成立', () => {
  assert.equal(navMatch('/about/', '/about'), true);
  assert.equal(navMatch('/about', '/about/'), true);
  assert.equal(navMatch('/about/', '/about/team/'), true);
});
