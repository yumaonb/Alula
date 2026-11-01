// lightbox.ts — 灯箱触发入口（懒加载：首次点击才拉取 lightbox-core.ts）
// 用法：由 BaseLayout 引入：import "../assets/js/ui/lightbox"
// 点击监听挂在 document 上，swup 切页后的新图片同样生效
import { isZoomableImage } from './image-kind';

(() => {
  if (window.__alula_lightbox_bound) return;
  window.__alula_lightbox_bound = true;

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLImageElement)) return;

    // 哪类图能进灯箱统一见 image-kind.ts：正文图与详情页封面参与，列表卡片封面不参与
    if (!isZoomableImage(target)) return;
    // 加载失败的图片已被替换为占位块，无图可放大
    if (target.dataset.phReplaced) return;

    e.preventDefault();

    import('./lightbox-core')
      .then((m) => m.openLightbox(target, e))
      .catch((err) => console.error('[lightbox] load failed:', err));
  });
})();
