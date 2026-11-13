// tests/behavior/expand-collapse.test.mjs — 展开/收起共享编排（toggleGroup）的行为测试
// 用法：pnpm test:behavior
//
// 全站「开窗露内容」的展开/收起动效统一走 util/expand-collapse.ts：窗口（max-height）与刚体
// （translateY）同曲线同长，从「飞行中读数」走到端点，子项任何一帧都不被压缩。
// 这里钉住编排口径：读数先于 cancel 与翻状态（翻状态后 computed 即端点值）、
// 窗口与刚体必须同时长同缓动、中途重触发从屏幕实际位置接续、减动效偏好直接落位。
//
// util/motion 动态引入的 ./motion-runtime 是 54 KB 的真 motion 包，这里用
// registerHooks 把它重定向到内联假模块（记录 animate 的调用与 cancel），
// 无扩展名的相对 import 补 .ts，使本测试直接 import 真模块，不复制逻辑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 假 motion 运行时：记录每次 animate 的关键帧 / 选项，control 可跟踪 cancel
const FAKE_MOTION = `
globalThis.__motionCalls = [];
globalThis.__motionControls = [];
export function animate(el, keyframes, options) {
  const control = { el, keyframes, options, cancelled: false, cancel() { this.cancelled = true; } };
  globalThis.__motionCalls.push(control);
  globalThis.__motionControls.push(control);
  return control;
}
`;
const FAKE_MOTION_URL = `data:text/javascript;base64,${Buffer.from(FAKE_MOTION).toString('base64')}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './motion-runtime') {
      return { url: FAKE_MOTION_URL, shortCircuit: true };
    }
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

// toggleGroup 每次调用现读 window.matchMedia（模块顶层不碰 window，注入在 import 之前即可）
let matchReduce = false;
globalThis.window = {
  matchMedia: (q) => ({ matches: q.includes('prefers-reduced-motion') && matchReduce }),
};

// 假元素：computed 按当前值动态输出，模拟「翻类后 computed 立刻变端点」
function makeWrap(maxHeight) {
  let mh = maxHeight;
  return {
    style: {},
    setMaxHeight(v) {
      mh = v;
    },
    get computed() {
      return { transform: 'none', getPropertyValue: (p) => (p === 'max-height' ? `${mh}px` : '') };
    },
  };
}

function makeClip(y) {
  let ty = y;
  return {
    style: { transform: '' },
    setY(v) {
      ty = v;
    },
    get computed() {
      return { transform: `matrix(1, 0, 0, 1, 0, ${ty})` };
    },
  };
}

globalThis.getComputedStyle = (el) => el.computed;

const { toggleGroup, GROUP_DURATION, GROUP_EASE } =
  await import('../../src/assets/js/util/expand-collapse.ts');

// 触发 motion 的懒加载，让真代码走进 motion 分支（假模块此时才初始化记录数组）
const { preloadMotion } = await import('../../src/assets/js/util/motion.ts');
await preloadMotion();

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('展开：窗口与刚体从「飞行中读数」走到端点，同时长同缓动', () => {
  const wrap = makeWrap(0);
  const clip = makeClip(-100);
  let stateFlipped = false;
  globalThis.__motionCalls.length = 0;

  toggleGroup({
    wrap,
    clip,
    height: 100,
    open: true,
    onState: () => {
      stateFlipped = true;
      // 翻类后 computed 立刻变端点值：若读数发生在翻类之后，起点就会被错写成端点
      wrap.setMaxHeight(100);
      clip.setY(0);
    },
  });

  const calls = globalThis.__motionCalls;
  assert.equal(stateFlipped, true);
  assert.equal(calls.length, 2);

  // 窗口 [0, 100]：起点是翻类前的读数
  assert.equal(calls[0].el, wrap);
  assert.deepEqual(calls[0].keyframes.maxHeight, [0, 100]);
  assert.ok(near(calls[0].options.duration, GROUP_DURATION));
  assert.deepEqual(calls[0].options.ease, GROUP_EASE);

  // 刚体 [-100, 0]：与窗口同时长同缓动，子项任何一帧都不被压缩
  assert.equal(calls[1].el, clip);
  assert.deepEqual(calls[1].keyframes.y, [-100, 0]);
  assert.ok(near(calls[1].options.duration, calls[0].options.duration));
  assert.deepEqual(calls[1].options.ease, calls[0].options.ease);
});

test('中途重触发：读在途值、cancel 旧动画、新动画从屏幕实际位置接续', () => {
  const wrap = makeWrap(0);
  const clip = makeClip(-100);
  globalThis.__motionCalls.length = 0;
  globalThis.__motionControls.length = 0;

  toggleGroup({ wrap, clip, height: 100, open: true, onState: () => {} });
  const firstRound = globalThis.__motionControls.slice();

  // 展开播到一半（窗口 40、刚体 -60），用户改成收起
  wrap.setMaxHeight(40);
  clip.setY(-60);
  globalThis.__motionCalls.length = 0;

  toggleGroup({
    wrap,
    clip,
    height: 100,
    open: false,
    onState: () => {
      wrap.setMaxHeight(0);
      clip.setY(-100);
    },
  });

  const closeCalls = globalThis.__motionCalls;
  assert.equal(closeCalls.length, 2);
  assert.deepEqual(closeCalls[0].keyframes.maxHeight, [40, 0]);
  assert.deepEqual(closeCalls[1].keyframes.y, [-60, -100]);
  for (const control of firstRound) assert.equal(control.cancelled, true);

  // 收起播到一半再展开：同样从屏幕实际位置接续
  wrap.setMaxHeight(20);
  clip.setY(-80);
  globalThis.__motionCalls.length = 0;

  toggleGroup({ wrap, clip, height: 100, open: true, onState: () => {} });

  const openCalls = globalThis.__motionCalls;
  assert.equal(openCalls.length, 2);
  assert.deepEqual(openCalls[0].keyframes.maxHeight, [20, 100]);
  assert.deepEqual(openCalls[1].keyframes.y, [-80, 0]);
});

test('刚体无高度：只翻状态，不播任何动画', () => {
  const wrap = makeWrap(0);
  const clip = makeClip(0);
  let stateFlipped = false;
  globalThis.__motionCalls.length = 0;

  toggleGroup({
    wrap,
    clip,
    height: 0,
    open: true,
    onState: () => {
      stateFlipped = true;
    },
  });

  assert.equal(stateFlipped, true);
  assert.equal(globalThis.__motionCalls.length, 0);
});

test('减动效偏好：时长归零直接落位', () => {
  matchReduce = true;
  try {
    const wrap = makeWrap(0);
    const clip = makeClip(-100);
    globalThis.__motionCalls.length = 0;

    toggleGroup({ wrap, clip, height: 100, open: true, onState: () => {} });

    const calls = globalThis.__motionCalls;
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].keyframes.maxHeight, [0, 100]);
    assert.deepEqual(calls[1].keyframes.y, [-100, 0]);
    for (const call of calls) assert.equal(call.options.duration, 0);
  } finally {
    matchReduce = false;
  }
});
