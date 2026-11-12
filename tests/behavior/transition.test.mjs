// tests/behavior/transition.test.mjs — 文章目录退场共享核心（playTocExit）的行为测试
// 用法：pnpm test:behavior
//
// A-14：文章→列表 与 文章↔文章 两条目录退场路径原先各写一份高度相似代码，现都调用
// 同一个 playTocExit。这里钉住「两条路径对旧目录克隆做的动作完全一致」：克隆钉到当前
// 视口、按同一组 keyframes / 缓动播放位移 + 渐隐、尾动画播完移除克隆；只有「文章↔文章」
// 在退场完成后额外启动新目录落位等待（startTocEntryWait），「文章→列表」不启动；
// 退场被 cancel（快速连切）时两者都不启动、克隆不残留。
//
// transition.ts 依赖浏览器 DOM，无法在 Node 直跑；这里用 registerHooks 内联一个极小的
// ESM 解析钩子，给无扩展名相对 import 补 .ts，使本测试直接 import 真模块，不复制逻辑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
      const hasExt = /\.[a-z0-9]+$/i.test(specifier);
      if (isRelative && !hasExt && context.parentURL) {
        const parent = fileURLToPath(context.parentURL);
        const candidate = path.resolve(path.dirname(parent), `${specifier}.ts`);
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
      throw err;
    }
  },
});

const { createTransition } = await import('../../src/assets/js/posts/transition.ts');
const { PHASE_MS, EASE_EXIT } = await import('../../src/assets/js/posts/transition-tokens.ts');

// 目录克隆（strip.cloneToc 的返回值）：带 rect、可 remove、可写内联样式
function makeEl(rect) {
  return {
    style: { removeProperty() {} },
    isConnected: true,
    removed: false,
    remove() {
      this.removed = true;
    },
    getBoundingClientRect: () => rect ?? { top: 10, left: 20 },
    closest: () => null,
    classList: { contains: () => false },
    parentElement: null,
  };
}

// main#swup 伪元素：按选择器分发，还原 captureOld / playTransition 依赖的探测点
function makeMain({ hasToc, isDetail, hasSearch }) {
  const edge = {
    style: {},
    parentElement: null,
    querySelector: (sel) => (sel === '.posts-header-search' ? (hasSearch ? {} : null) : null),
  };
  return {
    querySelector(sel) {
      if (sel === '.posts-article, .posts-page') return { style: { removeProperty() {} } };
      if (sel === '.posts-header, .posts-breadcrumb') return edge;
      if (sel === '.post-content') return isDetail ? {} : null;
      if (sel === '.posts-page') return !isDetail ? {} : null;
      return null;
    },
    querySelectorAll: (sel) => (sel === '.post-sidebar' && hasToc ? [makeEl()] : []),
  };
}

// 走一遍真实 captureOld + playTransition，返回对 animate 的调用记录与落位等待计数
function runExit({ newToc, newDetail, newSearch }) {
  globalThis.getComputedStyle = () => ({ display: 'block' });
  const tocClone = makeEl({ top: 10, left: 20 });
  let startWait = 0;
  const strip = {
    cloneEdge: () => null,
    cloneToc: () => tocClone,
    cloneBlur: () => null,
    clearClones: () => {},
    tocOffscreenDx: () => 120,
    makeTocEntry: () => () => {},
    startTocEntryWait: () => {
      startWait += 1;
    },
    cancelTocEntryWait: () => {},
  };
  const floatCtl = {
    state: 'hidden',
    active: null,
    settle: () => {},
    finish: () => {},
    allFinished: () => {},
    exitMobile: () => null,
    exitDesktop: () => null,
    enterMobile: () => {},
    enterDesktop: () => {},
    redirect: () => null,
  };
  const anims = [];
  const animate = (el, keyframes, options) => {
    const { promise, resolve, reject } = Promise.withResolvers();
    const ctrl = {
      el,
      keyframes,
      options,
      state: 'paused',
      finished: promise,
      cancel() {
        reject(new Error('cancelled'));
      },
      _resolve: resolve,
    };
    anims.push(ctrl);
    return ctrl;
  };
  let currentMain = null;
  const oldMain = makeMain({ hasToc: true, isDetail: true, hasSearch: false });
  const newMain = makeMain({ hasToc: newToc, isDetail: newDetail, hasSearch: newSearch });
  const transition = createTransition({
    row: () => ({ querySelector: (sel) => (sel === 'main#swup' ? currentMain : null) }),
    strip,
    floatCtl,
    track: (a) => a,
    stopAnims: () => {},
    isMobile: () => false,
    reduceMotion: false,
    tocSlideGate: () => true,
    cancelEarlyNav: () => {},
    animate,
  });
  currentMain = oldMain;
  transition.captureOld();
  currentMain = newMain;
  transition.playTransition();
  return { anims, tocClone, startWait: () => startWait };
}

// 断言两条路径对目录克隆的动作一致：恰好两个动画（位移 + 渐隐）、同相位参数、钉视口
function assertSameTocExit({ anims, tocClone }) {
  const list = anims.filter((a) => a.el === tocClone);
  assert.equal(list.length, 2);
  const [move, fade] = list;
  const opts = { duration: PHASE_MS / 1000, ease: EASE_EXIT, autoplay: false };
  assert.deepEqual(move.keyframes, { x: [0, '120px'] });
  assert.deepEqual(move.options, opts);
  assert.deepEqual(fade.keyframes, { opacity: [1, 0] });
  assert.deepEqual(fade.options, opts);
  assert.equal(tocClone.style.position, 'fixed');
  assert.equal(tocClone.style.top, '10px');
  assert.equal(tocClone.style.left, '20px');
  return [move, fade];
}

test('文章→列表：目录克隆钉视口、位移+渐隐同相位、播完移除，且不启动落位等待', async () => {
  const { anims, tocClone, startWait } = runExit({
    newToc: false,
    newDetail: false,
    newSearch: true,
  });
  const [move] = assertSameTocExit({ anims, tocClone });
  move._resolve();
  await new Promise((r) => setImmediate(r));
  assert.equal(tocClone.removed, true);
  assert.equal(startWait(), 0);
});

test('文章↔文章：退场动画与上一条路径完全一致，退场完成后才启动落位等待', async () => {
  const { anims, tocClone, startWait } = runExit({
    newToc: true,
    newDetail: true,
    newSearch: false,
  });
  const [move] = assertSameTocExit({ anims, tocClone });
  assert.equal(startWait(), 0, '退场未完成前不应启动落位等待');
  move._resolve();
  await new Promise((r) => setImmediate(r));
  assert.equal(tocClone.removed, true);
  assert.equal(startWait(), 1);
});

test('退场被 cancel（快速连切）：落位等待不启动、克隆不残留', async () => {
  const { anims, tocClone, startWait } = runExit({
    newToc: true,
    newDetail: true,
    newSearch: false,
  });
  const [move] = assertSameTocExit({ anims, tocClone });
  move.cancel();
  await new Promise((r) => setImmediate(r));
  assert.equal(startWait(), 0);
  assert.equal(tocClone.removed, false);
});
