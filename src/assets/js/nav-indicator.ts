// nav-indicator.ts — 导航下划线的运行时部分：
// 静态线（活动项的 ::after）负责首屏与加载期（服务端渲染，首帧即可见）；
// 样式确认应用后由共享线 .nav-indicator 独家接管绘制，此后点击 / 切页 / resize
// 都只重设它的目标位置——快速连点就是过渡重定向，线不会消失，也就不存在跳变。
// 改向不依赖浏览器的「飞行中自动重定向」，而是「钉住当前点 → 重新起一段过渡」，
// 杜绝个别浏览器把飞行中的过渡 snap 到端点的怪癖（观感即"瞬变"）。
// 切页后线去哪个按钮，按三分支判定（见 astro:after-swap 注释）：
// ① 换页目标 = 最近一次点击 → 意图完成；② 换页目标是点过但已被取代的旧按钮
// → swup 放行的迟到旧换页，忽略；③ 换页目标不是点过的任何按钮
// → 导航外操作（logo / 正文链接 / 前进后退），旧意图作废，跟随 URL。
// 动画时长按实际位移成比例（300–450ms），改向的短距离也不会一闪而过。
// 目标链接的 href 一律从 DOM 读取，不写死。
// 调试：URL 加 ?ntr=1 会在控制台打印线的移动时间线（平时静默）。
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

  // 最近一次点击的链接（线的「意图目标」）+ 最近点过的几个按钮（识别"迟到的旧换页"）。
  // swup 让已提交（state≥6）的旧访问先完成、新点击排队执行，旧换页的 after-swap
  // 会晚于新点击到达——recentClicks 用来区分"迟到的旧点击换页"和"导航外的新导航"
  let pendingTarget: HTMLAnchorElement | null = null;
  let recentClicks: HTMLAnchorElement[] = [];

  // 调试时间线：URL 带 ?ntr=1 时把每次移动 / 决策打到 console.debug
  const TRACE = /[?&]ntr=1/.test(window.location.search);
  function trace(label: string, ...rest: unknown[]): void {
    if (TRACE) console.debug('[nav-indicator]', label, ...rest);
  }

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

  /** 读线当前的 x 位置——过渡进行中时返回插值，即它此刻在屏幕上的真实位置 */
  function currentX(indicator: HTMLElement): number {
    const t = getComputedStyle(indicator).transform;
    if (t === 'none') return 0;
    const m = t.match(/matrix\(([^)]+)\)/);
    return m ? parseFloat(m[1].split(',')[4]) || 0 : 0;
  }

  /**
   * 把共享线对齐到链接文字（animate 为 false 时瞬移）。
   * 动画时：先把线钉回它此刻在屏幕上的位置（掐掉进行中的过渡），
   * 再按「起点 → 终点」实际位移成比例的时长（300–450ms，上下限夹取）起一段新过渡——
   * 不依赖浏览器「飞行中自动重定向」：个别浏览器在 transform 与时长同帧变化时
   * 会把进行中的过渡 snap 到端点，快速点击下表现为"瞬变"
   */
  function place(indicator: HTMLElement, anchor: HTMLAnchorElement, animate: boolean): void {
    const text = textOf(anchor);
    const targetX = text.offsetLeft;
    if (!animate) {
      indicator.style.transitionDuration = ''; // 清掉内联时长，让 .no-transition 真正生效
      indicator.classList.add(NO_TRANSITION);
      indicator.style.transform = `translateX(${targetX}px)`;
      indicator.style.width = `${text.offsetWidth}px`;
      void indicator.offsetHeight; // 先落位再恢复过渡
      indicator.classList.remove(NO_TRANSITION);
      return;
    }
    const fromX = currentX(indicator);
    const dx = Math.abs(targetX - fromX);
    if (dx < 1) return; // 已在目标位（如 resize 重对齐时），不跑过渡
    // 钉住当前点：去掉在飞过渡，把它固化为新起点
    indicator.style.transitionDuration = '0ms, 0ms';
    indicator.style.transform = `translateX(${fromX}px)`;
    void indicator.offsetHeight;
    const ms = Math.max(300, Math.min(450, dx * 3.4));
    indicator.style.transitionDuration = `${ms}ms, ${ms}ms`;
    indicator.style.transform = `translateX(${targetX}px)`;
    indicator.style.width = `${text.offsetWidth}px`;
    trace('move', `x ${Math.round(fromX)}→${Math.round(targetX)}`, `dx=${Math.round(dx)}px`, `${ms}ms`);
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
    trace('takeover', textOf(active).textContent ?? '');
  }

  /** 移动线到 target：已接管则共享线滑动（快速连点 = 钉住当前点重新起过渡）；
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

  /** 意图状态全部作废（换页完成 / 导航外操作 / 前进后退） */
  function clearIntent(): void {
    pendingTarget = null;
    recentClicks = [];
  }

  // 点击即移：目标就是被点链接本身（href 取自 DOM），不等 swup 换页完成；
  // 带修饰键 / 非左键是新标签页打开，当前页不切换，不动线
  document.addEventListener('click', (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // e.target 可能是文本节点（点正踩在文字上），它没有 closest，直接调会抛错
    // 让整个监听器中断——swup 的 delegate-it 同样先做了这道守卫
    const raw = e.target as Node | null;
    const el = raw instanceof Element ? raw : raw?.parentElement ?? null;
    const anchor = el?.closest<HTMLAnchorElement>('.nav-links a') ?? null;
    if (!anchor) return;
    trace('click', textOf(anchor).textContent ?? '');
    pendingTarget = anchor;
    recentClicks.push(anchor);
    if (recentClicks.length > 3) recentClicks.shift(); // 只会有一个被取代的旧访问产生迟到换页，留 3 个足够
    moveTo(anchor);
  });

  // 前进 / 后退没有点击意图，清掉旧目标，after-swap 回到「跟随 URL」
  window.addEventListener('popstate', () => {
    clearIntent();
  });

  // 切页（含前进 / 后退）：astro:after-swap 派发时 URL 已更新，三分支判定线去哪个按钮：
  // ① 目标 = 最近一次点击：那次点击的换页到了，意图完成（线点击时已移过去，正常跳过）
  // ② 目标 ∈ 最近点过但不是最新：被取代旧访问的迟到换页（swup 对 state≥6 的旧访问
  //    放行完成、新点击排队），跟随会把线从新点击位置拉回旧按钮——忽略
  // ③ 目标 ∉ 点过的任何按钮：导航外操作（logo / 正文链接）触发的换页，
  //    旧点击意图已作废（其访问要么被中断要么被丢弃，不会再有换页）——跟随 URL
  document.addEventListener('astro:after-swap', () => {
    const els = getEls();
    if (!els) return;
    const target = pickTarget(els.anchors, window.location.pathname);
    if (!target) {
      clearIntent();
      return;
    }
    if (target === pendingTarget) {
      trace('after-swap', window.location.pathname, 'intent done');
      clearIntent();
    } else if (recentClicks.includes(target)) {
      trace('after-swap', window.location.pathname, 'stale, ignored');
      return; // 迟到的旧换页：线保持在最新点击处
    } else {
      trace('after-swap', window.location.pathname, 'external, follow');
      clearIntent();
    }
    if (target !== currentActive(els.anchors)) moveTo(target);
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
      if (active) {
        trace('resize');
        place(els.indicator, active, true);
      }
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
