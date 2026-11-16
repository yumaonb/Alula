// tests/quality/lib/common.mjs — 质检脚本共用的小工具
// 用法：import { walk, read, runCheck, isMain } from './lib/common.mjs'

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** 仓库根：本文件在 tests/quality/lib/ 下，往上三层 */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** 递归列出目录下的所有文件（相对仓库根的 posix 路径） */
export function walk(dir, filter = () => true) {
  const out = [];
  const base = join(ROOT, dir);
  let entries;
  try {
    entries = readdirSync(base);
  } catch {
    return out;
  }
  for (const name of entries) {
    const abs = join(base, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      out.push(...walk(relative(ROOT, abs).replace(/\\/g, '/'), filter));
    } else {
      const rel = relative(ROOT, abs).replace(/\\/g, '/');
      if (filter(rel)) out.push(rel);
    }
  }
  return out;
}

/** 读文件内容 */
export function read(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

/** 仓库根的绝对路径 */
export function root(...parts) {
  return join(ROOT, ...parts);
}

/** 按扩展名筛选文件 */
export function byExt(...exts) {
  const set = new Set(exts);
  return (rel) => set.has(extname(rel));
}

/** 组件扫描共用目录边界；注入路由的页面入口不属于组件调用契约。 */
export function componentFiles() {
  const isComponent = byExt('.astro', '.svelte');
  return walk('src/components', isComponent)
    .concat(walk('src/layouts', isComponent))
    .concat(walk('src/pages/admin/_admin', isComponent))
    .concat(
      walk(
        'src/features',
        (file) =>
          isComponent(file) && /^src\/features\/[^/]+\/(?:components|layouts|_admin)\//.test(file),
      ),
    );
}

/**
 * 调用方是否被直接执行（而不是被 import）：用来兼顾「单独跑」与「汇总跑」。
 * 必须传调用方自己的 import.meta.url——本模块拿到的 url 永远指向 common.mjs 自己。
 */
export function isMain(moduleUrl) {
  const entry = process.argv[1];
  return !!entry && moduleUrl === pathToFileURL(entry).href;
}

/**
 * 收集问题并输出结果。
 * findings: { file, line, rule, message }
 * 只要有 finding 就以退出码 1 结束（全部走报错拦住）。
 */
export function report(title, findings, options = {}) {
  const { hint } = options;
  if (findings.length === 0) {
    console.log(`[${title}] 通过（0 处问题）`);
    return 0;
  }
  console.error(`\n[${title}] 发现 ${findings.length} 处问题：\n`);
  const byFile = new Map();
  for (const f of findings) {
    const key = f.file;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(f);
  }
  for (const [file, list] of byFile) {
    console.error(`  ${file}`);
    for (const f of list) {
      const loc = f.line ? `:${f.line}` : '';
      console.error(`    ${loc}  [${f.rule}] ${f.message}`);
    }
    console.error('');
  }
  if (hint) console.error(hint);
  return 1;
}

/** 统一处理：跑一个检查函数，打印结果，返回 0 / 1 */
export function runCheck(title, fn, options = {}) {
  let findings;
  try {
    findings = fn();
  } catch (err) {
    console.error(`[${title}] 检查脚本自身出错：${err.message}`);
    return 1;
  }
  return report(title, findings, options);
}
