// nav-indicator.ts — 导航下划线的运行时部分：
// 静态线（活动项的 ::after）负责首屏与加载期（服务端渲染，首帧即可见）；
// 样式确认应用后由共享线 .nav-indicator 独家接管绘制，此后点击 / 切页 / resize
// 都只重设它的目标位置——快速连点就是过渡重定向，线不会消失，也就不存在跳变。
// 目标链接的 href 一律从 DOM 读取，不写死。
// 用法：由 NavBar.astro 在桌面端动态 import（手机端不加载）：import "../../assets/js/nav-indicator"
import { navMatch } from '../../lib/nav-match';

(() => {
  if (window.__navIndicatorInit) return;
  window.__navIndicatorInit = true;

  const ACTIVE = 'is-active';
  const READY = 'js-ready';
  const ON = 'is-on';
  const NO_TRANSITION = 'no-transition';

  let takenOver = false;

  function getEls() {
    const navLinks = document.querySelector<HTMLElement>('.nav-links');
    const indicator = navLinks?.querySelector<HTMLElement>('.nav-indicator') ?? null;
    if (!navLinks || !indicator) return null;
    return {
      navLinks,
      indicator,
      anchors: Array.from(navLinks.querySelectorAll<HTMLAnchorElement>('a')),
    };
  }

  function textOf(anchor: HTMLAnchorElement): HTMLElement {
    return anchor.querySelector<HTMLElement>('.nav-link-text') ?? anchor;
  }

  function currentActive(anchors: HTMLAnchorElement[]): HTMLAnchorElement | null {
    return anchors.find((a) => a.classList.contains(ACTIVE)) ?? null;
  }

  function setActive(anchors: HTMLAnchorElement[], target: HTMLAnchorElement | null): void {
    for (const anchor of anchors) {
      const active = anchor === target;
      anchor.classList.toggle(ACTIVE, active);
      if (active) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
  }

  /** 把共享线对齐到链接文字（animate 为 false 时瞬移） */
  function place(indicator: HTMLElement, anchor: HTMLAnchorElement, animate: boolean): void {
    const text = textOf(anchor);
    if (!animate) indicator.classList.add(NO_TRANSITION);
    indicator.style.transform = `translateX(${text.offsetLeft}px)`;
    indicator.style.width = `${text.offsetWidth}px`;
    if (!animate) {
      void indicator.offsetHeight; // 先落位再恢复过渡
      indicator.classList.remove(NO_TRANSITION);
    }
  }

  /**
   * 接管：静态线交棒给共享线，同帧同位换画者，视觉无跳变。
   * 活动项以当前 URL 为准（接管前若发生过换页，DOM 上的 is-active 可能还是旧的），
   * 并顺手把 is-active 对齐回来。样式未应用时量测不准（ul 默认 40px 缩进、字体未定），
   * 直接返回，等 load 再试。
   */
  function takeOver(): void {
    if (takenOver) return;
    const els = getEls();
    if (!els) return;
    if (getComputedStyle(els.navLinks).display !== 'flex') return;
    const active =
      pickTarget(els.anchors, window.location.pathname) ?? currentActive(els.anchors);
    if (!active) return;
    takenOver = true;
    setActive(els.anchors, active);
    place(els.indicator, active, false);
    els.indicator.classList.add(ON);
    els.navLinks.classList.add(READY); // 静态线从此让位
  }

  /** 移动线到 target：已接管则共享线滑动（快速连点 = 重定向，CSS 过渡从当前位置平滑改向）；
   *  未接管（首屏 / 加载期）只挪 is-active，静态线即时切换 */
  function moveTo(target: HTMLAnchorElement): void {
    const els = getEls();
    if (!els) return;
    if (currentActive(els.anchors) === target) return;
    setActive(els.anchors, target);
    if (!takenOver) return;
    place(els.indicator, target, true);
  }

  /** 按当前路径从 DOM 的 href 里找对应链接 */
  function pickTarget(anchors: HTMLAnchorElement[], pathname: string): HTMLAnchorElement | null {
    for (const anchor of anchors) {
      if (navMatch(anchor.getAttribute('href') ?? '', pathname)) return anchor;
    }
    return null;
  }

  // 点击即移：目标就是被点链接本身（href 取自 DOM），不等 swup 换页完成；
  // 带修饰键 / 非左键是新标签页打开，当前页不切换，不动线
  document.addEventListener('click', (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('.nav-links a');
    if (!anchor) return;
    moveTo(anchor);
  });

  // 切页（含前进 / 后退）：astro:after-swap 派发时 URL 已更新；
  // 线已在目标位时（点击时移过去的）跳过
  document.addEventListener('astro:after-swap', () => {
    const els = getEls();
    if (!els) return;
    const target = pickTarget(els.anchors, window.location.pathname);
    if (target && target !== currentActive(els.anchors)) moveTo(target);
  });

  // resize：共享线重新对齐当前活动项。
  // 必须走过渡、不能瞬移：换页后内容高度变化会让滚动条出现 / 消失、视口宽度跟着变，
  // 从而在滑行途中触发 resize——这里若瞬移，线会中途跳到终点（观感即"跳变"）
  let raf = 0;
  window.addEventListener('resize', () => {
    if (!takenOver || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const els = getEls();
      if (!els || els.navLinks.offsetParent === null) return; // 切到移动端被隐藏，跳过
      const active = currentActive(els.anchors);
      if (active) place(els.indicator, active, true);
    });
  });

  // 接管时机：chunk 到达时样式通常已就位（样式表在 head 里比动态 import 更早请求），
  // 试一次；没就位就等 load（届时样式必已应用）。两路都幂等
  if (document.readyState === 'complete') {
    takeOver();
  } else {
    requestAnimationFrame(() => requestAnimationFrame(takeOver));
    window.addEventListener('load', takeOver, { once: true });
  }
})();

// 标记为模块：NavBar 走动态 import，TS 模块检查要求文件有顶层 export
export {};
