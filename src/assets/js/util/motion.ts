// motion.ts — motion 的懒加载入口（首屏不拉这个 54 KB 的共享块）
// 用法：import { motionSync, preloadMotion } from "../util/motion"
//
// 为什么懒加载：motion 整包 54 KB（gzip 19 KB），而首屏没有任何动画——
// 搜索框钉位、侧栏高亮、页面变体类全是直接写样式。真正要用动画的是
// 切页转场（transition / strip / search-float）与交互（导航下划线、
// 汉堡菜单、分类树开合），全都在用户动作之后。
//
// 取用方式分两种：
//   motionSync()  —— 同步取。未就绪返回 null，调用方回落到「直接到终态」。
//                    动画是增强不是功能：没就绪时元素落到最终位置，不卡住。
//   preloadMotion() —— 空闲时预取。用户真正操作前通常已经就绪
//                    （首次点击一般距首屏几百毫秒）。

import type { animate as animateType, AnimationPlaybackControls } from 'motion';

/** 只包含实际用到的函数，让 Rollup 能把 motion 其余部分 tree-shake 掉 */
export interface Motion {
  animate: typeof animateType;
}
export type Animate = typeof animateType;

let loaded: Motion | null = null;
let pending: Promise<Motion | null> | null = null;

/** 开始拉取 motion；重复调用复用同一个请求。失败时返回 null 并记一条日志。 */
export function preloadMotion(): Promise<Motion | null> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= import('./motion-runtime')
    .then((module) => {
      loaded = module;
      return module;
    })
    .catch((err: unknown) => {
      // 只有动画失效，页面本身仍然可用，不值得抛给用户
      console.error('[motion] 懒加载失败，动画将退化为直接落位', err);
      return null;
    });
  return pending;
}

/** 同步取已加载的 motion；还没就绪返回 null，由调用方决定怎么退化。 */
export function motionSync(): Motion | null {
  return loaded;
}

/* ---- 未就绪时的替身：直接落到终态，返回一个「已经播完」的 controls ---- */

const INSTANT: AnimationPlaybackControls = {
  finished: Promise.resolve(),
  play: () => {},
  pause: () => {},
  cancel: () => {},
  complete: () => {},
  stop: () => {},
  time: 0,
  speed: 1,
  state: 'finished',
  startTime: 0,
  duration: 0,
  iterationDuration: 0,
  attachTimeline: () => () => {},
};

/** 关键帧的最后一帧落到元素上：动画没就绪时，元素要停在「本来该停的地方」 */
function applyFinalKeyframes(element: Element, keyframes: Record<string, unknown>): void {
  if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) return;
  const style = (element as HTMLElement).style;
  const translate: string[] = [];
  for (const [name, value] of Object.entries(keyframes)) {
    if (name === 'transition' || name === 'transitionEnd') continue;
    const frames = Array.isArray(value) ? value : [value];
    const last = frames[frames.length - 1];
    if (last === undefined || last === null) continue;
    const text = String(last);
    if (name === 'x' || name === 'y') {
      const axis = name === 'x' ? 'X' : 'Y';
      translate.push(`translate${axis}(${/^-?\d+(\.\d+)?$/.test(text) ? `${text}px` : text})`);
    } else if (name === 'width' || name === 'height' || name === 'maxHeight') {
      style[name === 'maxHeight' ? 'maxHeight' : name] = /^-?\d+(\.\d+)?$/.test(text)
        ? `${text}px`
        : text;
    } else {
      style.setProperty(
        name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
        text,
      );
    }
  }
  if (translate.length > 0) style.transform = translate.join(' ');
}

/**
 * 用户是否开启了「减少动态效果」：motion 的 translate 类动画在这种偏好下必须关掉。
 * 每次调用现读（matchMedia 同步且廉价），不用模块加载时捕获的旧值
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * motion 版 `animate()` 的替身：motion 已就绪就用真的，没就绪就把最后一帧
 * 直接写到元素上、返回「已经播完」的 controls。
 *
 * reduceMotion 由这里从 matchMedia 统一读入并入 options——各调用点不再各自传，
 * 漏传就会让开了「减少动态效果」的用户看到平移动画。
 * 这样 20 多个调用点一行都不用改——动画是增强不是功能，
 * 未就绪时元素直接落到最终位置，不会卡在半途。
 */
export function animateLazy(
  element: Element | Element[] | NodeListOf<Element>,
  keyframes: Record<string, unknown>,
  options?: Record<string, unknown>,
): AnimationPlaybackControls {
  const motion = motionSync();
  if (motion) {
    const opts: Record<string, unknown> = {
      ...(options ?? {}),
      reduceMotion: prefersReducedMotion(),
    };
    return motion.animate(element, keyframes as never, opts as never);
  }

  const targets =
    element instanceof Element ? [element] : Array.from(element as ArrayLike<Element>);
  for (const target of targets) applyFinalKeyframes(target, keyframes);
  return INSTANT;
}
