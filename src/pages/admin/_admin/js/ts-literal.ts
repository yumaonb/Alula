// ts-literal.ts — TS 字面量解析与序列化（数据表单把 src/data 配置值当结构化数据用）
// 用法：import { extractExport, replaceLiteral, deepEqual } from './ts-literal'
//
// 只认配置文件里会出现的字面量：对象 / 数组 / 字符串 / 数字 / true / false / null。
// extractExport 取某个 `export const <name>` 的字面量，replaceLiteral 只替换该字面量，
// 文件其余内容（接口、注释、别的导出）原样保留；配置里新增字段不会弄坏表单。

export interface ExportExtract {
  value: unknown;
  /** 字面量真正开始的位置（`=` 与字面量之间的空白保留原样） */
  start: number;
  /** 字面量结束后的位置（分号之前） */
  end: number;
}

interface Parsed {
  value: unknown;
  end: number;
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const NUMBER_RE = /^(?:0[xX][0-9a-fA-F]+|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/;
const STRING_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  v: '\v',
  0: '\0',
};

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

/** 跳空白与注释；返回 -1 表示碰到未闭合的块注释 */
function skipWs(src: string, i: number): number {
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
    } else if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      if (nl === -1) return src.length;
      i = nl + 1;
    } else if (ch === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      if (close === -1) return -1;
      i = close + 2;
    } else {
      break;
    }
  }
  return i;
}

function parseString(src: string, i: number): Parsed | null {
  const quote = src[i];
  i++;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const esc = src[i + 1];
      if (esc === 'u') {
        const hex = src.slice(i + 2, i + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
      } else if (esc === 'x') {
        const hex = src.slice(i + 2, i + 4);
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) return null;
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else if (esc === quote || esc === '\\') {
        out += esc;
        i += 2;
      } else if (esc in STRING_ESCAPES) {
        out += STRING_ESCAPES[esc];
        i += 2;
      } else if (esc === '\n' || esc === '\r') {
        i += esc === '\r' && src[i + 2] === '\n' ? 3 : 2;
      } else {
        return null;
      }
    } else if (ch === quote) {
      return { value: out, end: i + 1 };
    } else if (ch === '\n' || ch === '\r') {
      return null;
    } else {
      out += ch;
      i++;
    }
  }
  return null;
}

function parseNumber(src: string, i: number): Parsed | null {
  const m = NUMBER_RE.exec(src.slice(i, i + 32));
  if (!m) return null;
  return { value: Number(m[0]), end: i + m[0].length };
}

function parseObject(src: string, i: number): Parsed | null {
  i++;
  const obj: Record<string, unknown> = {};
  for (;;) {
    let j = skipWs(src, i);
    if (j < 0 || j >= src.length) return null;
    if (src[j] === '}') return { value: obj, end: j + 1 };
    let key: string;
    if (src[j] === "'" || src[j] === '"') {
      const k = parseString(src, j);
      if (!k) return null;
      key = String(k.value);
      j = k.end;
    } else {
      const m = IDENT_RE.exec(src.slice(j, j + 128));
      if (!m) return null;
      key = m[0];
      j += m[0].length;
    }
    j = skipWs(src, j);
    if (j < 0 || src[j] !== ':') return null;
    j++;
    const v = parseValue(src, j);
    if (!v) return null;
    obj[key] = v.value;
    i = skipWs(src, v.end);
    if (i < 0) return null;
    if (src[i] === ',') {
      i++;
      continue;
    }
    if (src[i] === '}') return { value: obj, end: i + 1 };
    return null;
  }
}

function parseArray(src: string, i: number): Parsed | null {
  i++;
  const arr: unknown[] = [];
  for (;;) {
    const j = skipWs(src, i);
    if (j < 0 || j >= src.length) return null;
    if (src[j] === ']') return { value: arr, end: j + 1 };
    const v = parseValue(src, j);
    if (!v) return null;
    arr.push(v.value);
    i = skipWs(src, v.end);
    if (i < 0) return null;
    if (src[i] === ',') {
      i++;
      continue;
    }
    if (src[i] === ']') return { value: arr, end: i + 1 };
    return null;
  }
}

