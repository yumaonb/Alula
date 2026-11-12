// nav-indicator.ts — 导航下划线的运行时部分：
// 静态线（活动项的 ::after）负责首屏与加载期（服务端渲染，首帧即可见）；
// 样式确认应用后由共享线 .nav-indicator 独家接管绘制，此后点击 / 切页 / resize
// 都只重设它的目标位置。位移由 motion 驱动：改向时以「飞行中位置」为起点
// 重新起一段过渡，快速连点就是平滑重定向，线不会消失，也就不存在跳变。
// 切页后线去哪个按钮，按三分支判定（见 content:replace 处的注释）：
// ① 换页目标 = 最近一次点击 → 意图完成；② 换页目标是点过但已被取代的旧按钮
// → swup 放行的迟到旧换页，忽略；③ 换页目标不是点过的任何按钮
// → 导航外操作（logo / 正文链接 / 前进后退），旧意图作废，跟随 URL。
// 动画时长按实际位移成比例（450–700ms，偏从容的滑行），改向的短距离也不会一闪而过。
// 目标链接的 href 一律从 DOM 读取，不写死。
// 调试：URL 加 ?ntr=1 会在控制台打印线的移动时间线（平时静默）。
// 用法：由 NavBar.astro 在桌面端动态 import（手机端不加载）：import "../../assets/js/nav/nav-indicator"
import type { AnimationPlaybackControls } from 'motion';
import { navMatch } from '../../../lib/nav-match';
import { readTranslate } from '../util/dom';
import { animateLazy as animate } from '../util/motion';

