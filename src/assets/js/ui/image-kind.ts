// image-kind.ts — 图片归类：正文图 / 文章详情页封面 / 列表卡片封面
// 用法：import { imageKindOf, isZoomableImage, zoomableImages } from "./image-kind"
//
// 灯箱（lightbox / lightbox-core）与加载失败降级（image-fallback）都按「这张图属于哪一类」
// 分流。三处各写一遍选择器时，改一处忘另一处不会报错、只在某个页面上悄悄失效，
// 所以判断只留在这里一份：
//   正文图     .markdown-body 内 —— 可放大、失败换占位块、成功后去掉占位底
//   详情页封面 .post-cover 内    —— 可放大、失败隐藏露出占位图标
//   列表卡片封面 .post-card-cover 内 —— 不参与灯箱、失败隐藏
// 优先级从上到下：卡片封面最先判（它是最具体的容器），其次详情页封面，最后正文图。

export type ImageKind = 'body' | 'cover' | 'card-cover' | 'other';

/** 文章详情页封面容器 */
const COVER = '.post-cover';
/** 列表卡片封面容器 */
const CARD_COVER = '.post-card-cover';
/** 正文容器 */
const BODY = '.markdown-body';

export function imageKindOf(el: Element): ImageKind {
  if (el.closest(CARD_COVER)) return 'card-cover';
  if (el.closest(COVER)) return 'cover';
  if (el.closest(BODY)) return 'body';
  return 'other';
}

/** 能否在灯箱里放大：正文图与详情页封面可以，列表卡片封面不行 */
export function isZoomableImage(el: Element): boolean {
  const kind = imageKindOf(el);
  return kind === 'body' || kind === 'cover';
}

/** 参与灯箱的图片，按灯箱内的顺序：详情页封面在前，其后正文图（保持文档顺序） */
export function zoomableImages(root: ParentNode = document): HTMLImageElement[] {
  const cover = root.querySelector<HTMLImageElement>(`${COVER} img`);
  const body = Array.from(root.querySelectorAll<HTMLImageElement>(`${BODY} img`)).filter(
    (img) => imageKindOf(img) === 'body',
  );
  return cover && imageKindOf(cover) === 'cover' ? [cover, ...body] : body;
}
