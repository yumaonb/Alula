// swup-widgets.ts — 侧边悬浮按钮列运行时控制器（可用性 / 显隐 / 进度环 / 点击）
// 用法：由 BaseLayout 引入：import "../assets/js/nav/swup-widgets"
// 职责：可用性按页面类型+视口重估（.unavailable/.compact）；滚动驱动显隐（.visible）；
//       进度环更新（stroke-dashoffset + 百分比文本）；向上/向下/到评论跳转。
//       目录（#toc-fab）与筛选（#posts-filter-fab）按钮分别由 TocModal / PostsFilterModal 监听。
// 切页放行：切页开始即压制按钮，新内容就绪后保持压制，直到页面滚回顶部、
//       平滑滚动结束（swup:scroll:end），或新内容渲染后 250ms 兜底超时为止。
// 回顶放行：点「回到顶部」即刻收起按钮，等滚到顶部、用户反向滚动或 2s 兜底后交还。
import { detectPageKind } from '../util/page-kind';
import { queryTocNav } from '../util/post-sidebar';

const container = document.getElementById('side-widgets');
if (container) initSideWidgets(container);

function initSideWidgets(container: HTMLElement): void {
  // 滚动超过该值才显示按钮
  const SHOW_AT = 100;
  // 新内容就绪后等滚动动画启动的窗口，超时按当前位置放行
  const IDLE_RELEASE_MS = 250;
  // 「回到顶部」平滑滚动的兜底放行时间：滚动被用户打断时不能永久压制
  const RETURN_TOP_MAX_MS = 2000;
  const WIDGET_ORDER = ['top', 'toc', 'filter', 'progress', 'comments', 'bottom'];
  // 键与 SideWidgets.astro 的 data-widget 一一对应，增 / 删 / 改名悬浮按钮两处同改

  const buttons: Record<string, HTMLElement> = {};
  container.querySelectorAll<HTMLElement>('.back-to-widget').forEach((btn) => {
    const key = btn.dataset.widget;
    if (key) buttons[key] = btn;
  });

  const progressBtn = buttons['progress'];
  const progressBar = progressBtn ? progressBtn.querySelector('.progress-ring-bar') : null;
  const progressText = progressBtn ? progressBtn.querySelector('.progress-text') : null;
  // 登记的键必须在 DOM 里都有对应按钮：拼错 data-widget 时该按钮会从下面这张表里静默消失，
  // 之后显隐 / 点击全都不再管它，页面上表现为「按钮永久失踪」且控制台无声
  for (const key of WIDGET_ORDER) {
    if (!buttons[key]) console.error(`[swup-widgets] 缺少按钮: ${key}`);
  }

  const available = WIDGET_ORDER.map((k) => buttons[k]).filter((btn): btn is HTMLElement => !!btn);

  // swup 切页挂起：切页开始 → 页面回到顶部/滚动结束 期间为 true
  let busy = false;
  // swup 平滑滚动（scroll plugin）进行中
  let scrolling = false;
  // 兜底定时器：新内容就绪后平滑滚动若迟迟不开始，按当前位置放行
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  // 点「回到顶部」后的压制：按钮即刻收起，等滚动落定再交还（见 startReturnTop）
  let returningTop = false;
  // 起点的滚动位置：用来识别「用户中途往回滚」，那种情况要立刻交还
  let returnTopFrom = 0;
  let returnTopTimer: ReturnType<typeof setTimeout> | null = null;
  let rafId = 0;

  function markUnavailable(key: string, flag: boolean): void {
    const btn = buttons[key];
    if (btn) btn.classList.toggle('unavailable', !!flag);
  }

  function pageContext() {
    return {
      ...detectPageKind(),
      // 「这页有没有目录」口径之一：有没有条目（全部口径见 PostsShell.astro 的 hasToc 注释）
      toc: !!queryTocNav()?.querySelector('.toc-link'),
      comments: !!document.getElementById('comments-section'),
    };
  }

  function probe(): void {
    const { detail, list, toc, comments } = pageContext();
    // 768/769 是全站手机 / 桌面分界，改分界要与 nav/breakpoint.ts 及其它模块的探测同改（见其文件头）
    const w = window.innerWidth;

    // 筛选按钮：侧栏不可见时才需要——文章变体 ≤1150（侧栏 ≥1151 显示）、
    // 列表变体 ≤768（≥769 显示），断点互补；改这里要同改 src/assets/css/global.css 的
    // .global-sidebar 显隐媒体查询
    let filterMode = 'none';
    if (detail) filterMode = w <= 1150 ? 'detail' : 'none';
    else if (list) filterMode = w <= 768 ? 'list' : 'none';

    // 目录按钮：右侧目录栏不可见时才需要（src/layouts/PostsShell.astro ≤850 隐藏右侧栏，
    // 与 posts/toc.ts 的目录抽屉模式阈值同值）
    markUnavailable('toc', !(toc && w <= 850));
    markUnavailable('comments', !comments);
    markUnavailable('filter', filterMode === 'none');
    buttons['filter']?.classList.toggle('compact', filterMode === 'list');
  }

  function release(): void {
    busy = false;
    scrolling = false;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    container.classList.remove('navigating');
    // 立即按当前滚动位置刷新显隐，避免兜底放行后按钮状态滞后
    render();
  }

  function render(): void {
    const y = window.scrollY;

    // 页面已滚回顶部 → 挂起结束（哪怕平滑滚动只剩收尾，顶部即视为"完全到顶"）
    if (busy && y <= SHOW_AT) release();

    // 回到顶部途中：到顶、或用户反过来往下滚，都立刻交还给滚动逻辑
    if (returningTop && (y <= SHOW_AT || y > returnTopFrom)) stopReturnTop();

    // 挂起期间不驱动显隐（按钮已在切页 / 回顶时被压制成隐藏）
    const show = y > SHOW_AT && !busy && !returningTop;
    for (const btn of available) {
      const usable = show && !btn.classList.contains('unavailable');
      btn.classList.toggle('visible', usable);
    }

    const doc = document.documentElement;
    const max = Math.max(0, doc.scrollHeight - window.innerHeight);
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    // 100 是 SideWidgets.astro 进度环 rect pathLength="100" 的刻度，改刻度两处同改
    if (progressBar) progressBar.setAttribute('stroke-dashoffset', String(100 * (1 - p)));
    if (progressText) progressText.textContent = `${Math.round(p * 100)}%`;
  }

  /** 点「回到顶部」后立刻收起按钮，不等滚动动画走完。
   *  只靠 render(0) 不够：下一个滚动事件会按真实位置把它们顶回来，看起来像闪一下。 */
  function startReturnTop(): void {
    returningTop = true;
    returnTopFrom = window.scrollY;
    available.forEach((btn) => btn.classList.remove('visible'));
    if (returnTopTimer) clearTimeout(returnTopTimer);
    // 兜底：滚动被用户打断、或没有可等的滚动事件时，按当前位置恢复显隐
    returnTopTimer = setTimeout(() => {
      returnTopTimer = null;
      stopReturnTop();
      render();
    }, RETURN_TOP_MAX_MS);
  }

  function stopReturnTop(): void {
    returningTop = false;
    if (returnTopTimer) {
      clearTimeout(returnTopTimer);
      returnTopTimer = null;
    }
  }

  function onScroll(): void {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      render();
    });
  }

  function onResize(): void {
    probe();
    render();
  }

  /* ---- 点击：目录 / 筛选由抽屉组件监听，这里只处理直接跳转类 ---- */
  container.addEventListener('click', (e: MouseEvent) => {
    const btn = e.target instanceof Element ? e.target.closest('.back-to-widget') : null;
    if (!btn || btn.classList.contains('unavailable')) return;
    const key = (btn as HTMLElement).dataset.widget;
    if (key === 'top') {
      startReturnTop();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (key === 'bottom') {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    } else if (key === 'comments') {
      const target = document.getElementById('comments-section');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /** 内容替换完成后：可用性按新页面重估，但保持压制，
      直到页面滚回顶部 / 滚动动画结束 / 兜底超时，再交还滚动逻辑 */
  function onContentReplaced(): void {
    container.classList.add('navigating');
    available.forEach((btn) => btn.classList.remove('visible'));
    probe();
    busy = true;
    scrolling = false;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    // 兜底：若 250ms 内平滑滚动尚未开始（切到短页/滚动直接重置等），按当前位置放行，
    // 避免无滚动事件可等时永久挂起；一旦 scroll:start 到来会取消本定时器。
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (busy && !scrolling) release();
    }, IDLE_RELEASE_MS);
    render();
  }

  /* ---- swup 切页：开始即压制，等页面真正回到顶部后再交还 ---- */
  document.addEventListener('swup:visit:start', () => {
    busy = true;
    scrolling = false;
    // 回顶压制属于上一次交互，切页时一并收掉，交给下面的切页流程接管
    stopReturnTop();
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    container.classList.add('navigating');
    available.forEach((btn) => btn.classList.remove('visible'));
  });

  // swup 内置 scroll 插件的平滑滚动开始/结束。以 scroll:end 为"落定"信号：
  // 平滑回顶可能耗时数秒，只有它真正结束（或滚动事件到顶）才放行按钮。
  document.addEventListener('swup:scroll:start', () => {
    if (!busy) return;
    scrolling = true;
    // 已有滚动动画，取消兜底
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  });

  document.addEventListener('swup:scroll:end', () => {
    scrolling = false;
    // 滚动已结束：按落点恢复正常显隐（回到顶部则隐藏，停在中段则显示可用按钮）
    if (busy) release();
  });

  // 访问可能提前结束（例如返回上一页缓存直跳、无平滑滚动路径）：兜底放行
  document.addEventListener('swup:visit:end', () => {
    if (busy && !scrolling) release();
  });

  document.addEventListener('swup:content:replace', onContentReplaced);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  probe();
  render();
}