(() => {
  if (window.__navIndicatorInit) return;
  window.__navIndicatorInit = true;

  const ACTIVE = 'is-active';
  const READY = 'js-ready';
  const ON = 'is-on';
  // 快起缓收（与后台侧栏一致）
  const EASE_NAV_INDICATOR: [number, number, number, number] = [0.32, 0.72, 0, 1];

  let takenOver = false;
  let controls: AnimationPlaybackControls | null = null;

  // 最近一次点击的链接（线的「意图目标」）+ 最近点过的几个按钮（识别"迟到的旧换页"）。
  // swup 让已提交的旧访问先完成、新点击排队执行，旧换页的 content:replace
  // 会晚于新点击到达——recentClicks 用来区分"迟到的旧点击换页"和"导航外的新导航"。
  // 判定只用 swup 公开事件带出来的信息（content:replace 的 visit.trigger.el），
  // 不看 swup 的内部状态编号——内部编号属于私有实现，升级无兼容承诺。
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

  /** 下划线量测目标：图标 + 文字的包裹层（.nav-link-inner），下划线一并描住图标 */
  function textOf(anchor: HTMLAnchorElement): HTMLElement {
    return anchor.querySelector<HTMLElement>('.nav-link-inner') ?? anchor;
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
    return readTranslate(indicator).x;
  }

  /** 下划线对齐目标量测：图标 + 文字的包裹层位置与宽度 */
  function measureTarget(anchor: HTMLAnchorElement): { x: number; width: number } {
    const text = textOf(anchor);
    return { x: text.offsetLeft, width: text.offsetWidth };
  }

  /** 瞬移：取消在飞过渡并直接写目标位（接管时与静态线同帧换画者，不允许滑行） */
  function placeImmediately(indicator: HTMLElement, anchor: HTMLAnchorElement): void {
    const target = measureTarget(anchor);
    controls?.cancel();
    controls = null;
    indicator.style.transform = `translateX(${target.x}px)`;
    indicator.style.width = `${target.width}px`;
  }

  /**
   * 动画：以飞行中位置为起点，按「起点 → 终点」实际位移成比例的时长
   * （450–700ms，上下限夹取）起一段新过渡；改向自然从飞行中位置续接。
   * 已在目标位（如 resize 重对齐时）不跑过渡
   */
  function animateTo(indicator: HTMLElement, anchor: HTMLAnchorElement): void {
    const target = measureTarget(anchor);
    const fromX = currentX(indicator);
    const dx = Math.abs(target.x - fromX);
    if (dx < 1) return;
    const ms = Math.max(450, Math.min(700, dx * 3.4));
    controls = animate(
      indicator,
      { x: [fromX, target.x], width: [indicator.offsetWidth, target.width] },
      { duration: ms / 1000, ease: EASE_NAV_INDICATOR },
    );
    trace(
      'move',
      `x ${Math.round(fromX)}→${Math.round(target.x)}`,
      `dx=${Math.round(dx)}px`,
      `${ms}ms`,
    );
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
    if (getComputedStyle(els.navLinks).display !== 'flex') {
      // 样式还没算完：下一帧再试，不放弃
      retryTakeOver();
      return;
    }
    const active = pickTarget(els.anchors, window.location.pathname) ?? currentActive(els.anchors);
    if (!active) {
      retryTakeOver();
      return;
    }
    takenOver = true;
    setActive(els.anchors, active);
    placeImmediately(els.indicator, active);
    els.indicator.classList.add(ON);
    // 静态线从此让位
    els.navLinks.classList.add(READY);
    trace('takeover', textOf(active).textContent ?? '');
  }

  /**
   * 接管失败后的重试：只安排一帧，失败就再安排一帧，最多试若干次。
   * 之前「一次没赶上」就变成永久——resize 与 after-swap 两个入口都带着 takenOver 前置条件，
   * 没有别的路径能再接上，线就一直是每项一条静态短线。
   */
  const TAKE_OVER_MAX_RETRY = 20;
  let takeOverRetry = 0;
  let takeOverRaf = 0;

  function retryTakeOver(): void {
    if (takenOver || takeOverRetry >= TAKE_OVER_MAX_RETRY) return;
    if (takeOverRaf) return;
    takeOverRetry += 1;
    takeOverRaf = requestAnimationFrame(() => {
      takeOverRaf = 0;
      takeOver();
    });
  }

  /** 移动线到 target：已接管则共享线滑动（快速连点 = 从飞行中位置重新起过渡）；
   *  未接管（首屏 / 加载期）只挪 is-active，静态线即时切换 */
  function moveTo(target: HTMLAnchorElement): void {
    const els = getEls();
    if (!els) return;
    if (currentActive(els.anchors) === target) return;
    setActive(els.anchors, target);
    if (!takenOver) return;
    animateTo(els.indicator, target);
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
    const el = raw instanceof Element ? raw : (raw?.parentElement ?? null);
    const anchor = el?.closest<HTMLAnchorElement>('.nav-links a') ?? null;
    if (!anchor) return;
    trace('click', textOf(anchor).textContent ?? '');
    pendingTarget = anchor;
    recentClicks.push(anchor);
    // 只会有一个被取代的旧访问产生迟到换页，留 3 个足够
    if (recentClicks.length > 3) recentClicks.shift();
    moveTo(anchor);
  });

  // 前进 / 后退没有点击意图，清掉旧目标，after-swap 回到「跟随 URL」
  window.addEventListener('popstate', () => {
    clearIntent();
  });

  /**
   * 切页（含前进 / 后退）时判定线去哪个按钮。
   * 依据是 swup 公开事件 content:replace 带出来的 visit.trigger.el——
   * 那是「触发这次换页的链接」，公开 API，升级不会变：
   * ① trigger 是最近一次点击的链接 → 那次点击的换页到了，意图完成
   * ② trigger 是更早点过的链接 → 被取代旧访问的迟到换页（swup 让旧访问先完成、
   *    新点击排队），跟随会把线从新点击位置拉回旧按钮——忽略，线保持在最新点击处
   * ③ 没有 trigger（logo / 正文链接 / 前进后退触发）→ 导航外操作，
   *    旧点击意图已作废——跟随 URL
   */
  document.addEventListener('swup:content:replace', (e: Event) => {
    const detail = (e as CustomEvent<{ visit?: { trigger?: { el?: Element | null } } }>).detail;
    const triggerEl = detail?.visit?.trigger?.el ?? null;
    const triggerAnchor =
      triggerEl instanceof Element ? triggerEl.closest<HTMLAnchorElement>('.nav-links a') : null;

    const els = getEls();
    if (!els) return;
    // 还没接管就先试接管：切页后布局重算，时机上正是接管该发生的时刻
    if (!takenOver) retryTakeOver();

    if (triggerAnchor) {
      if (triggerAnchor === pendingTarget) {
        trace('content:replace', window.location.pathname, 'intent done');
        clearIntent();
      } else if (recentClicks.includes(triggerAnchor)) {
        trace('content:replace', window.location.pathname, 'stale, ignored');
        // 迟到的旧换页：线保持在最新点击处
        return;
      }
    } else {
      trace('content:replace', window.location.pathname, 'external, follow');
      clearIntent();
    }

    const target = pickTarget(els.anchors, window.location.pathname);
    if (!target) return;
    if (target !== currentActive(els.anchors)) moveTo(target);
  });

  // resize：共享线重新对齐当前活动项。
  // 必须走过渡、不能瞬移：换页后内容高度变化会让滚动条出现 / 消失、视口宽度跟着变，
  // 从而在滑行途中触发 resize——这里若瞬移，线会中途跳到终点（观感即"跳变"）
  let raf = 0;
  window.addEventListener('resize', () => {
    // 还没接管就先试接管：resize 往往是布局就绪的那一刻，正是接管该发生的时机
    if (!takenOver) {
      retryTakeOver();
      return;
    }
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const els = getEls();
      // 切到移动端被隐藏，跳过
      if (!els || els.navLinks.offsetParent === null) return;
      const active = currentActive(els.anchors);
      if (active) {
        trace('resize');
        animateTo(els.indicator, active);
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
  // 兜底：两条路都错过时，靠定时重试接上
  window.setTimeout(retryTakeOver, 300);
})();

// 标记为模块：NavBar 走动态 import，TS 模块检查要求文件有顶层 export
export {};
