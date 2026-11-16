// image-fallback.ts — 普通图片加载失败时替换为通用占位块
// 用法：文章功能关闭时，由 BaseLayout 通过 'virtual:features/image-fallback' 引入。
import { replaceWithPlaceholder } from './image-placeholder';

(() => {
  // 构建期与文章入口互斥，共用同一文档级守卫。
  if (window.__alulaImageFallbackBound) return;
  window.__alulaImageFallbackBound = true;

  function scan(): void {
    document.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
      if (image.complete && image.naturalWidth === 0) replaceWithPlaceholder(image, true);
    });
  }

  function onError(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    replaceWithPlaceholder(target, true);
  }

  // 图片错误不冒泡，文档捕获监听也能接管切页后插入的图片。
  document.addEventListener('error', onError, true);
  scan();
  document.addEventListener('swup:content:replace', scan);
})();
