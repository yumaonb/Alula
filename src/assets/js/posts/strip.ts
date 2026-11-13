// strip.ts — 左缘条带的过场件：旧带克隆、模糊副本、残留清理
// 用法：const strip = createStrip({ row })
//
// 这里只有「造件」：谁在什么时候调用由转场编排（posts-shell.ts）决定。

import { EDGE_CLONE_CLASS, CLONE_SELECTOR } from '../util/post-sidebar';

export interface StripEnv {
  /** 当前文章区行（`.page-main`） */
  row: () => HTMLElement | null;
}

export interface Strip {
  cloneEdge(src: HTMLElement, container: HTMLElement): HTMLElement | null;
  cloneBlur(src: HTMLElement, container: HTMLElement): HTMLElement | null;
  clearClones(): void;
}

export function createStrip(env: StripEnv): Strip {
  /** 纯克隆核：把元素的视觉副本贴进容器内（过场用：不参与测量、不可交互、不进可访问性树）。
   *  container = 行（左缘条克隆与其模糊副本都直接挂行内，绝对定位按量出的 top/left 摆位）。
   *  克隆是纯静态展示（左缘条里没有 island）。
   *  清除时机：正常转场由 finished 回调移除；快速二次导航由 captureOld 查 DOM 清掉 */
  function cloneIntoRow(src: HTMLElement, container: HTMLElement): HTMLElement | null {
    const clone = src.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-posts-anchor');
    // 克隆按量出的 top/left/width 绝对定位，必须把类继承的 margin 清零：
    // .posts-header / .posts-breadcrumb 宽屏带负 margin-left 压过侧栏区（流内布局手段），
    // 对绝对定位元素这个 margin 仍会生效（left+width+margin-left 过约束时 margin-left 被保留），
    // 不清零整条克隆向左偏 284px，转场时标题「跑到左侧最前面」
    clone.style.margin = '0';
    const a = src.getBoundingClientRect();
    const b = container.getBoundingClientRect();
    clone.style.position = 'absolute';
    clone.style.top = `${a.top - b.top}px`;
    clone.style.left = `${a.left - b.left}px`;
    clone.style.width = `${a.width}px`;
    clone.style.zIndex = '20';
    clone.style.pointerEvents = 'none';
    clone.setAttribute('aria-hidden', 'true');
    container.appendChild(clone);
    return clone;
  }

  /** 左缘条克隆：加标记类供 clearClones 清残留，并挂 5s 兜底
   *  （覆盖「visit 被中断、after-swap 永不来」的孤儿） */
  function cloneMarked(
    src: HTMLElement,
    container: HTMLElement,
    markerClass: string,
  ): HTMLElement | null {
    const clone = cloneIntoRow(src, container);
    if (!clone) return null;
    clone.classList.add(markerClass);
    window.setTimeout(() => clone.remove(), 5000);
    return clone;
  }

  function cloneEdge(src: HTMLElement, container: HTMLElement): HTMLElement | null {
    return cloneMarked(src, container, EDGE_CLONE_CLASS);
  }

  /** 条带模糊副本：与左缘条同标记（clearClones 统一清），但不挂 5s 兜底——
   *  它淡出后恒不可见、随下次 before-swap 的 clearClones 清除，而 5s 定时移除 =
   *  随机静止时刻拆过滤层，弱内核下标题区会闪 */
  function cloneBlur(src: HTMLElement, container: HTMLElement): HTMLElement | null {
    const clone = cloneIntoRow(src, container);
    if (!clone) return null;
    clone.classList.add(EDGE_CLONE_CLASS);
    return clone;
  }

  /** 查 DOM 清掉所有残留克隆（模块变量可能已被 finished 清空，查 DOM 最可靠） */
  function clearClones(): void {
    env
      .row()
      ?.querySelectorAll<HTMLElement>(CLONE_SELECTOR)
      .forEach((c) => c.remove());
  }

  return { cloneEdge, cloneBlur, clearClones };
}
