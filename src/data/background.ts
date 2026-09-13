// background.ts — 全站背景设置（唯一编辑点）
// 用法：import { background } from "../../data/background"
//
// 改完要重启 pnpm dev 才生效：本文件在构建「配置阶段」就被 astro.config.mjs 读取，
// 用来决定把哪个预设文件编进产物（见 astro.config.mjs 里的 backgroundPreset 插件）。
// pnpm build 每次都是新进程，不受影响。

export interface BackgroundConfig {
  /** 用哪种背景：'css' 走 assets/backgrounds/css/，'image' 走 assets/backgrounds/images/ */
  type: 'css' | 'image';
  /** 只填文件名（不含目录），type 决定去哪个文件夹找；写错会在构建期直接报错 */
  path: string;
  /** 图片方案专用，css 方案忽略 */
  image: {
    /** 铺满方式 */
    fit: 'cover' | 'contain';
    /** 对齐位置，取值同 CSS background-position */
    position: string;
  };
  /** 压暗强度 0~1，0 为不压暗；图片偏亮、玻璃卡片上的文字对比度不够时调大 */
  scrim: number;
}

export const background: BackgroundConfig = {
  type: 'css',
  path: 'grid.css',
  image: {
    fit: 'cover',
    position: 'center',
  },
  scrim: 0,
};
