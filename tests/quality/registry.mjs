// tests/quality/registry.mjs — 从代码生成清单，并校验文档里的清单与代码一致
// 用法：
//   node tests/quality/registry.mjs           只校验（不改文件），有出入就报错
//   node tests/quality/registry.mjs --write   重新生成 docs/REGISTRY.md（组件 / CSS 类 / window 标记清单）
//
// 对应 AGENTS：§4（新组件登记进 COMPONENTS.md）、§5（新增可复用类清单重新生成进 docs/REGISTRY.md）、
// §6（window 标记在 env.d.ts 声明）、§11（文档与代码一致）
//
// 全部走报错拦住：清单与代码有出入即退出码 1。
//
// 为什么不直接生成 COMPONENTS.md：那张表的「用途」列是人写的，脚本生成不了。
// 所以只生成机器可核的部分（有哪些组件、什么水合指令、有哪些 CSS 类、有哪些
// window 标记），文档里的清单则由本脚本反向校验——两者不一致时报错。

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { walk, byExt, read, root, runCheck, isMain } from './lib/common.mjs';

const COMPONENT_DIRS = ['src/components', 'src/layouts'];
const COMPONENT_EXT = byExt('.astro', '.svelte');
const CSS_EXT = byExt('.css');

/** 组件清单：从代码里抽出路径与水合指令 */
function collectComponents() {
  const out = [];
  for (const dir of COMPONENT_DIRS) {
    for (const file of walk(dir, COMPONENT_EXT)) {
      const text = read(file);
      const name = file.split('/').pop();
      // 相对 src/ 的路径：components/layout/NavBar.astro（与文档里的写法一致）
      const relToSrc = file.replace(/^src\//, '');
      // 水合指令：只看模板里的 client:* 属性
      const directives = [
        ...new Set(
          [...text.matchAll(/client:(load|idle|visible|media|only)/g)].map((m) => `client:${m[1]}`),
        ),
      ];
      out.push({
        path: relToSrc.split('/').slice(0, -1).join('/'),
        file: name,
        kind: file.endsWith('.svelte') ? 'svelte' : 'astro',
        directives,
      });
    }
  }
  return out;
}

/** CSS 类清单：全局 CSS 文件里定义的选择器 */
function collectCssClasses() {
  const classes = new Map();
  for (const file of walk('src/assets/css', CSS_EXT)) {
    // 注释、@import 路径、url() 里的文件名都不是类名，先剥掉再扫：
    // 注释里常写 `global.css`，@import 写 './variables.css'，不剥会扫出
    // `.css` / `.variables` 这类假类名。
    const text = read(file)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@import[^;]*;/g, '')
      .replace(/url\([^)]*\)/g, '');
    for (const m of text.matchAll(/\.([a-z][a-z0-9-]{2,})\b/g)) {
      if (!classes.has(m[1])) classes.set(m[1], new Set());
      classes.get(m[1]).add(file);
    }
  }
  return classes;
}

/** window 标记：代码里用到的 vs env.d.ts 里声明的 */
function collectWindowMarkers() {
  const used = new Map();
  for (const file of walk('src', byExt('.ts', '.js', '.astro', '.svelte'))) {
    const text = read(file);
    for (const m of text.matchAll(/window\.(__[A-Za-z0-9_]+)/g)) {
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(file);
    }
  }
  const envText = read('src/env.d.ts');
  const declared = new Set([...envText.matchAll(/(__[A-Za-z0-9_]+)\??\s*:/g)].map((m) => m[1]));
  return { used, declared };
}

/** 文档里的组件清单路径 */
function docComponentPaths(text) {
  const set = new Set();
  for (const m of text.matchAll(/`(components\/[A-Za-z0-9_\-./]+\.(?:astro|svelte))`/g)) {
    set.add(m[1]);
  }
  return set;
}

