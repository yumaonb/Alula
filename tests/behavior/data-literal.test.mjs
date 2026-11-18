// tests/behavior/data-literal.test.mjs — ts-literal 解析/写回的往返测试
// 用法：pnpm test:behavior
//
// 后台数据页靠 ts-literal.ts 读 src/data 的导出、再按表单值写回。
// 这里用真实配置文件钉两条性质：
// 一、每个导出的值替换后重新解析语义相等，重复替换结果不变（幂等）；
// 二、配置结构演化（加字段 / 加导航键 / 特殊字符串）不会让解析与写回失效。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  deepEqual,
  extractExport,
  replaceLiteral,
} from '../../src/pages/admin/_admin/js/ts-literal.ts';

// 与 data-schemas.ts 各页用到的导出名一致
const EXPORTS = {
  background: ['background'],
  config: ['features'],
  dayscounter: ['daysCounterConfig'],
  friends: ['friends'],
  github: [
    'giscusRepo',
    'giscusRepoId',
    'giscusCategoryId',
    'giscusCategory',
    'projectOwner',
    'adminRepo',
  ],
  nav: ['navConfig'],
  profile: ['nickname', 'motto', 'intro'],
  quotes: ['quotes'],
  site: ['site'],
  'social-links': ['socialLinks'],
  sponsor: ['sponsorLink', 'sponsorList', 'supportActions'],
  techstack: ['techStack'],
  timeline: ['timeline'],
  tools: ['toolCategories'],
};

async function readData(file) {
  return readFile(fileURLToPath(new URL(`../../src/data/${file}.ts`, import.meta.url)), 'utf8');
}

for (const [file, names] of Object.entries(EXPORTS)) {
  test(`${file}.ts 各导出写回后语义不变且幂等`, async () => {
    const source = await readData(file);
    for (const name of names) {
      const value = extractExport(source, name)?.value;
      assert.notEqual(value, undefined, `${name} 没解析出来`);
      const once = replaceLiteral(source, name, value);
      assert.ok(once, `${name} 写回失败`);
      assert.ok(deepEqual(extractExport(once, name)?.value, value), `${name} 写回后语义变了`);
      assert.equal(replaceLiteral(once, name, value), once, `${name} 重复写回结果不一致`);
    }
  });
}

test('github.ts：表达式导出不碰，改一个导出时其余行原样保留', async () => {
  const source = await readData('github');
  assert.equal(extractExport(source, 'cacheTTL'), null);

  const repoLine = source.split('\n').find((line) => line.startsWith('export const giscusRepoId'));
  const next = replaceLiteral(source, 'adminRepo', 'someone/else');
  assert.ok(next, 'adminRepo 写回失败');
  assert.equal(extractExport(next, 'adminRepo').value, 'someone/else');
  assert.ok(next.includes(repoLine), 'giscusRepoId 那一行被动了');
  assert.ok(next.includes('export const cacheTTL = 60 * 60 * 1000;'), 'cacheTTL 表达式被动了');
});

test('config.ts：features 加一个新字段后写回，新字段仍在', async () => {
  const source = await readData('config');
  const next = structuredClone(extractExport(source, 'features').value);
  next.pages.extraPage = true;
  const out = replaceLiteral(source, 'features', next);
  assert.ok(out, 'features 写回失败');
  assert.equal(extractExport(out, 'features').value.pages.extraPage, true);
});

test('nav.ts：record 加一个新键后往返不丢', async () => {
  const source = await readData('nav');
  const next = {
    ...extractExport(source, 'navConfig').value,
    extra: { label: '测试', icon: 'la:flask' },
  };
  const out = replaceLiteral(source, 'navConfig', next);
  assert.ok(out, 'navConfig 写回失败');
  assert.ok(deepEqual(extractExport(out, 'navConfig').value, next));
});

test('字符串转义：单引号 / 双引号 / 换行 / 反斜杠 / 中文往返不变', () => {
  const value = `单引号 ' 双引号 "
换行 反斜杠 \\ 还有 中文`;
  const source = "export const a = 'old';";
  const out = replaceLiteral(source, 'a', value);
  assert.ok(out, '字符串写回失败');
  assert.equal(extractExport(out, 'a').value, value);
  assert.equal(replaceLiteral(out, 'a', value), out);
});

test('文件其余内容（注释、接口、别的导出）一字不动', () => {
  const source = [
    '// 文件头注释',
    'export interface T {',
    '  a: string;',
    '}',
    '',
    "export const a = 'old';",
    '',
    'export const b = 1;',
  ].join('\n');
  assert.equal(replaceLiteral(source, 'a', 'new'), source.replace("'old'", "'new'"));
});
