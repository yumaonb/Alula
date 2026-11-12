// astro-code-blocks.ts — 扫描构建产物 HTML 里的 <script>/<style> 块范围，供构建后处理保护内联代码
// 用法：import { splitOutsideCode } from './astro-code-blocks'

/**
 * 扫出 <script>/<style> 块的字符范围（含首尾）。
 * 脚本里的结束标记只在字符串 / 模板串 / 注释之外才认，
 * 内联脚本含 "</script>" 这类字符串字面量时不会把块截短；
 * style 块直接找结束标签（CSS 里没有字符串截断这种语法）。
 * 结束标签缺失时把剩余内容整体当代码——坏块宁可保护也不剥离。
 */
export function codeBlockRanges(html: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let i = 0;
  const len = html.length;
  while (i < len) {
    const open = html.indexOf('<', i);
    if (open === -1) break;
    const tag = matchCodeTag(html, open);
    if (!tag) {
      i = open + 1;
      continue;
    }
    const close = findCodeClose(html, tag.contentStart, tag.kind);
    if (close === -1) {
      ranges.push([open, len]);
      break;
    }
    const tagEnd = html.indexOf('>', close);
    const end = tagEnd === -1 ? len : tagEnd + 1;
    ranges.push([open, end]);
    i = end;
  }
  return ranges;
}

/** 按代码块边界切开：偶数下标是代码外的片段，奇数下标是代码块本身 */
export function splitOutsideCode(html: string): string[] {
  const parts: string[] = [];
  let cursor = 0;
  for (const [start, end] of codeBlockRanges(html)) {
    parts.push(html.slice(cursor, start), html.slice(start, end));
    cursor = end;
  }
  parts.push(html.slice(cursor));
  return parts;
}

/** 识别给定位置的 <script> / <style> 开标签；标签结束是引号外的第一个 > */
function matchCodeTag(
  html: string,
  open: number,
): { kind: 'script' | 'style'; contentStart: number } | null {
  const name = /^(script|style)(?=[\s/>])/i.exec(html.slice(open + 1));
  if (!name) return null;
  const kind = name[1].toLowerCase() as 'script' | 'style';
  let quote: string | null = null;
  for (let j = open + 1; j < html.length; j++) {
    const ch = html[j];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return { kind, contentStart: j + 1 };
    }
  }
  return null;
}

/**
 * 找结束标签的下标。script 先走一遍轻量词法扫描：
 * 字符串 / 模板串 / 注释 / 正则字面量里出现的 </script> 不算数。
 */
function findCodeClose(html: string, from: number, kind: 'script' | 'style'): number {
  if (kind === 'style') {
    const idx = html.toLowerCase().indexOf('</style', from);
    return idx === -1 ? -1 : idx;
  }
  const len = html.length;
  let i = from;
  let mode: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tpl' = 'code';
  let tplDepth = 0;
  let exprBraces = 0;
  let prevSignificant = '';
  while (i < len) {
    const ch = html[i];
    const next = i + 1 < len ? html[i + 1] : '';
    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        mode = 'line';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        mode = 'block';
        i += 2;
        continue;
      }
      if (ch === "'") {
        mode = 'sq';
        i++;
        continue;
      }
      if (ch === '"') {
        mode = 'dq';
        i++;
        continue;
      }
      if (ch === '`') {
        mode = 'tpl';
        tplDepth++;
        i++;
        continue;
      }
      if (ch === '/' && REGEX_STARTABLE.has(prevSignificant)) {
        i = skipRegexLiteral(html, i);
        continue;
      }
      if (html.startsWith(CLOSE_SCRIPT, i)) {
        const after = html[i + CLOSE_SCRIPT.length];
        if (after === undefined || after === '>' || after === '/' || /\s/.test(after)) return i;
      }
      if (tplDepth > 0) {
        if (ch === '{') {
          exprBraces++;
        } else if (ch === '}') {
          if (exprBraces === 0) {
            mode = 'tpl';
            tplDepth--;
            exprBraces = 0;
          } else {
            exprBraces--;
          }
        }
      }
      if (!/\s/.test(ch)) prevSignificant = ch;
      i++;
      continue;
    }
    if (mode === 'line') {
      if (ch === '\n') mode = 'code';
    } else if (mode === 'block') {
      if (ch === '*' && next === '/') {
        mode = 'code';
        i += 2;
        continue;
      }
    } else if (mode === 'sq' || mode === 'dq') {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '\n' || ch === (mode === 'sq' ? "'" : '"')) mode = 'code';
    } else {
      // 模板串
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '`') {
        mode = 'code';
      } else if (ch === '$' && next === '{') {
        mode = 'code';
        tplDepth++;
        exprBraces = 0;
        prevSignificant = '{';
        i += 2;
        continue;
      }
    }
    i++;
  }
  return -1;
}

const CLOSE_SCRIPT = '</script';

/** 上一个有效字符落在这些里时，单独的 / 大概率是正则字面量开头（启发式） */
const REGEX_STARTABLE = new Set([
  '',
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '%',
  '~',
  '^',
  '<',
  '>',
]);

/** 跳过当前位置的正则字面量（含结尾标志位），返回其后位置 */
function skipRegexLiteral(html: string, from: number): number {
  let i = from + 1;
  const len = html.length;
  let inClass = false;
  while (i < len) {
    const ch = html[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) {
      i++;
      while (i < len && /[a-z]/i.test(html[i])) i++;
      return i;
    }
    i++;
  }
  return i;
}