export function collect() {
  const findings = [];

  // --- 1. 组件清单：文档里列的组件必须都存在，且文件都已被登记 ---
  const components = collectComponents();
  const docText = read('docs/reference/COMPONENTS.md');
  const docPaths = docComponentPaths(docText);
  const codePaths = new Set(components.map((c) => `${c.path}/${c.file}`));

  // 布局不属于「组件清单」，它们登记在 ARCHITECTURE.md 里，分开校验
  const isLayout = (p) => p.startsWith('layouts/');
  const layoutPaths = new Set([...codePaths].filter(isLayout));
  const componentPaths = new Set([...codePaths].filter((p) => !isLayout(p)));

  for (const p of docPaths) {
    if (!codePaths.has(p)) {
      findings.push({
        file: 'docs/reference/COMPONENTS.md',
        rule: '清单多出',
        message: `文档列了 ${p}，但代码里没有这个文件（已删除或改名？）`,
      });
    }
  }
  for (const p of componentPaths) {
    if (!docPaths.has(p)) {
      findings.push({
        file: 'docs/reference/COMPONENTS.md',
        rule: '清单缺失',
        message: `代码里有 ${p}，但组件清单里没有登记（AGENTS §4 要求登记）`,
      });
    }
  }

  // 布局登记在 ARCHITECTURE.md
  const archText = read('docs/reference/ARCHITECTURE.md');
  for (const p of layoutPaths) {
    const name = p.split('/').pop();
    if (!archText.includes(name)) {
      findings.push({
        file: 'docs/reference/ARCHITECTURE.md',
        rule: '布局未登记',
        message: `代码里有 ${p}，但架构文档里没提到它`,
      });
    }
  }

  // --- 2. Svelte 组件的水合指令必须与文档一致 ---
  for (const c of components) {
    if (c.kind !== 'svelte') continue;
    const key = `${c.path}/${c.file}`;
    // 在文档里找这一行（按路径定位，不要求该行含 client:，否则「代码有指令、文档漏写」会静默通过）
    const row = docText.split('\n').find((l) => l.includes(`\`${key}\``));
    if (!row) continue;
    const docDirectives = [
      ...new Set([...row.matchAll(/`(client:[a-z]+)`/g)].map((m) => m[1])),
    ].sort();
    const codeDirectives = [...c.directives].sort();
    if (docDirectives.join(',') !== codeDirectives.join(',')) {
      findings.push({
        file: 'docs/reference/COMPONENTS.md',
        rule: '水合指令不符',
        message: `${key}：文档写 ${docDirectives.join('/') || '（无）'}，代码用 ${codeDirectives.join('/') || '（无）'}`,
      });
    }
  }

  // --- 3. window 标记必须在 env.d.ts 声明 ---
  const { used, declared } = collectWindowMarkers();
  for (const [marker, files] of used) {
    if (!declared.has(marker)) {
      findings.push({
        file: [...files][0],
        rule: '标记未声明',
        message: `window.${marker} 没在 src/env.d.ts 的 interface Window 里声明（AGENTS §6）`,
      });
    }
  }
  for (const marker of declared) {
    if (!used.has(marker)) {
      findings.push({
        file: 'src/env.d.ts',
        rule: '标记多余',
        message: `env.d.ts 声明了 window.${marker}，但代码里没人用`,
      });
    }
  }

  return findings;
}

/** 生成机器清单的正文 */
function renderRegistry() {
  const components = collectComponents();
  const classes = collectCssClasses();
  const { used, declared } = collectWindowMarkers();

  const astro = components.filter((c) => c.kind === 'astro');
  const svelte = components.filter((c) => c.kind === 'svelte');

  const lines = [];
  lines.push('# REGISTRY — 机器生成的清单');
  lines.push('');
  lines.push('> 本文件由 `pnpm registry:write` 生成，**不要手工编辑**。');
  lines.push('> 人写的说明在 `docs/reference/COMPONENTS.md`，本文件只列代码里真实存在的东西。');
  lines.push('');
  lines.push(`## Astro 组件（${astro.length}）`);
  lines.push('');
  lines.push('| 路径 |');
  lines.push('| --- |');
  for (const c of astro.sort((a, b) =>
    `${a.path}/${a.file}`.localeCompare(`${b.path}/${b.file}`),
  )) {
    lines.push(`| \`${c.path}/${c.file}\` |`);
  }
  lines.push('');
  lines.push(`## Svelte 组件（${svelte.length}）`);
  lines.push('');
  lines.push('| 路径 | 水合指令 |');
  lines.push('| --- | --- |');
  for (const c of svelte.sort((a, b) =>
    `${a.path}/${a.file}`.localeCompare(`${b.path}/${b.file}`),
  )) {
    lines.push(`| \`${c.path}/${c.file}\` | ${c.directives.join(' / ') || '（未水合）'} |`);
  }
  lines.push('');
  lines.push(`## 全局 CSS 类（${classes.size}）`);
  lines.push('');
  lines.push('| 类名 | 定义于 |');
  lines.push('| --- | --- |');
  for (const [name, files] of [...classes].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`| \`.${name}\` | ${[...files].map((f) => `\`${f}\``).join('、')} |`);
  }
  lines.push('');
  lines.push(`## window 全局标记（${declared.size}）`);
  lines.push('');
  lines.push('| 标记 | 用在 |');
  lines.push('| --- | --- |');
  for (const marker of [...declared].sort()) {
    const files = used.get(marker);
    lines.push(
      `| \`window.${marker}\` | ${files ? [...files].map((f) => `\`${f}\``).join('、') : '（未使用）'} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  // --write 只在直接执行时生效；被 run.mjs 汇总调用时不会误写文件
  if (process.argv.includes('--write')) {
    writeFileSync(join(root(), 'docs/REGISTRY.md'), renderRegistry(), 'utf8');
    console.log('[gen-registry] 已生成 docs/REGISTRY.md');
  }
  process.exit(
    runCheck('gen-registry', collect, {
      hint: '组件清单与代码不一致：新增组件要在 COMPONENTS.md 登记（含水合指令）；删除组件要从清单里删掉。',
    }),
  );
}
