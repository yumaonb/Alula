// env.d.ts — TypeScript 环境类型声明
/// <reference types="astro/client" />

interface Window {
  /** breakpoint.js 提供的共享断点监听器（供 is:inline 脚本使用） */
  __onEnterDesktop?: (fn: () => void) => () => void;
  /** TableOfContents 内部状态标记 */
  __tocInit?: boolean;
  /** TableOfContents 提供的目录竖线瞬移方法（供 TocModal 调用） */
  __tocSnap?: () => void;
}
