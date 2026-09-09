// image-fallback.js — 图片加载失败降级：正文图替换为占位块、封面图隐藏
// 用法：由 BaseLayout 引入：import "../assets/js/image-fallback.js"
// 扫尾：图片可能在监听器挂上前已失败，初始化 / window.load / swup 切页时都重扫一次
(() => {
  if (window.__alula_image_fallback_bound) return;
  window.__alula_image_fallback_bound = true;

  /** 图标模板元素 id（BaseLayout 内渲染的隐藏 mdi 图标，JS 克隆使用） */
  const ICON_TEMPLATE_ID = "alula-img-ph-icon";

  /**
   * 正文图片替换为占位块：尽量保留原图片占位尺寸，
   * 无尺寸时使用 CSS 的 min-height 兜底。
   */
  function replaceWithPlaceholder(img) {
    if (img.dataset.phReplaced) return;
    img.dataset.phReplaced = "1";

    const rect = img.getBoundingClientRect();

    const ph = document.createElement("span");
    ph.className = "img-ph";

    // 保留图片语义：占位块对读屏器仍表现为图片
    const alt = img.getAttribute("alt");
    if (alt) {
      ph.setAttribute("role", "img");
      ph.setAttribute("aria-label", alt);
    }

    if (rect.height > 4) {
      ph.style.minHeight = `${Math.round(rect.height)}px`;
    }

    const icon = document.getElementById(ICON_TEMPLATE_ID);
    if (icon) ph.appendChild(icon.cloneNode(true));

    img.replaceWith(ph);
  }

  /**
   * 单个图片的状态处理：
   *   - 封面类：失败时隐藏（兜底 error 事件错过的场景）；
   *   - 正文图片：加载成功 → 加 .img-loaded 移除占位底；失败 → 替换为占位块。
   */
  function initImg(img) {
    if (img.closest(".post-cover, .post-card-cover")) {
      if (img.complete && img.naturalWidth === 0) img.classList.add("img-failed");
      return;
    }
    if (!img.closest(".markdown-body")) return;

    if (img.complete) {
      if (img.naturalWidth === 0) replaceWithPlaceholder(img);
      else img.classList.add("img-loaded");
      return;
    }
    img.addEventListener("load", () => img.classList.add("img-loaded"));
  }

  /** 扫描当前页面所有图片（初始化 / window.load / swup 切页后调用） */
  function scan() {
    document.querySelectorAll("img").forEach(initImg);
  }

  scan();
  window.addEventListener("load", scan);
  // swup 切页后产生的新 DOM 同样被覆盖
  document.addEventListener("swup:contentReplaced", scan);

  window.addEventListener(
    "error",
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLImageElement)) return;

      // 文章详情封面 / 列表卡片封面：隐藏，露出占位背景
      if (target.closest(".post-cover, .post-card-cover")) {
        target.classList.add("img-failed");
        return;
      }

      // 文章正文图片：替换为占位块
      if (target.closest(".markdown-body")) {
        replaceWithPlaceholder(target);
      }
    },
    true,
  );
})();
