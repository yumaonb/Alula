// content-image.ts — 文章图片解析（构建期）：frontmatter / 正文里的相对路径 → 图片模块
// 用法：由 ImageWrapper 引入：import { contentImageGlob, resolveContentImageKey } from '../lib/content-image'

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

/**
 * 可用作文章图片的模块：文章同级 images/，以及跨文章共用的 assets/images/。
 * 键相对本文件带 `../../../` 前缀，例如 "../../../content/posts/devnotes/css/images/a.png"。
 * 文章组件与订阅源都从这里取，
 * 两处才不会各写一份 glob 规则（改扩展名白名单只改这里）。
 *
 * 不扫整个 src/：背景预设（assets/backgrounds/）与文章图片无关，
 * 扫进来会把它们的原图一起编成模块、跟着部署。
 */
export const contentImageGlob = import.meta.glob<ImageMetadata>(
  [
    '../../../content/posts/**/*.{png,jpg,jpeg,gif,webp,svg}',
    '../../../assets/images/**/*.{png,jpg,jpeg,gif,webp,svg}',
  ],
  {
    import: 'default',
  },
);

/** 把「文章目录基准（相对 src/）+ frontmatter 相对路径」归一成 glob 键：正斜杠、去掉 `./`、折叠 `..` */
export function resolveContentImageKey(basePath: string, src: string): string {
  return path.normalize(path.join('../../../', basePath, src)).replace(/\\/g, '/');
}

/** glob 键 → 人看的源码路径（只用于日志） */
export function imageKeyToSourcePath(key: string): string {
  return key.replace('../../../', 'src/');
}

/**
 * 图片来源分类。文章页与订阅源都要判断「这张图能不能走 astro:assets」，
 * 两处各写一套规则时，改了一处另一处会静默失效（RSS 里静默丢掉外链封面）。
 */
export type ImageSource = 'local' | 'public' | 'external' | 'data';

/** 判断 frontmatter 的 image 字段属于哪一类 */
export function classifyImageSource(src: string): ImageSource {
  if (src.startsWith('data:')) return 'data';
  if (src.startsWith('/')) return 'public';
  if (src.startsWith('http://') || src.startsWith('https://')) return 'external';
  return 'local';
}

/** 能否走 astro:assets 优化（站内相对路径） */
export function isOptimizableImage(src: string): boolean {
  return classifyImageSource(src) === 'local';
}
/** 扩展名 → MIME。public 里的文件只能靠扩展名判断（`/images/logo.png` 实际是 JPEG 也只能按名报） */
export const mimeByExt: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** 静态资源目录以项目根为基准。 */
const PUBLIC_DIR = fileURLToPath(new URL('../../../../public', import.meta.url));

/**
 * 封面 → 可拿出去用的图片地址与 MIME。
 * 订阅源的 `enclosure` 与文章页对外分享卡（og:image）都要这张图，
 * 两处各写一套时改了一处另一处会静默失效（订阅源里悄悄丢封面、分享卡没图）。
 * 返回 undefined = 指向一个不存在的模块：调用方各自回落到「不放图」。
 */
export async function resolveCoverImage(
  image: string,
  basePath: string,
): Promise<{ src: string; type: string } | undefined> {
  // public 静态文件、外链、data: 原样引用——文章页能显示的图，这两处不该悄悄没有
  const source = classifyImageSource(image);
  if (source === 'external' || source === 'data') {
    return { src: image, type: mimeByExt[path.extname(image).toLowerCase()] ?? 'image/png' };
  }
  if (source === 'public') {
    // public 里的文件只能靠文件系统确认在不在：写错的路径原样发出去，
    // 订阅源会给出一个打不开的 enclosure，分享卡会是一张裂图
    const file = path.join(PUBLIC_DIR, image.split(/[?#]/)[0].replace(/^\//, ''));
    if (!fs.existsSync(file)) {
      console.warn(`[content-image] 封面图不存在，已跳过：${image}`);
      return undefined;
    }
    return { src: image, type: mimeByExt[path.extname(image).toLowerCase()] ?? 'image/png' };
  }

  const key = resolveContentImageKey(basePath, image);
  const load = contentImageGlob[key];
  if (!load) {
    console.warn(`[content-image] 封面图不存在，已跳过：${imageKeyToSourcePath(key)}`);
    return undefined;
  }

  const meta = await load();
  const optimized = await getImage({ src: meta, width: 1200 });
  const ext = path.extname(optimized.src.split('?')[0]).toLowerCase();
  return { src: optimized.src, type: mimeByExt[ext] ?? `image/${meta.format}` };
}
