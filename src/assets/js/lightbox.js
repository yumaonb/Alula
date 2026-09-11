// lightbox.js — 灯箱触发入口（懒加载：首次点击才拉取 lightbox-core.js）
// 用法：由 BaseLayout 引入：import "../assets/js/lightbox.js"
// 点击监听挂在 document 上，swup 切页后的新图片同样生效
(() => {
  if (window.__alula_lightbox_bound) return;
  window.__alula_lightbox_bound = true;

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLImageElement)) return;

    // 正文图片与文章详情页封面图参与灯箱；列表卡片封面不参与
    if (!target.closest('.markdown-body') && !target.closest('.post-cover')) return;
    if (target.closest('.post-card-cover')) return;
    // 加载失败的图片已被替换为占位块，无图可放大
    if (target.dataset.phReplaced) return;

    e.preventDefault();

    // 懒加载：首次点击才拉取灯箱实现
    import('./lightbox-core.js')
      .then((m) => m.openLightbox(target, e))
      .catch((err) => console.error('[lightbox] load failed:', err));
  });
})();
