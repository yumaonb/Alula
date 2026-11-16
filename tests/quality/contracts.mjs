// tests/quality/contracts.mjs — 查代码里的「有声明没人用」与「有定义没人读」
// 用法：node tests/quality/contracts.mjs（也可由 tests/run.mjs 汇总调用）
//
// 对应 AGENTS：§2.2（同一名字全项目只表达一个含义）、§4（Props 必须写类型）、
// §11（同一件事只讲一处）
//
// 全部走报错拦住：任一命中即退出码 1。
//
// 查两类：
//   1. 组件的必填 Prop 声明了，但全项目没有调用方传值（组件从未被调用时整体报「组件无人使用」）
//   2. 客户端脚本里导出了函数/常量，但全项目没有 import 方
//
// 第 1 条要区分「有默认值」与「必填」：有默认值的 Prop 即使没人传也能工作，
// 属于可疑但不报错；必填的没人传，属于真死 Prop。

import { walk, byExt, read, componentFiles, runCheck, isMain } from './lib/common.mjs';

const COMPONENT_FILES = componentFiles();
const SCRIPT_FILES = walk('src/assets/js', byExt('.ts', '.js')).concat(
  walk('src/pages/admin/_admin/js', byExt('.ts', '.js')),
  walk('src/features', (file) => file.includes('/scripts/') && byExt('.ts', '.js')(file)),
);
const ALL_SOURCE = walk('src', byExt('.ts', '.js', '.astro', '.svelte'));

/** 从 `{` 开始按括号配对取出整块，避免嵌套类型把块截断 */
function matchBlock(text, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(startIdx + 1, i);
    }
  }
  return null;
}

/** 读一个组件文件里的 Prop 声明 */
function readProps(file) {
  const text = read(file);
  const props = [];

  const head = text.match(/interface Props\s*\{/);
  if (!head) return { props, destructure: null };

  const block = matchBlock(text, head.index + head[0].length - 1);
  if (!block) return { props, destructure: null };

  for (const line of block.split('\n')) {
    // 可选标记在名字上（`subtitle?: string`），不在类型上
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)(\?)?\s*:\s*(.+?);?\s*$/);
    if (!m) continue;
    props.push({ name: m[1], optional: m[2] === '?', type: m[3].trim() });
  }

  // 默认值 = 解构时给了兜底。Astro 从 Astro.props 解构，Svelte 从 $props() 解构，
  // 两者都要认，否则 Astro 里写了默认值的 Prop 会被误判成死 Prop。
  const destructure = file.endsWith('.svelte')
    ? (text.match(/let\s*\{([^}]*)\}\s*(?::\s*Props\s*)?=\s*\$props\(\)/)?.[1] ?? null)
    : (text.match(/const\s*\{([^}]*)\}\s*=\s*Astro\.props/)?.[1] ?? null);

  return { props, destructure };
}

/** 组件名 → 调用方传值的 prop 名集合 */
function collectCallSites() {
  const usage = new Map();
  for (const file of ALL_SOURCE) {
    const text = read(file);
    // <ComponentName ... /> 或 <ComponentName ...>
    for (const m of text.matchAll(/<([A-Z][A-Za-z0-9_]*)\b([^>]*)>/g)) {
      const name = m[1];
      const attrs = m[2];
      if (!usage.has(name)) usage.set(name, new Set());
      for (const a of attrs.matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*=/g)) {
        usage.get(name).add(a[1]);
      }
      // 展开传播 {...rest}：该组件所有 prop 都算被传
      if (/\{\.\.\./.test(attrs)) {
        usage.get(name).add('*');
      }
    }
  }
  return usage;
}

/** 脚本里 export 的符号 → 全项目引用次数 */
function collectExports() {
  const exports = [];
  for (const file of SCRIPT_FILES) {
    const text = read(file);
    for (const m of text.matchAll(
      /export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g,
    )) {
      exports.push({ file, name: m[1] });
    }
    for (const m of text.matchAll(/export\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        if (name) exports.push({ file, name });
      }
    }
  }
  return exports;
}

function countReferences(name) {
  let count = 0;
  for (const file of ALL_SOURCE) {
    // 注释里提到某名字不算「使用」：剥掉行注释与块注释再数，避免把只出现在注释里的导出误判成在用
    const text = read(file)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
      .join('\n');
    const re = new RegExp(`\\b${name}\\b`, 'g');
    const hits = text.match(re);
    if (hits) count += hits.length;
  }
  return count;
}

export function collect() {
  const findings = [];

  // --- 1. 必填 Prop 没人传 ---
  const usage = collectCallSites();
  for (const file of COMPONENT_FILES) {
    const { props, destructure } = readProps(file);
    if (props.length === 0) continue;
    const compName = file
      .split('/')
      .pop()
      .replace(/\.(astro|svelte)$/, '');
    const passed = usage.get(compName);

    for (const p of props) {
      if (p.name === 'children') continue;
      // 有默认值 → 可疑但不报错
      const hasDefault =
        destructure !== null && new RegExp(`\\b${p.name}\\s*=\\s*[^,}]+`).test(destructure);
      if (hasDefault) continue;
      // 可选类型（`foo?: string`）本身就可以不传
      if (p.optional) continue;

      if (!passed) {
        // 组件从未被使用 → 整个组件是死的，单独报
        findings.push({
          file,
          rule: '组件无人使用',
          message: `组件 ${compName} 在项目里没有任何调用方`,
        });
        break;
      }
      if (!passed.has('*') && !passed.has(p.name)) {
        findings.push({
          file,
          rule: '死 Prop',
          message: `${compName} 的 Prop "${p.name}" 没有任何调用方传值`,
        });
      }
    }
  }

  // --- 2. 脚本 export 但没人 import ---
  for (const e of collectExports()) {
    // 该文件本身有一次（声明处），全项目引用次数只有 1 说明没人用
    const refs = countReferences(e.name);
    if (refs <= 1) {
      findings.push({
        file: e.file,
        rule: '导出无人用',
        message: `导出的 ${e.name} 在项目里没有任何地方引用`,
      });
    }
  }

  return findings;
}

if (isMain(import.meta.url)) {
  process.exit(
    runCheck('check-contracts', collect, {
      hint: '这些是「有声明没人用」的死代码，删掉即可；确属有意保留（如预留的公开 API）的，在声明处注释写明保留原因。',
    }),
  );
}
