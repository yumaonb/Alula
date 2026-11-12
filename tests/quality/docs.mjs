// tests/quality/docs.mjs — 查文档里指向不存在的东西
// 用法：node tests/quality/docs.mjs（也可由 tests/run.mjs 汇总调用）
//
// 对应 AGENTS：§11（文档里的路径、文件名、命令必须真实存在 / 可运行）
//
// 全部走报错拦住：任一命中即退出码 1。
//
// 查三类，正文与代码块都查：
//   1. 反引号里以 src/…、docs/…、public/…、tests/… 开头的路径
//      必须真实存在；通配符 / 占位符 / 行号一律截掉，只查前面那段真实字面量
//   2. 路径写法：必须用正斜杠、不带 ./ 前缀（目录以 / 结尾，见 AGENTS §11）
//   3. pnpm 后面跟的脚本名必须在 package.json 的 scripts 里
//      —— 正文写 `pnpm xxx`（带反引号），代码块里写裸的 pnpm xxx，
//         后者是文档里最常见的写法，必须一起查

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { walk, read, root, runCheck, isMain } from './lib/common.mjs';

const DOC_FILES = walk('docs', (p) => p.endsWith('.md')).concat(['AGENTS.md']);

/** 反引号里的整段文本；路径判定在 inspectSpan 里做 */
const SPAN_RE = /`([^`\n]+)`/g;

/** 路径必须以这些仓库目录开头 */
const PATH_PREFIX_RE = /^(?:src|docs|public|tests)\//;

/** 反斜杠写法与 ./ 前缀都是不合规的路径写法 */
const BACKSLASH_RE = /^(?:src|docs|public|tests)\\/;
const DOT_SLASH_RE = /^\.\/(?:src|docs|public|tests)\//;

/**
 * 从反引号片段里取出要检查的真实路径段。
 * 行号（:12、:12-30、:113, 118）、锚点、通配符、占位符一律截掉，
 * 只校验第一个特殊字符之前的字面量目录 / 文件——这就是目录写法的锚点。
 */
function inspectSpan(rawSpan) {
  const span = rawSpan.split('#')[0].trim();
  if (!span) return null;
  if (BACKSLASH_RE.test(span)) return { problem: '路径要用正斜杠 /，不要用反斜杠' };
  if (DOT_SLASH_RE.test(span)) return { problem: '写仓库相对路径，不要带 ./ 前缀' };
  if (!PATH_PREFIX_RE.test(span)) return null;
  const base = (span.match(/^[\p{L}\p{N}_\-./[\]\\]*/u) ?? [''])[0];
  return base ? { base } : { problem: '路径缺少仓库内名称' };
}

/** 正文里的命令：反引号包着 `pnpm xxx` */
const CMD_RE = /`pnpm ([a-z:]+)`/g;

/** 代码块里的命令：裸写 pnpm xxx */
const BARE_CMD_RE = /(?:^|\s)pnpm\s+([a-z:]+)/g;

/**
 * 路径出现在「记叙历史」里时不算死链：
 * 行内有迁移动词（「已随…清理」/「已修」/「搬」/「移到」/「迁移」等）时，
 * 讲的是文件从哪到哪，旧路径本来就是不存在的。
 * `→` 不算历史记号：本项目大量用箭头当分隔符（「症状 → 原因 → 处理」），
 * 把它当豁免会让同行现行路径整行逃检。
 */
const HISTORY_HINT = /(已随|已清理|已修|搬|移到|迁移|原路径|旧路径)/;

/** 包管理器的通用命令，不是 package.json 里的脚本 */
const PM_COMMANDS = new Set(['install', 'i', 'add', 'remove', 'rm', 'update', 'up', 'exec', 'dlx']);

/** 这几种代码块里的裸命令才算数（别的语言里 pnpm 可能是普通过文本） */
const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'powershell', 'pwsh', 'console', '']);

export function collect() {
  const findings = [];

  // package.json 里的脚本名
  const pkg = JSON.parse(read('package.json'));
  const scriptNames = new Set(Object.keys(pkg.scripts || {}));

  for (const file of DOC_FILES) {
    const lines = read(file).split('\n');
    let inFence = false;
    let fenceLang = '';

    lines.forEach((line, i) => {
      const trimmed = line.trim();

      // 围栏行本身不查，只用来切换状态
      if (trimmed.startsWith('```')) {
        if (inFence) {
          inFence = false;
          fenceLang = '';
        } else {
          inFence = true;
          fenceLang = trimmed.slice(3).trim().toLowerCase();
        }
        return;
      }

      const isHistory = HISTORY_HINT.test(line);
      const push = (rule, message) => findings.push({ file, line: i + 1, rule, message });

      // --- 路径：正文与代码块都查 ---
      for (const m of line.matchAll(SPAN_RE)) {
        const info = inspectSpan(m[1]);
        if (!info || isHistory) continue;
        if (info.problem) {
          push('路径写法', `\`${m[1]}\` ${info.problem}`);
          continue;
        }
        if (!existsSync(join(root(), info.base))) {
          push('死路径', `文档提到的 ${info.base} 在仓库里不存在`);
        }
      }

      // --- 命令：正文用反引号，代码块用裸写 ---
      const cmdMatches = inFence
        ? SHELL_LANGS.has(fenceLang)
          ? [...line.matchAll(BARE_CMD_RE)]
          : []
        : [...line.matchAll(CMD_RE)];

      for (const m of cmdMatches) {
        const cmd = m[1];
        if (PM_COMMANDS.has(cmd)) continue;
        if (!scriptNames.has(cmd)) {
          push('死命令', `文档提到 pnpm ${cmd}，但 package.json 里没有这个脚本`);
        }
      }
    });
  }

  return findings;
}

if (isMain(import.meta.url)) {
  process.exit(
    runCheck('check-docs', collect, {
      hint: '文档里的路径与命令必须真实存在（AGENTS §11）。修文档，或把文件补上。',
    }),
  );
}
