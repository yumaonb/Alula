// early-nav.ts — 首屏 swup 实例未就绪时的区内点击接管 + fetch 失败兜底
// 用法：const earlyNav = createEarlyNav({ row, reduceMotion, isMobile, floatCtl })
//
// 首屏实例在 load + idle 才创建，此前点卡片会走原生整页跳转（落地不播转场）：
// 这里拦下点击、等实例就绪后 navigate() 转成正常切页，超时回退原生跳转。
import type { SearchFloatCtl } from './search-float';

export interface EarlyNavEnv {
  /** 当前文章区行（`.page-main`） */
  row: () => HTMLElement | null;
  reduceMotion: boolean;
  isMobile: () => boolean;
  floatCtl: SearchFloatCtl;
}

export interface EarlyNav {
  onEarlyClick(e: MouseEvent): void;
  onDocClick(): void;
  bindSwupHooks(): void;
  /** 切页已提交 / 导航失败：在途的早期点击等待作废 */
  cancel(): void;
}

export function createEarlyNav(env: EarlyNavEnv): EarlyNav {
  const { row, floatCtl, reduceMotion, isMobile } = env;
  // window.swup 在实例赋值前会被 DOM id 回退解析成 <main id="swup"> 元素（truthy），
  // !!window.swup 判不出就绪，必须按实例自身特征甄别
  interface SwupLike {
    hooks: { on: (name: string, handler: () => void) => void };
    navigate: (url: string) => void;
  }
  function realSwup(): SwupLike | null {
    const s = (window as Window & { swup?: unknown }).swup;
    if (!s || typeof s !== 'object') return null;
    const sw = s as Partial<SwupLike>;
    return sw.hooks && typeof sw.navigate === 'function' ? (s as SwupLike) : null;
  }

  // swup 实例钩子：@swup/astro 只在 document 上桥接 astro:before-swap / after-swap / page-load
  // 三个事件，覆盖不了「fetch 失败」——用 astro.config.ts globalInstance: true 暴露的
  // window.swup（swup 在 onIdleAfterLoad 才初始化，实例可能晚于本模块——钩子按需在首次点击时绑）。
  // 用途：fetch 失败（404 / 中断）且仍留在列表系界面时恢复搜索框（兜底：搜索框点击时
  // 不动，失败时通常尚未退场，本回调只覆盖在途被打断的少数情形）。
  let swupHooksBound = false;
  // 首屏实例未就绪时点区内链接：拦截原生全页跳转，等实例就绪后 navigate() 转正场，
  // 超时回退原生跳转（此变量是该轮询的在途状态）
  let pendingEarlyNav: { url: string; timer: number } | null = null;
  // 实例在 load+idle 才创建：慢网/冷缓存下 load 可超 5s（首载场景），时限要覆盖它
  const EARLY_NAV_TIMEOUT_MS = 10000;

  /** 作废在途的早期点击等待：先清定时器再置空——只置空的话下一拍会被旧定时器写回，
   *  等 swup 就绪后按旧链接导航（或超时后整页跳到上一次点的地址） */
  function stopPolling(): void {
    if (pendingEarlyNav) window.clearTimeout(pendingEarlyNav.timer);
    pendingEarlyNav = null;
  }

  function bindSwupHooks(): void {
    if (swupHooksBound) return;
    const swup = realSwup();
    // 实例未就绪（取到的是 <main> 元素回退）——不打污染标记，下次点击再绑
    if (!swup) return;
    swupHooksBound = true;
    const restoreAfterFail = () => {
      // 导航已失败：早期等待随之作废，走原生兜底结果
      stopPolling();
      // 只在「仍停在列表系界面」时恢复——失败后内容未换，若此刻在详情页，
      // 搜索不该出现
      if (floatCtl.state !== 'shown' && row()?.classList.contains('page-main--listing'))
        floatCtl.settle(true);
    };
    swup.hooks.on('fetch:error', restoreAfterFail);
    swup.hooks.on('visit:abort', restoreAfterFail);
  }

  /** 首屏实例未就绪时点区内链接：swup 点击委托还没挂载，原生跳转 = 整页加载，
   *  落地首屏不播转场（首次访问时点卡片，动效不播）。
   *  拦截点击、等实例就绪后 navigate() 转成正常切页——转场照常播；
   *  超时回退原生跳转（整页加载，与现状一致）。跨区目的地本就无转场，不拦截 */
  function onEarlyClick(e: MouseEvent): void {
    // 实例已就绪：swup 自己的委托接管
    if (reduceMotion || realSwup()) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    const a = t.closest('a[href]');
    if (!(a instanceof HTMLAnchorElement)) return;
    const href = a.getAttribute('href') ?? '';
    if (!href.startsWith('/posts/') || a.target === '_blank') return;
    if (a.hasAttribute('data-no-swup') || t.closest('[data-no-swup]')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const r = row();
    if (
      !r ||
      (!r.classList.contains('page-main--listing') && !r.classList.contains('page-main--post'))
    )
      return;
    // 同页
    if (href.replace(/\/+$/, '') === location.pathname.replace(/\/+$/, '')) return;
    e.preventDefault();
    stopPolling();
    const started = Date.now();
    const poll = (): void => {
      const s = realSwup();
      if (s) {
        // 导航已正式发起：早期点击等待结束（before-swap 时统一清掉）
        try {
          s.navigate(href);
        } catch {
          stopPolling();
          location.assign(href);
        }
        return;
      }
      if (Date.now() - started > EARLY_NAV_TIMEOUT_MS) {
        stopPolling();
        location.assign(href);
        return;
      }
      pendingEarlyNav = { url: href, timer: window.setTimeout(poll, 100) };
    };
    pendingEarlyNav = { url: href, timer: window.setTimeout(poll, 100) };
  }

  /** 手机端：点击只绑 swup 钩子（fetch 失败兜底）。搜索框显隐不在点击时动——
   *  点击时动会旧内容仍在屏上，搜索框比新页面加载完先消失；
   *  退场/入场/settle 全部由 playTransition 在 after-swap 统一驱动
   *  （区内「开文章」在那里启动退场、跨区 settle 直接消失/出现） */
  function onDocClick(): void {
    if (reduceMotion || !isMobile()) return;
    bindSwupHooks();
  }
  function cancel(): void {
    stopPolling();
  }

  return { onEarlyClick, onDocClick, bindSwupHooks, cancel };
}
