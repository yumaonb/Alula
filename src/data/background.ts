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
  /** 压暗强度 0~1，0 为不压暗；图片偏亮、玻璃卡片上的文字对比度不够时调大 */
  scrim: number;
}

// 图片方案固定按「高度撑满，宽度取大者」铺图，铺法不接受配置：
// 高度永远铺满视口；宽度看图片按高度缩放后够不够，不够就横向拉伸填满，够就把超出部分裁掉。
// 宽高比由 Background.astro 从图片自身读出来交给 CSS，换图片不用改这里。
export const background: BackgroundConfig = {
  type: 'css',
  path: 'honeycomb.css',
  scrim: 0,
};
