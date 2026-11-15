// tests/quality/transition.mjs — 盯死 global.css「切页转场」块的稳定词汇表
// 用法：node tests/quality/transition.mjs（也可由 tests/run.mjs 汇总调用）
//
// 对应 AGENTS：§12（强制共变：「谁站住」的决策与 CSS 规则共用单一来源）
//
// 切页转场「谁动谁站住」的决策集中在 posts-shell.ts（元素级 is-transition-still
// 标记，swup:visit:start 标、visit:end 摘），global.css 的「切页转场」块只消费固定
// 词汇表（相位类、is-transition-still、常驻元素类名）。被破坏意味着新增「站住」
// 的情况要去 CSS 加一组选择器，两处从此漂移。全部走报错拦住：
//   1. 转场块内禁止出现行变体类（page-main--*）与原因类（is-post-swap / is-swap-list-list）
//   2. is-transition-still 只允许出现在 posts-shell.ts 与 global.css

import { walk, byExt, read, runCheck, isMain } from './lib/common.mjs';

const GLOBAL_CSS = 'src/assets/css/global.css';
const STILL_MARK = 'is-transition-still';
const STILL_MARK_ALLOWED = new Set(['src/assets/js/posts/posts-shell.ts', GLOBAL_CSS]);
const BANNED_IN_BLOCK = [
  'page-main--listing',
  'page-main--post',
  'page-main--plain',
  'is-post-swap',
  'is-swap-list-list',
];

/** 「切页转场」块的行范围（1 起、含两端）：自区块分隔注释起，到下一个区块分隔注释前 */
function transitionBlockRange() {
  const lines = read(GLOBAL_CSS).split('\n');
  const start = lines.findIndex((l) => l.includes('/* ---- 切页转场'));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('/* ----'));
  return { from: start + 1, to: end < 0 ? lines.length : end };
}

export function collect() {
  const findings = [];
  const lines = read(GLOBAL_CSS).split('\n');
  const range = transitionBlockRange();
  if (!range) {
    findings.push({
      file: GLOBAL_CSS,
      line: 1,
      rule: 'missing-transition-block',
      message: '找不到 /* ---- 切页转场 区块分隔注释，质检无法定位转场块',
    });
  } else {
    for (let i = range.from - 1; i < range.to; i++) {
      for (const banned of BANNED_IN_BLOCK) {
        if (lines[i].includes(banned)) {
          findings.push({
            file: GLOBAL_CSS,
            line: i + 1,
            rule: 'banned-class-in-block',
            message: `转场块引用了 ${banned}；「站住」的情况应在 posts-shell.ts 加标记，CSS 只消费稳定词汇`,
          });
        }
      }
    }
  }
  for (const file of walk('src', byExt('.ts', '.js', '.astro', '.svelte'))) {
    if (STILL_MARK_ALLOWED.has(file)) continue;
    read(file)
      .split('\n')
      .forEach((line, i) => {
        if (line.includes(STILL_MARK)) {
          findings.push({
            file,
            line: i + 1,
            rule: 'still-mark-outside-vocab',
            message: 'is-transition-still 只允许出现在 posts-shell.ts 与 global.css',
          });
        }
      });
  }
  return findings;
}

if (isMain(import.meta.url)) {
  process.exit(
    runCheck('check-transition', collect, {
      hint: '切页转场词汇表已焊死：「站住」的情况在 posts-shell.ts 加 is-transition-still 标记；global.css 转场块禁止引用行变体类等原因类。',
    }),
  );
}
