// dom.ts — 浏览器端通用 DOM 工具
// 用法：import { cssNum, readTranslate } from '../../assets/js/util/dom'
/**
 * 读元素的平移量（transform 里的 translateX / translateY）。
 * 浏览器在 3D 变换或合成层场景下会把 transform 序列化成 matrix3d，
 * 只认 matrix( 会漏判成 0，导致动画从错误位置起播。
 */
export function readTranslate(el: Element): { x: number; y: number } {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return { x: 0, y: 0 };
  const m = /matrix(3d)?\(([^)]+)\)/.exec(t);
  if (!m) return { x: 0, y: 0 };
  const parts = m[2].split(',').map(Number);
  // matrix 的平移在第 5 / 6 位，matrix3d 在第 13 / 14 位
  return m[1] ? { x: parts[12] || 0, y: parts[13] || 0 } : { x: parts[4] || 0, y: parts[5] || 0 };
}

/**
 * 读元素的当前生效值（含动画进行中 / 已提交的值），作为下一段动画的起点。
 * 读不到（`auto` / 空串 / 未挂载）一律按 0 处理，调用方不必再兜底。
 */
export function cssNum(el: Element, prop: string): number {
  return parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
}
