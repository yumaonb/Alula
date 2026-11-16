// image-placeholder.ts — 图片失败占位元素的共享替换函数
// 用法：由同目录的图片降级入口引入：import { replaceWithPlaceholder } from './image-placeholder'

// 图标模板由 src/layouts/BaseLayout.astro 渲染，修改标识时两处同改。
const ICON_TEMPLATE_ID = 'alula-img-ph-icon';

export function replaceWithPlaceholder(image: HTMLImageElement, isInline: boolean): void {
  const rect = image.getBoundingClientRect();
  const ownerDocument = image.ownerDocument;
  const placeholder = ownerDocument.createElement('span');
  placeholder.className = isInline ? 'img-ph img-ph--inline' : 'img-ph';

  const alt = image.getAttribute('alt');
  if (alt) {
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', alt);
  }

  // 沿用原图占位尺寸，无法量测时由样式兜底。
  if (rect.height > 4) {
    placeholder.style.minHeight = `${Math.round(rect.height)}px`;
  }
  if (isInline && rect.width > 4) {
    placeholder.style.width = `${Math.round(rect.width)}px`;
  }

  const icon = ownerDocument.getElementById(ICON_TEMPLATE_ID);
  if (icon) placeholder.appendChild(icon.cloneNode(true));

  image.replaceWith(placeholder);
}
