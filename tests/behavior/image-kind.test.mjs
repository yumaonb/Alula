// image-kind.test.mjs — 图片归类行为测试（灯箱 / 加载失败降级共用的分流口径）
// 用法：pnpm test:behavior（node --test 自动发现本目录）
//
// image-kind.ts 是「这张图属于哪一类」的唯一判据：灯箱收不收它、失败怎么降级
// 全按归类分流。优先级错了不报错，只在某个页面上悄悄多放大 / 少放大一张图，
// 测试把优先级与灯箱取图顺序钉死。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  imageKindOf,
  isZoomableImage,
  zoomableImages,
} from '../../src/features/posts/scripts/image-kind.ts';

/* ---- 迷你 DOM：只实现 image-kind.ts 用到的选择器形状 ----
 * 用到的选择器只有两种：单类（'.post-cover'，走 closest）与「容器类 + 后代 img」
 * （'.markdown-body img'）。节点 = { tag, classes, children, parent }，
 * 文档序即 children 嵌套顺序。 */

function el(tag, classes = [], children = []) {
  const node = { tag, classes, children, parent: null };
  for (const child of children) child.parent = node;
  node.closest = function (selector) {
    const cls = selector.replace(/^\./, '');
    for (let n = this; n; n = n.parent) {
      if (n.classes.includes(cls)) return n;
    }
    return null;
  };
  return node;
}

function* eachDescendant(node) {
  for (const child of node.children) {
    yield child;
    yield* eachDescendant(child);
  }
}

// '.xxx img' 形状：img 的某祖先带 .xxx
function matches(img, selector) {
  const [clsRaw, tag] = selector.split(' ');
  const cls = clsRaw.replace(/^\./, '');
  return img.tag === tag && !!img.closest(`.${cls}`);
}

function rootOf(children) {
  const root = { children };
  root.querySelector = (selector) =>
    [...eachDescendant(root)].find((n) => matches(n, selector)) ?? null;
  root.querySelectorAll = (selector) =>
    [...eachDescendant(root)].filter((n) => matches(n, selector));
  return root;
}

const img = () => el('img');

test('优先级：卡片封面 > 详情页封面 > 正文图，同属多个容器按最具体的算', () => {
  // 卡片封面容器同时嵌在正文里
  const cardImg = img();
  const cardCover = el('div', ['post-card-cover'], [cardImg]);
  el('div', ['markdown-body'], [cardCover]);
  assert.equal(imageKindOf(cardImg), 'card-cover');

  // 详情页封面容器同时嵌在正文里
  const coverImg = img();
  const cover = el('div', ['post-cover'], [coverImg]);
  el('div', ['markdown-body'], [cover]);
  assert.equal(imageKindOf(coverImg), 'cover');

  // 只落在正文里
  const bodyImg = img();
  el('div', ['markdown-body'], [bodyImg]);
  assert.equal(imageKindOf(bodyImg), 'body');

  // 三个容器都不在
  const otherImg = img();
  el('div', ['somewhere-else'], [otherImg]);
  assert.equal(imageKindOf(otherImg), 'other');
});

test('可放大：正文图与详情页封面可以，卡片封面与其余图不行', () => {
  const mk = (containerClasses) => {
    const i = img();
    el('div', containerClasses, [i]);
    return i;
  };
  assert.equal(isZoomableImage(mk(['markdown-body'])), true);
  assert.equal(isZoomableImage(mk(['post-cover'])), true);
  assert.equal(isZoomableImage(mk(['post-card-cover'])), false);
  assert.equal(isZoomableImage(mk(['somewhere-else'])), false);
});

test('灯箱取图顺序：封面在前，正文图按文档序在后', () => {
  const coverImg = img();
  const cover = el('div', ['post-cover'], [coverImg]);
  const bodyImg1 = img();
  const bodyImg2 = img();
  const cardImg = img();
  const body = el(
    'div',
    ['markdown-body'],
    [bodyImg1, el('div', ['post-card-cover'], [cardImg]), bodyImg2],
  );
  const otherImg = img();
  const root = rootOf([cover, body, el('div', ['somewhere-else'], [otherImg])]);
  assert.deepEqual(zoomableImages(root), [coverImg, bodyImg1, bodyImg2]);
});

test('灯箱取图：没有封面时只取正文图', () => {
  const bodyImg1 = img();
  const bodyImg2 = img();
  const body = el('div', ['markdown-body'], [bodyImg1, bodyImg2]);
  const root = rootOf([body]);
  assert.deepEqual(zoomableImages(root), [bodyImg1, bodyImg2]);
});

test('灯箱取图：封面容器里唯一的图是卡片封面时，按无封面处理', () => {
  const cardImg = img();
  // 卡片封面嵌在详情页封面容器内：按容器查到的「封面图」其实是卡片图，不能收
  const cover = el('div', ['post-cover'], [el('div', ['post-card-cover'], [cardImg])]);
  const bodyImg = img();
  const body = el('div', ['markdown-body'], [bodyImg]);
  const root = rootOf([cover, body]);
  assert.deepEqual(zoomableImages(root), [bodyImg]);
});
