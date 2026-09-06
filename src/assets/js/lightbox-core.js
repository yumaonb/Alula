// lightbox-core.js — 正文图片灯箱实现（基于 photoswipe 库）
//
// 懒加载：首次点击正文图片时，由 lightbox.js 动态 import 本模块，
// 连同 photoswipe 的样式（以及本文件引入的轻量主题微调）一起按需加载。
//
// 库自带能力：缩放 / 双指手势 / 全屏 / 左右切换 / 计数器 / Esc 与点遮罩关闭；
// 打开/关闭带从缩略图放大的过渡动画。swup 切页时自动关闭灯箱。
import PhotoSwipeLightbox from "photoswipe/lightbox";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import "../css/lightbox.css";

// 复用同一个 Lightbox 实例（不会重复绑定任何 DOM，仅暴露 loadAndOpen 动态打开）
const lightbox = new PhotoSwipeLightbox({
  pswpModule: PhotoSwipe,
  bgOpacity: 0.92,
  loop: false,
  // 按钮提示文案：鼠标悬停 tooltip 与读屏器 aria-label 一并覆盖为中文
  closeTitle: "关闭 (Esc)",
  zoomTitle: "缩放",
  arrowPrevTitle: "上一张",
  arrowNextTitle: "下一张",
});

/**
 * 收集当前页面可放大的图片，构造 photoswipe 数据源。
 * 顺序：文章详情页封面图（若有）排在第一位，其后为正文图片（按出现顺序）。
 * 每项带 element（用于从缩略图放大的动画）与宽高（photoswipe 布局必需）。
 */
function buildDataSource() {
  const coverImg = document.querySelector(".post-cover img");
  const imgs = coverImg ? [coverImg] : [];
  imgs.push(...document.querySelectorAll(".markdown-body img"));

  return imgs.map((img) => {
    const w = parseInt(img.getAttribute("width"), 10);
    const h = parseInt(img.getAttribute("height"), 10);

    const item = {
      element: img,
      src: img.currentSrc || img.src,
      alt: img.getAttribute("alt") || "",
    };

    if (w && h) {
      item.width = w;
      item.height = h;
    } else if (img.naturalWidth > 0) {
      item.width = img.naturalWidth;
      item.height = img.naturalHeight;
    } else {
      // 兜底：懒加载未就绪且无宽高信息时给默认尺寸，避免 0×0 无法布局
      item.width = 1600;
      item.height = 1200;
    }
    return item;
  });
}

/** 打开灯箱并定位到被点击的图片 */
function openLightbox(img, clickEvent) {
  const dataSource = buildDataSource();
  const index = dataSource.findIndex((item) => item.element === img);
  if (index < 0) return;

  const initialPoint =
    clickEvent && (clickEvent.clientX || clickEvent.clientY)
      ? { x: clickEvent.clientX, y: clickEvent.clientY }
      : null;

  lightbox.loadAndOpen(index, dataSource, initialPoint);
}

// swup 切页时关闭灯箱，避免覆盖层残留
document.addEventListener("swup:content:replace", () => {
  if (lightbox.pswp) lightbox.pswp.close();
});

export { openLightbox };
