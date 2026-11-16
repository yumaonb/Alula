// tests/quality/all.mjs — 五类代码质量检查的汇总入口
// 用法：node tests/quality/all.mjs（也可由 tests/run.mjs import 后调用）
//
// 五个检查各管一类事，一个进程跑完——分开起进程光 Node 启动就要多花好几秒。
// 任一检查失败 → 整体返回 1（全部走报错拦住）。

import { collect as collectLeaks } from './leaks.mjs';
import { collect as collectDocs } from './docs.mjs';
import { collect as collectContracts } from './contracts.mjs';
import { collect as collectTransition } from './transition.mjs';
import { collect as collectRegistry } from './registry.mjs';
import { runCheck, isMain } from './lib/common.mjs';

const CHECKS = [
  {
    title: 'check-leaks',
    fn: collectLeaks,
    hint: '这些是 AGENTS 里明令禁止的写法。确实需要豁免时，在该行行尾写 "// check-leaks: allow" 并写清理由。',
  },
  {
    title: 'check-docs',
    fn: collectDocs,
    hint: '文档里的路径与命令必须真实存在（AGENTS §11）。修文档，或把文件补上。',
  },
  {
    title: 'check-contracts',
    fn: collectContracts,
    hint: '这些是「有声明没人用」的死代码。真需要留（例如给将来用），在那一行写 "// check-contracts: allow" 并写清理由。',
  },
  {
    title: 'check-transition',
    fn: collectTransition,
    hint: '切页转场词汇表已焊死：「站住」的情况在 posts-shell.ts 加 is-transition-still 标记；global.css 与 posts/shell.css 转场块禁止引用行变体类等原因类。',
  },
  {
    title: 'gen-registry',
    fn: collectRegistry,
    hint: '组件清单与代码不一致：新增组件要在 COMPONENTS.md 登记（含水合指令）；删除组件要从清单里删掉。',
  },
];

/** 跑完全部质检，返回 0（全过）/ 1（有失败） */
export function runQuality() {
  const failed = [];
  for (const check of CHECKS) {
    if (runCheck(check.title, check.fn, { hint: check.hint }) !== 0) failed.push(check.title);
  }
  return failed.length === 0 ? 0 : 1;
}

if (isMain(import.meta.url)) process.exit(runQuality());
