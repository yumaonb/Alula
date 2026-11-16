// image-fallback.ts — 文章功能启用时的图片占位与加载失败降级
// 用法：文章功能启用时，由 BaseLayout 通过 'virtual:features/image-fallback' 引入。
import { imageKindOf } from './image-kind';
import { replaceWithPlaceholder } from '../../../assets/js/ui/image-placeholder';

(() => {
  // 构建期与普通入口互斥，共用同一文档级守卫。
  if (window.__alulaImageFallbackBound) return;
  window.__alulaImageFallbackBound = true;

  function handleFailure(image: HTMLImageElement): void {
    const kind = imageKindOf(image);
    if (kind === 'cover' || kind === 'card-cover') {
      // 摘掉图片以露出容器占位，避免与封面内联显示样式争夺优先级。
      image.remove();
      return;
    }
    replaceWithPlaceholder(image, kind !== 'body');
  }

  function initImage(image: HTMLImageElement): void {
    if (!image.complete) return;
    if (image.naturalWidth === 0) {
      handleFailure(image);
      return;
    }
    if (imageKindOf(image) === 'body') image.classList.add('img-loaded');
  }

  function scan(): void {
    document.querySelectorAll<HTMLImageElement>('img').forEach(initImage);
  }

  function onLoad(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    if (imageKindOf(target) === 'body') target.classList.add('img-loaded');
  }

  function onError(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    handleFailure(target);
  }

  // 图片加载事件不冒泡，文档捕获监听也能接管切页后插入的图片。
  document.addEventListener('load', onLoad, true);
  document.addEventListener('error', onError, true);
  scan();
  // 缓存命中或监听前已失败的图片，需要在内容替换后补扫。
  document.addEventListener('swup:content:replace', scan);
})();
