// tests/run.mjs — 收工门禁：格式 + 代码质量 + 业务行为 + 类型
// 用法：pnpm verify
//
// 两类检测分开跑，失败时能一眼看出是哪一类出的问题：
//   quality  —— 代码写得合不合规范（调试残留、死代码、文档与代码不一致……）
//   behavior —— 业务逻辑对不对（分类树、URL 构造、导航判定……）
//
// 顺序：质检 → 格式 → 行为 → 类型检查。astro check 最慢，放最后，
// 前面几秒就能失败的先跑，不用白等。

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runQuality } from './quality/all.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const STEPS = [
  { name: 'format:check', cmd: 'pnpm', args: ['exec', 'prettier', '--check', '.'] },
  { name: 'test:behavior', cmd: 'node', args: ['--test', 'tests/behavior/*.test.mjs'] },
  { name: 'astro check', cmd: 'pnpm', args: ['exec', 'astro', 'check'] },
];

const failed = [];

/** 跑步骤：中途失败就记下来，能继续的继续（一次看到所有问题比一次修一个省事） */
function runStep(step) {
  console.log(`\n── ${step.name} ──`);
  const res = spawnSync(step.cmd, step.args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) failed.push(step.name);
}

console.log('\n── quality（代码质量）──');
if (runQuality() !== 0) failed.push('quality');

runStep(STEPS[0]);
runStep(STEPS[1]);
runStep(STEPS[2]);

console.log('');
if (failed.length === 0) {
  console.log('全部通过。');
  process.exit(0);
}

console.log(`失败步骤：${failed.join('、')}`);
console.log('');
console.log('收尾流程：pnpm format → pnpm verify → pnpm build');
process.exit(1);
