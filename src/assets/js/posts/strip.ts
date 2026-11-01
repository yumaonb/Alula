// strip.ts — 左缘条带与目录的过场件：克隆、目录屏幕外距离、目录入场动作、落位等待
// 用法：const strip = createStrip({ row, track, reduceMotion, tocSlideGate })
//
// 这里只有「造件」与「造动作」：谁在什么时候调用由转场编排（posts-shell.ts）决定。
import { animate } from 'motion';
import type { AnimationPlaybackControls } from 'motion';

import { EASE, EASE_ENTRY, EDGE_MS, PHASE_MS } from './transition-tokens';

// 目录移出屏幕的额外余量（整体在视口右缘之外）
const TOC_OFFSCREEN_PAD = 40;
// 文章↔文章新目录入场的「落位等待」上限：滚顶被用户滚动打断 / 异常停住时不能永久
// 藏目录，超时直接播（此时目录若在视口上方，滑入不可见、无副作用）
const TOC_SETTLE_TIMEOUT_MS = 2500;

export interface StripEnv {
  /** 当前文章区行（`.page-main`） */
  row: () => HTMLElement | null;
  /** 登记转场动画：切页清场时统一 cancel */
  track: (a: AnimationPlaybackControls) => AnimationPlaybackControls;
  reduceMotion: boolean;
  /** 目录滑动是否可用（电脑端显示目录时才走位移，窄屏只渐显） */
  tocSlideGate: () => boolean;
}

export interface Strip {
  cloneIntoRow(
    src: HTMLElement,
    container: HTMLElement,
    markerClass?: string,
    noFallback?: boolean,
  ): HTMLElement | null;
  clearClones(): void;
  tocOffscreenDx(el: HTMLElement): number;
  makeTocEntry(newToc: HTMLElement): () => void;
  startTocEntryWait(newToc: HTMLElement, play: () => void): void;
  cancelTocEntryWait(): void;
}

