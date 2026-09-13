// env.d.ts — TypeScript 环境类型声明
// 用法：由 TypeScript 自动加载，无需手动引用。
/// <reference types="astro/client" />

// 背景预设虚拟模块：由 astro.config.mjs 的 backgroundPreset 插件提供。
// css 方案默认导出 null（样式随模块副作用引入）；image 方案默认导出图片元数据，交给 astro:assets 优化。
declare module 'virtual:background' {
  import type { ImageMetadata } from 'astro';
  const preset: ImageMetadata | null;
  export default preset;
}

interface Window {
  /** breakpoint.js 提供的共享断点监听器（供 is:inline 脚本使用） */
  __onEnterDesktop?: (fn: () => void) => () => void;
  /** TableOfContents 内部状态标记 */
  __tocInit?: boolean;
  /** TableOfContents 提供的目录竖线瞬移方法（供 TocModal 调用） */
  __tocSnap?: () => void;
}
