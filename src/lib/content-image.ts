// content-image.ts — 文章图片解析（构建期）：frontmatter / 正文里的相对路径 → 图片模块
// 用法：import { contentImageGlob, resolveContentImageKey } from "../../lib/content-image"

import path from 'node:path';

import type { ImageMetadata } from 'astro';

/**
 * src/ 下全部可用作文章图片的模块。
 * 键相对本文件（src/lib）带 `../` 前缀，例如 "../content/posts/devnotes/css/images/a.png"。
 * 文章页（components/posts/ImageWrapper.astro）与订阅源（pages/posts/rss.xml.ts）都从这里取，
 * 两处才不会各写一份 glob 规则（改扩展名白名单只改这里）。
 */
export const contentImageGlob = import.meta.glob<ImageMetadata>(
  '../**/*.{png,jpg,jpeg,gif,webp,svg}',
  {
    import: 'default',
  },
);

/** 把「文章目录基准（相对 src/）+ frontmatter 相对路径」归一成 glob 键：正斜杠、去掉 `./`、折叠 `..` */
export function resolveContentImageKey(basePath: string, src: string): string {
  return path.normalize(path.join('../', basePath, src)).replace(/\\/g, '/');
}

/** glob 键 → 人看的源码路径（只用于日志） */
export function imageKeyToSourcePath(key: string): string {
  return key.replace('../', 'src/');
}
