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
  /** toc.ts 提供的目录控制器（供 TocModal 登记抽屉容器后触发归位） */
  __toc?: {
    /** 归位：目录节点不在该在的宿主里才搬，搬完重测几何 */
    ensure: () => void;
    /** 只重测几何 */
    remeasure: () => void;
  };
  /** TocModal 登记的抽屉容器（目录节点在手机端的宿主） */
  __tocDrawerHost?: HTMLElement;
  /** category-tree.ts 的幂等守卫 */
  __postCatTreeBound?: boolean;
  /** category-tree.ts 提供的开合高度落实方法（供 posts-shell 的自动展开调用） */
  __catTreeSync?: () => void;
  /** posts-shell.ts 的幂等守卫 */
  __postsShellInit?: boolean;
  /** lightbox.ts 的幂等守卫 */
  __alula_lightbox_bound?: boolean;
  /** image-fallback.ts 的幂等守卫 */
  __alula_image_fallback_bound?: boolean;
  /** shell.ts 的幂等守卫 */
  __adminShellInit?: boolean;
  /** shell-guard.ts 的幂等守卫 */
  __alula_shell_guard?: boolean;
  /** nav-indicator.ts 的幂等守卫 */
  __navIndicatorInit?: boolean;
}