export function createStrip(env: StripEnv): Strip {
  // 文章↔文章新目录入场的落位等待（rAF + 超时，双退出条件；captureOld 清）
  let tocEntryWait: { rafId: number; timerId: number } | null = null;

  /** 把元素的视觉副本贴进容器内（过场用：不参与测量、不可交互、不进可访问性树）。
   *  container = 行（左缘条克隆与目录克隆都直接挂行内，绝对定位按量出的 top/left 摆位）。
   *  克隆是纯静态展示（左缘条与目录里没有 island）。
   *  清除时机：正常转场由 finished 回调移除；快速二次导航由 captureOld 查 DOM 清掉；
   *  5s 兜底只覆盖「visit 被中断、after-swap 永不来」的孤儿 */
  function cloneIntoRow(
    src: HTMLElement,
    container: HTMLElement,
    markerClass?: string,
    noFallback = false,
  ): HTMLElement | null {
    const clone = src.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-posts-anchor');
    if (markerClass) clone.classList.add(markerClass);
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
    // 兜底：孤儿克隆 5s 后移除（visit 被中断、after-swap 永不来）；after-swap 之后才建的克隆
    // （条带模糊副本）不挂兜底——它淡出后恒不可见、随下次 before-swap 的 clearClones 清除，
    // 而 5s 定时移除 = 随机静止时刻拆过滤层，弱内核下标题区会闪
    if (!noFallback) window.setTimeout(() => clone.remove(), 5000);
    return clone;
  }

  /** 查 DOM 清掉所有残留克隆（模块变量可能已被 finished 清空，查 DOM 最可靠） */
  function clearClones(): void {
    env
      .row()
      ?.querySelectorAll<HTMLElement>('.posts-edge-clone, .posts-toc-clone')
      .forEach((c) => c.remove());
  }

  /** 目录移出屏幕的距离：整体移到视口右缘之外 + 余量（按元素左缘计算） */
  function tocOffscreenDx(el: HTMLElement): number {
    return Math.max(
      120,
      Math.ceil(window.innerWidth - el.getBoundingClientRect().left + TOC_OFFSCREEN_PAD),
    );
  }

  /** 目录入场动作的构造（相位开始前先钉在屏外/透明，同任务内无绘制间隙、不闪）：
   *  电脑端自屏幕右缘左移渐显——位移与渐显同步（PHASE_MS/EASE_ENTRY），与搜索框
   *  移动切换同节奏；其他只渐显（400ms）。
   *  用于「旧界面没有目录、新界面出现」的进入相位（列表→文章，退出相位由搜索承担；
   *  有旧目录克隆的切页走退场相位或并行交叉渐隐，不经这里） */
  function makeTocEntry(newToc: HTMLElement): () => void {
    if (env.tocSlideGate()) {
      const dx = tocOffscreenDx(newToc);
      newToc.style.transform = `translateX(${dx}px)`;
      newToc.style.opacity = '0';
      return () => {
        const move = env.track(
          animate(
            newToc,
            { x: [`${dx}px`, 0] },
            {
              duration: PHASE_MS / 1000,
              ease: EASE_ENTRY,
              reduceMotion: env.reduceMotion,
              autoplay: false,
            },
          ),
        );
        const fade = env.track(
          animate(
            newToc,
            { opacity: [0, 1] },
            {
              duration: PHASE_MS / 1000,
              ease: EASE_ENTRY,
              reduceMotion: env.reduceMotion,
              autoplay: false,
            },
          ),
        );
        const cleanup = (): void => {
          newToc.style.transform = '';
          newToc.style.opacity = '';
        };
        move.finished.then(cleanup).catch(() => {});
        fade.finished.then(cleanup).catch(() => {});
      };
    }
    // 非 gate 只渐显：首关键帧是 opacity 0、元素自然态是 1——延迟起播的空窗帧先
    // 同步钉不可见（同任务、无绘制间隙），出帧后渐显
    newToc.style.opacity = '0';
    return () => {
      env.track(
        animate(
          newToc,
          { opacity: [0, 1] },
          {
            duration: EDGE_MS / 1000,
            ease: EASE,
            reduceMotion: env.reduceMotion,
            autoplay: false,
          },
        ),
      );
    };
  }

  /** 文章↔文章的新目录入场：落位等待 + 标准右缘滑入。在旧目录退场播完后调用
   *  （先退场再入场）。滚回顶部过程中新目录在视口上方（或正从上方落下）——退场前
   *  已钉不可见（gate 分支 makeTocEntry 构造即钉、非 gate 分支调用方钉内联 opacity
   *  0），等待期不可见，也不露空位（等待期它本来就在视口上方）。等它落到 sticky
   *  钉住位再播滑入：落位后视口位置静止（钉在 82px），入场才是纯水平平移。落位判定
   *  用 scrollY（免逐帧布局读取）：目录文档坐标 yToc 只读一次，滚到 scrollY ≤ yToc
   *  - 82 即到达钉住位（目录视口 top 恒 ≤ 82px，越过即终态）；已在钉住位（短文 /
   *  页面本就在顶部）则下一帧立即播。超时兜底：滚顶被用户滚动打断 / 异常停住时不能
   *  永久藏目录——超时直接播（目录若在视口上方，滑入不可见）。退出条件：落位或超时
   *  触发入场；captureOld（新一轮切页）清 rAF 与定时器 */
  function startTocEntryWait(newToc: HTMLElement, play: () => void): void {
    cancelTocEntryWait();
    const yToc = newToc.getBoundingClientRect().top + window.scrollY;
    const begin = (): void => {
      tocEntryWait = null;
      play();
    };
    const timerId = window.setTimeout(begin, TOC_SETTLE_TIMEOUT_MS);
    const check = (): void => {
      // 已被 captureOld 清掉
      if (!tocEntryWait) return;
      // 82 就是文章变体行的 padding-top，也是目录 sticky 的吸附位：global.css 的
      // .page-main--listing / --post 与 PostsShell.astro 的 .post-sidebar top，改一处要三处同改
      if (window.scrollY <= yToc - 82) {
        window.clearTimeout(timerId);
        begin();
        return;
      }
      tocEntryWait.rafId = window.requestAnimationFrame(check);
    };
    tocEntryWait = { rafId: 0, timerId };
    tocEntryWait.rafId = window.requestAnimationFrame(check);
  }

  function cancelTocEntryWait(): void {
    if (!tocEntryWait) return;
    window.cancelAnimationFrame(tocEntryWait.rafId);
    window.clearTimeout(tocEntryWait.timerId);
    tocEntryWait = null;
  }

  return {
    cloneIntoRow,
    clearClones,
    tocOffscreenDx,
    makeTocEntry,
    startTocEntryWait,
    cancelTocEntryWait,
  };
}
