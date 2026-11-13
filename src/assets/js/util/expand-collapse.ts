// expand-collapse.ts — 展开/收起共享编排：窗口（max-height）与刚体（translateY）同曲线同长走 motion
// 用法：import { toggleGroup } from "../util/expand-collapse"（现由 admin/shell.ts、posts/category-tree.ts、nav/hamburger.ts 使用）
//
// 全站「开窗露内容」的展开/收起动效（后台侧栏、分类树、汉堡菜单等）共用这里：
// CSS 只定义开/关端点态，飞行由本模块统一驱动。
// 展开与收起都是窗口收放 + 刚体同步平移，子项任何一帧都不被压缩。
// 重触发时先读飞行中值、再 cancel 旧动画、从屏幕实际位置续播，快速开合不跳变
// （motion 的 cancel 会把元素回退到首关键帧，所以读数必须最先做）。
import type { AnimationPlaybackControls } from 'motion';
import { cssNum, readTranslate } from './dom';
import { animateLazy as animate } from './motion';

export const GROUP_DURATION = 0.34;
export const GROUP_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export interface ToggleGroupOptions {
  /** 窗口：承载 CSS max-height 端点的元素 */
  wrap: Element;
  /** 刚体：包含全部子项的元素 */
  clip: Element;
  /** 刚体实高（px） */
  height: number;
  open: boolean;
  /** 翻状态类 / aria，在读取飞行中值、取消旧动画之后调用 */
  onState: () => void;
  /** 秒，缺省 GROUP_DURATION */
  duration?: number;
}

/** 每个窗口当前在飞的控制组；重触发时先 cancel 再重记 */
const inFlight = new WeakMap<Element, AnimationPlaybackControls[]>();

/**
 * 播一次完整的展开/收起：窗口与刚体同曲线同长，子项不被压缩。
 * 可重复调用：先读飞行中值、cancel 旧动画，新动画从屏幕实际位置接续。
 */
export function toggleGroup({
  wrap,
  clip,
  height,
  open,
  onState,
  duration = GROUP_DURATION,
}: ToggleGroupOptions): void {
  const h = Math.max(0, Math.round(height));
  // 先读飞行中值：motion 的 cancel 会把内联改写回首关键帧，cancel 之后再读就不是屏幕上的位置了
  const fromMax = cssNum(wrap, 'max-height');
  const fromY = readTranslate(clip).y;
  for (const control of inFlight.get(wrap) ?? []) control.cancel();
  inFlight.delete(wrap);

  onState();

  if (h <= 0) return;

  // 减动效下开合是布局动效，必须停：时长归零直接落位
  const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = instant ? 0 : duration;
  inFlight.set(wrap, [
    animate(wrap, { maxHeight: [fromMax, open ? h : 0] }, { duration: dur, ease: GROUP_EASE }),
    animate(clip, { y: [fromY, open ? 0 : -h] }, { duration: dur, ease: GROUP_EASE }),
  ]);
}
