// image-fallback.js — 图片加载失败降级：正文图替换为占位块、封面图隐藏
// 用法：由 BaseLayout 引入：import "../assets/js/image-fallback.js"
// 扫尾：图片可能在监听器挂上前已出结果，初始化 / swup 切页时都重扫一次
(() => {
  if (window.__alula_image_fallback_bound) return;
  window.__alula_image_fallback_bound = true;

  /** 图标模板元素 id（BaseLayout 内渲染的隐藏 mdi 图标，JS 克隆使用） */
  const ICON_TEMPLATE_ID = 'alula-img-ph-icon';

  /**
   * 正文图片替换为占位块：尽量保留原图片占位尺寸，
   * 无尺寸时使用 CSS 的 min-height 兜底。
   */
  function replaceWithPlaceholder(img) {
    if (img.dataset.phReplaced) return;
    img.dataset.phReplaced = '1';

    const rect = img.getBoundingClientRect();

    const ph = document.createElement('span');
    ph.className = 'img-ph';

    // 保留图片语义：占位块对读屏器仍表现为图片
    const alt = img.getAttribute('alt');
    if (alt) {
      ph.setAttribute('role', 'img');
      ph.setAttribute('aria-label', alt);
    }

    if (rect.height > 4) {
      ph.style.minHeight = `${Math.round(rect.height)}px`;
    }

    const icon = document.getElementById(ICON_TEMPLATE_ID);
    if (icon) ph.appendChild(icon.cloneNode(true));

    img.replaceWith(ph);
  }

  /**
   * 处理此刻已有加载结果的图片（缓存命中 / 已失败）：
   *   - 封面类：失败时隐藏；
   *   - 正文图片：成功 → 加 .img-loaded 移除占位底；失败 → 替换为占位块。
   * 仍在加载中的图片不在此处理，由下面的捕获监听接管；因此本函数幂等，可重复调用。
   */
  function initImg(img) {
    if (img.closest('.post-cover, .post-card-cover')) {
      if (img.complete && img.naturalWidth === 0) img.classList.add('img-failed');
      return;
    }
    if (!img.closest('.markdown-body')) return;
    if (!img.complete) return;

    if (img.naturalWidth === 0) replaceWithPlaceholder(img);
    else img.classList.add('img-loaded');
  }

  /** 扫描当前页面所有图片（初始化 / swup 切页后调用） */
  function scan() {
    document.querySelectorAll('img').forEach(initImg);
  }

  // 加载成功：在捕获阶段监听 document 即可覆盖全部图片（load 不冒泡，但会经过捕获链），
  // 于是无需逐图绑定，swup 反复切页也不会累积监听器
  document.addEventListener(
    'load',
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (target.closest('.markdown-body')) target.classList.add('img-loaded');
    },
    true,
  );

  // 加载失败
  document.addEventListener(
    'error',
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLImageElement)) return;

      // 文章详情封面 / 列表卡片封面：隐藏，露出占位背景
      if (target.closest('.post-cover, .post-card-cover')) {
        target.classList.add('img-failed');
        return;
      }

      // 文章正文图片：替换为占位块
      if (target.closest('.markdown-body')) {
        replaceWithPlaceholder(target);
      }
    },
    true,
  );

  scan();
  // swup 切页后插入的新 DOM：补扫其中已出结果的图片（进行中的由上面的监听接管）
  document.addEventListener('swup:content:replace', scan);
})();