function parseValue(src: string, i: number): Parsed | null {
  const j = skipWs(src, i);
  if (j < 0) return null;
  const ch = src[j];
  if (ch === '{') return parseObject(src, j);
  if (ch === '[') return parseArray(src, j);
  if (ch === "'" || ch === '"') return parseString(src, j);
  if (ch === '-' || (ch >= '0' && ch <= '9')) return parseNumber(src, j);
  if (src.startsWith('true', j) && !isIdentPart(src[j + 4] ?? ''))
    return { value: true, end: j + 4 };
  if (src.startsWith('false', j) && !isIdentPart(src[j + 5] ?? ''))
    return { value: false, end: j + 5 };
  if (src.startsWith('null', j) && !isIdentPart(src[j + 4] ?? ''))
    return { value: null, end: j + 4 };
  return null;
}

/**
 * 取 `export const <name>` 的字面量。
 * 类型标注（`:` 开头）按尖括号深度跳过，找深度为 0 且后面不跟 `>` 的 `=`；
 * 字面量结束后必须是 `;` 或文件尾，表达式（如 `60 * 60 * 1000`）一律返回 null。
 */
export function extractExport(source: string, name: string): ExportExtract | null {
  const re = new RegExp(`(?:^|\\n)\\s*export\\s+(?:const|let|var)\\s+${name}\\b`);
  const m = re.exec(source);
  if (!m) return null;
  let i = skipWs(source, m.index + m[0].length);
  if (i < 0) return null;
  if (source[i] === ':') {
    let depth = 0;
    let eq = -1;
    while (i < source.length) {
      const ch = source[i];
      if (ch === '<') depth++;
      else if (ch === '>') depth--;
      else if (ch === '=' && depth === 0 && source[i + 1] !== '>') {
        eq = i;
        break;
      }
      i++;
    }
    if (eq < 0) return null;
    i = eq + 1;
  } else if (source[i] !== '=') {
    return null;
  } else {
    i++;
  }
  const p = parseValue(source, i);
  if (!p) return null;
  const j = skipWs(source, p.end);
  if (j < 0 || (source[j] !== ';' && j !== source.length)) return null;
  return { value: p.value, start: skipWs(source, i), end: p.end };
}

function quoteString(s: string): string {
  let out = "'";
  for (const ch of s) {
    if (ch === '\\') out += '\\\\';
    else if (ch === "'") out += "\\'";
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch.charCodeAt(0) < 0x20) out += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + "'";
}

function formatKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function serializeValue(value: unknown, indent: number): string {
  const pad = '  '.repeat(indent);
  const inner = '  '.repeat(indent + 1);
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return String(value);
    case 'number':
      if (!Number.isFinite(value)) throw new Error('数值必须有限');
      return String(value);
    case 'string':
      return quoteString(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return (
      '[\n' + value.map((v) => inner + serializeValue(v, indent + 1)).join(',\n') + '\n' + pad + ']'
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      inner + formatKey(k) + ': ' + serializeValue(v, indent + 1),
    ]);
    if (entries.length === 0) return '{}';
    return '{\n' + entries.join(',\n') + ',\n' + pad + '}';
  }
  throw new Error('只能序列化字面量值');
}

/** 把某个导出的字面量换成新值；其余内容一字不动，失败返回 null */
export function replaceLiteral(source: string, name: string, value: unknown): string | null {
  const ex = extractExport(source, name);
  if (!ex) return null;
  try {
    return source.slice(0, ex.start) + serializeValue(value, 0) + source.slice(ex.end);
  } catch {
    return null;
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;
  const ka = a as Record<string, unknown>;
  const kb = b as Record<string, unknown>;
  const keysA = Object.keys(ka);
  const keysB = Object.keys(kb);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.hasOwn(kb, k) && deepEqual(ka[k], kb[k]));
}
