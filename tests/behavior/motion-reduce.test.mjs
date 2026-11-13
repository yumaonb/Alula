// tests/behavior/motion-reduce.test.mjs — animateLazy 统一并入 reduceMotion 的行为测试
// 用法：pnpm test:behavior
//
// A-20：各动画调用点原先各自把 reduceMotion 塞进 options，漏传一处就会让开了
// 「减少动态效果」的用户看到平移动画。现由 animateLazy 每次调用现读
// window.matchMedia 统一并入，这里钉住这条注入链路：偏好开启时真 motion 收到
// reduceMotion: true；偏好关闭后，同一已加载的 motion 单例下一次调用现读到 false。
//
// util/motion 动态引入的 ./motion-runtime 是 54 KB 的真 motion 包，这里用
// registerHooks 把它重定向到内联假模块，记录 animate 收到的 keyframes 与 options。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// 假 motion 运行时：记录每次 animate 的 keyframes 与 options
const FAKE_MOTION = `
globalThis.__motionCalls = [];
export function animate(el, keyframes, options) {
  globalThis.__motionCalls.push({ keyframes, options });
  return { finished: Promise.resolve(), cancel() {}, state: 'finished' };
}
`;
const FAKE_MOTION_URL = `data:text/javascript;base64,${Buffer.from(FAKE_MOTION).toString('base64')}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './motion-runtime') {
      return { url: FAKE_MOTION_URL, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

// animateLazy 每次调用现读 window.matchMedia（motion.ts 模块顶层不碰 window，
// 注入在 import 之前即可）；matchReduce 控制「减少动态效果」的返回值
let matchReduce = false;
globalThis.window = {
  matchMedia: (q) => ({ matches: q.includes('prefers-reduced-motion') && matchReduce }),
};

const { preloadMotion, animateLazy } = await import('../../src/assets/js/util/motion.ts');

test('animateLazy：reduce 开启时向 motion 并入 reduceMotion: true，且后续调用随偏好实时变化', async () => {
  matchReduce = true;
  await preloadMotion();
  const element = { style: {} };

  globalThis.__motionCalls.length = 0;
  animateLazy(
    element,
    { x: [0, '48px'] },
    { duration: 0.32, ease: [0.4, 0, 1, 1], autoplay: false },
  );
  assert.equal(globalThis.__motionCalls.length, 1);
  assert.deepEqual(globalThis.__motionCalls[0].keyframes, { x: [0, '48px'] });
  assert.equal(globalThis.__motionCalls[0].options.reduceMotion, true);

  matchReduce = false;
  globalThis.__motionCalls.length = 0;
  animateLazy(
    element,
    { x: [0, '48px'] },
    { duration: 0.32, ease: [0.4, 0, 1, 1], autoplay: false },
  );
  assert.equal(globalThis.__motionCalls[0].options.reduceMotion, false);
});
