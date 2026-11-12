// image-fallback.ts — 图片加载失败降级（全站生效）
// 用法：由 BaseLayout 引入：import "../assets/js/ui/image-fallback"
//
// 分两种处理：
//   封面类（详情页封面 / 列表卡片封面）—— 把 img 摘掉，露出容器自带的占位图标与底色
//   其余图片 —— 替换为 .img-ph 图标占位块（正文图与普通图片同一套）
// 扫尾：图片可能在监听器挂上前已出结果，初始化 / swup 切页时都重扫一次
import { imageKindOf } from './image-kind';

(() => {
  if (window.__alulaImageFallbackBound) return;
  window.__alulaImageFallbackBound = true;

  /** 图标模板元素 id（BaseLayout.astro 渲染同 id 的隐藏图标，JS 克隆使用）；改 id 两处同改 */
  const ICON_TEMPLATE_ID = 'alula-img-ph-icon';

  /**
   * 正文图片替换为占位块：尽量保留原图片占位尺寸，
   * 无尺寸时使用 CSS 的 min-height 兜底。
   */
  function replaceWithPlaceholder(img: HTMLImageElement, inline = false): void {
    const rect = img.getBoundingClientRect();

    const ph = document.createElement('span');
    ph.className = inline ? 'img-ph img-ph--inline' : 'img-ph';

    // 保留图片语义：占位块对读屏器仍表现为图片
    const alt = img.getAttribute('alt');
    if (alt) {
      ph.setAttribute('role', 'img');
      ph.setAttribute('aria-label', alt);
    }

    if (rect.height > 4) {
      ph.style.minHeight = `${Math.round(rect.height)}px`;
    }
    if (inline && rect.width > 4) {
      ph.style.width = `${Math.round(rect.width)}px`;
    }

    const icon = document.getElementById(ICON_TEMPLATE_ID);
    if (icon) ph.appendChild(icon.cloneNode(true));

    img.replaceWith(ph);
  }

  /** 封面失败：把 img 从 DOM 摘掉。
   *  靠 CSS 藏不住——详情页封面 img 带内联 style="display:block"，内联优先级最高；
   *  卡片封面 img 上的容器规则与任何降级规则同权重，只能靠块顺序赌胜负。
   *  摘掉元素是唯一确定的做法，容器侧的占位版式由 :not(:has(img)) 规则接手。 */
  function hideCover(img: HTMLImageElement): void {
    img.remove();
  }

  /**
   * 处理此刻已有加载结果的图片（缓存命中 / 已失败）：
   *   - 封面类：失败时隐藏；
   *   - 正文图片：成功 → 加 .img-loaded 移除占位底；失败 → 替换为占位块。
   * 仍在加载中的图片不在此处理，由下面的捕获监听接管。
   * 可重复调用：两条失败路径都把节点移出 DOM，重扫时查不到它，不会二次处理。
   */
  function initImg(img: HTMLImageElement): void {
    const kind = imageKindOf(img);
    if (kind === 'cover' || kind === 'card-cover') {
      if (img.complete && img.naturalWidth === 0) hideCover(img);
      return;
    }
    if (!img.complete) return;

    if (img.naturalWidth === 0) replaceWithPlaceholder(img, kind !== 'body');
    else if (kind === 'body') img.classList.add('img-loaded');
  }

  function scan(): void {
    document.querySelectorAll<HTMLImageElement>('img').forEach(initImg);
  }

  // 加载成功：在捕获阶段监听 document 即可覆盖全部图片（load 不冒泡，但会经过捕获链），
  // 于是无需逐图绑定，swup 反复切页也不会累积监听器
  document.addEventListener(
    'load',
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (imageKindOf(target) === 'body') target.classList.add('img-loaded');
    },
    true,
  );

  // 加载失败
  document.addEventListener(
    'error',
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLImageElement)) return;

      const kind = imageKindOf(target);
      // 文章详情封面 / 列表卡片封面：摘掉，露出容器自带的占位图标与底色
      if (kind === 'cover' || kind === 'card-cover') {
        hideCover(target);
        return;
      }

      // 其余图片（正文图与普通图片）：替换为图标占位块
      replaceWithPlaceholder(target, kind !== 'body');
    },
    true,
  );

  scan();
  // swup 切页后插入的新 DOM：补扫其中已出结果的图片（进行中的由上面的监听接管）
  document.addEventListener('swup:content:replace', scan);
})();
