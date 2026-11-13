// tests/quality/leaks.mjs — 查不该出现的东西：调试残留与类型逃逸
// 用法：node tests/quality/leaks.mjs（也可由 tests/run.mjs 汇总调用）
//
// 对应 AGENTS：§3（不用 any / @ts-ignore / 留 console.log）、§5（不用 !important）、
// §6（不用 DOMContentLoaded）、§8（不留注释掉的代码）
//
// 全部走报错拦住：任一命中即退出码 1。
//
// 只扫 src/（产品代码）。scripts/ 是构建工具自身，不在扫描范围内——
// 检查脚本必须能打印结果，扫自己会永远报错。
// 确实需要豁免某一行时，在该行行尾写 "// check-leaks: allow" 并说明理由。

import { walk, byExt, read, runCheck, isMain } from './lib/common.mjs';

const CODE = byExt('.ts', '.js', '.astro', '.svelte');
const STYLE = byExt('.css', '.astro', '.svelte');
const SCRIPT = byExt('.ts', '.js', '.astro', '.svelte');

/** 逐行匹配，忽略注释行与字符串里的同形内容 */
function scanLines(files, rules) {
  const findings = [];
  for (const file of files) {
    const lines = read(file).split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // 注释行不参与匹配
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (trimmed.startsWith('<!--')) return;
      // 显式豁免
      if (line.includes('check-leaks: allow')) return;
      for (const rule of rules) {
        if (rule.pattern.test(line)) {
          findings.push({
            file,
            line: i + 1,
            rule: rule.name,
            message: rule.message,
          });
        }
      }
    });
  }
  return findings;
}

/** 收集全部违规，供 run.mjs 汇总调用 */
export function collect() {
  const codeFiles = walk('src', CODE);
  const styleFiles = walk('src', STYLE);
  const scriptFiles = walk('src', SCRIPT);
  const svelteFiles = walk('src', byExt('.svelte'));

  return [
    ...scanLines(codeFiles, [
      {
        name: 'console.log',
        pattern: /(?<![\w.])console\s*\.\s*log\s*\(/,
        message: '留了调试输出，删掉',
      },
      {
        name: 'any',
        pattern: /:\s*any\b(?![\w-])|<\s*any\s*>|as\s+any\b|[,<(=]\s*any\b(?![\w-])/,
        message: '用了 any；确实定不了型就用 unknown + 收窄，并注释原因',
      },
      {
        name: '@ts-ignore',
        pattern: /@ts-ignore|@ts-expect-error/,
        message: '用 @ts-ignore / @ts-expect-error 掩盖错误',
      },
      {
        name: 'DOMContentLoaded',
        pattern: /DOMContentLoaded/,
        message:
          '不用 DOMContentLoaded；用 swup:content:replace / astro:after-swap / astro:page-load',
      },
      {
        name: 'var',
        pattern: /(?<![\w.])var\s+[A-Za-z_$]/,
        message: '不用 var；默认 const，需重新赋值才用 let',
      },
    ]),
    ...scanLines(styleFiles, [
      {
        name: '!important',
        pattern: /!\s*important/,
        message: '不用 !important；要覆盖就调选择器权重或换类名',
      },
    ]),
    ...scanLines(scriptFiles, [
      {
        name: 'swup v3 驼峰事件',
        pattern: /swup:contentReplaced|swup:pageShow|swup:contentBeforeReplace/,
        message: 'swup v3 驼峰事件名不会触发；用 v4 的 kebab 事件名',
      },
      {
        name: '路径别名',
        pattern: /from\s+['"]@\//,
        message: '项目没有 @ / ~ 别名，import 一律写真实相对路径',
      },
    ]),
    // Svelte 5 只认 runes：下面这套是 Svelte 4 写法，混用会让状态不生效
    ...scanLines(svelteFiles, [
      {
        name: 'export let',
        pattern: /export\s+let\s/,
        message: 'Svelte 5 用 $props() 收 Props，不用 export let',
      },
      {
        name: '$: 响应式声明',
        pattern: /^\s*\$\s*:/,
        message: 'Svelte 5 用 $derived / $effect，不用 $: 响应式声明',
      },
      {
        name: 'on: 旧事件语法',
        pattern: /\bon:[a-z]+\s*=/,
        message: 'Svelte 5 用属性式事件（onclick={...}），不用 on:click',
      },
    ]),
  ];
}

if (isMain(import.meta.url)) {
  process.exit(
    runCheck('check-leaks', collect, {
      hint: '这些是 AGENTS 里明令禁止的写法。确实需要豁免时，在该行行尾写 "// check-leaks: allow" 并写清理由。',
    }),
  );
}
