// env.d.ts — TypeScript 环境类型声明
// 用法：由 TypeScript 自动加载，无需手动引用。
/// <reference types="astro/client" />

// 背景预设虚拟模块：由 astro.config.ts 的 backgroundPreset 插件提供。
// css 方案默认导出 null（样式随模块副作用引入）；image 方案默认导出图片元数据，交给 astro:assets 优化。
declare module 'virtual:background' {
  import type { ImageMetadata } from 'astro';
  const preset: ImageMetadata | null;
  export default preset;
}

interface Window {
  /** breakpoint.ts 提供的共享断点监听器（供目录 / 筛选抽屉使用） */
  __onEnterDesktop?: (fn: () => void) => () => void;
  /** toc.ts 的幂等守卫 */
  __tocInit?: boolean;
  /** toc.ts 提供的目录竖线瞬移方法（供 TocModal 调用） */
  __tocSnap?: () => void;
  /** PostCategoryTree.astro 内联脚本的幂等守卫 */
  __postCatTreeBound?: boolean;
  /** lightbox.ts 的幂等守卫 */
  __alula_lightbox_bound?: boolean;
  /** image-fallback.ts 的幂等守卫 */
  __alula_image_fallback_bound?: boolean;
  /** shell.ts 的幂等守卫 */
  __adminShellInit?: boolean;
  /** shell-guard.ts 的幂等守卫 */
  __alula_shell_guard?: boolean;
}

interface HTMLElement {
  /** toc.ts：目录指示竖线动画进行中的标记（仅 JS 读写，不是 DOM 属性） */
  _animating?: boolean;
}
