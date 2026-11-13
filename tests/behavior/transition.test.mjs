// tests/behavior/transition.test.mjs — 左缘条带「模糊变过去」转场的行为测试
// 用法：pnpm test:behavior
//
// 钉住条带交换（列表页头 ↔ 面包屑）的三动画契约：旧条带原地渐隐（160ms、EASE_EXIT）、
// 新条带原地渐显（260ms、EASE_ENTRY）、静态 blur(4px) 副本同步渐隐（260ms、EASE_ENTRY），
// 全部纯 alpha、不写 filter 关键帧；目标普通页直接移除旧克隆、0 动画；
// reduceMotion 不建模糊副本。搜索框不参与转场：切页后 settle 直接落位显隐
//（列表系界面显示、其他隐藏）。
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

// 时长 / 缓动与 transition.ts 内联的常量一致；那边改这里同步改
const EASE_EXIT = [0.4, 0, 1, 1];
const EASE_ENTRY = [0, 0, 0.2, 1];

// 模拟元素：可写内联样式、可移除
function makeEl() {
  return {
    style: {},
    removed: false,
    remove() {
      this.removed = true;
    },
  };
}

// 新条带：模拟 .posts-header-search 探测（决定 settle 的入参）
function makeNewEdge(hasSearch) {
  const el = makeEl();
  el.querySelector = (sel) => (sel === '.posts-header-search' ? (hasSearch ? {} : null) : null);
  return el;
}

// 走一遍真实 captureOld + playTransition，返回 animate 调用记录与 settle 调用记录
function run({ hasOldEdge, hasNewEdge, newSearch, reduceMotion }) {
  const oldEdge = makeEl();
  const edgeClone = makeEl();
  const blurClone = makeEl();
  const newEdge = hasNewEdge ? makeNewEdge(newSearch) : null;
  const main = {
    querySelector: (sel) =>
      sel === '.posts-header, .posts-breadcrumb' ? (hasOldEdge ? oldEdge : null) : null,
  };
  const strip = {
    cloneEdge: () => edgeClone,
    cloneBlur: () => blurClone,
    clearClones: () => {},
  };
  const settles = [];
  const floatCtl = {
    state: 'hidden',
    settle: (show) => {
      settles.push(show);
    },
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
  const transition = createTransition({
    row: () => ({
      querySelector: (sel) => {
        if (sel === 'main#swup') return main;
        if (sel === 'main#swup .posts-header, main#swup .posts-breadcrumb') return newEdge;
        return null;
      },
    }),
    strip,
    floatCtl,
    track: (a) => a,
    stopAnims: () => {},
    reduceMotion,
    cancelEarlyNav: () => {},
    animate,
  });
  transition.captureOld();
  transition.playTransition();
  return { anims, edgeClone, blurClone, newEdge, settles };
}

const tick = () => new Promise((r) => setImmediate(r));

test('条带→条带：恰好 3 个动画（旧带渐隐/新带渐显/模糊副本渐隐），纯 alpha，两个克隆播完移除', async () => {
  const { anims, edgeClone, blurClone, newEdge, settles } = run({
    hasOldEdge: true,
    hasNewEdge: true,
    newSearch: true,
    reduceMotion: false,
  });
  assert.equal(anims.length, 3);
  const [out, blur, inFade] = anims;
  assert.equal(out.el, edgeClone);
  assert.deepEqual(out.keyframes, { opacity: [1, 0] });
  assert.deepEqual(out.options, { duration: 0.16, ease: EASE_EXIT, autoplay: false });
  assert.equal(edgeClone.style.filter, 'none');
  assert.equal(blur.el, blurClone);
  assert.deepEqual(blur.keyframes, { opacity: [1, 0] });
  assert.deepEqual(blur.options, { duration: 0.26, ease: EASE_ENTRY, autoplay: false });
  assert.equal(blurClone.style.filter, 'blur(4px)');
  assert.equal(inFade.el, newEdge);
  assert.deepEqual(inFade.keyframes, { opacity: [0, 1] });
  assert.deepEqual(inFade.options, { duration: 0.26, ease: EASE_ENTRY, autoplay: false });
  // 延迟起播的空窗帧先同步钉不可见
  assert.equal(newEdge.style.opacity, '0');
  out._resolve();
  blur._resolve();
  await tick();
  assert.equal(edgeClone.removed, true);
  assert.equal(blurClone.removed, true);
  assert.equal(newEdge.removed, false);
  assert.deepEqual(settles, [true]);
});

test('目标普通页（无新条带）：旧克隆直接移除、0 动画，settle 隐藏搜索框', () => {
  const { anims, edgeClone, settles } = run({
    hasOldEdge: true,
    hasNewEdge: false,
    newSearch: false,
    reduceMotion: false,
  });
  assert.equal(anims.length, 0);
  assert.equal(edgeClone.removed, true);
  assert.deepEqual(settles, [false]);
});

test('无旧条带（普通页进文章区）：0 动画、新条带直接就位，settle 按新界面落位', () => {
  const { anims, edgeClone, newEdge, settles } = run({
    hasOldEdge: false,
    hasNewEdge: true,
    newSearch: true,
    reduceMotion: false,
  });
  assert.equal(anims.length, 0);
  assert.equal(edgeClone.removed, false);
  assert.equal(newEdge.removed, false);
  assert.deepEqual(settles, [true]);
});

test('reduceMotion：不建模糊副本，只剩旧带渐隐 + 新带渐显两个 alpha 动画', () => {
  const { anims, blurClone, settles } = run({
    hasOldEdge: true,
    hasNewEdge: true,
    newSearch: false,
    reduceMotion: true,
  });
  assert.equal(anims.length, 2);
  assert.equal(blurClone.style.filter, undefined);
  assert.equal(blurClone.removed, false);
  assert.deepEqual(
    anims.map((a) => a.keyframes),
    [{ opacity: [1, 0] }, { opacity: [0, 1] }],
  );
  assert.deepEqual(settles, [false]);
});
