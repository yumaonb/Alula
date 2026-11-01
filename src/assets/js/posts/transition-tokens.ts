// transition-tokens.ts — 文章区转场的相位与缓动（搜索浮层、目录条带共用）
// 用法：import { PHASE_MS, EASE_ENTRY } from './transition-tokens'
//
// 配对相位：搜索与目录的出场 / 退场是四个同时长同缓动的动效（观感完全一致），
// 令牌只能有一份，不要在各处重写——改一个值四个动效同时变，正是想要的。

// 平滑进出
export const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
// 左缘滑动 / 内容滑动 / 普通渐隐时长
export const EDGE_MS = 400;
// 桌面端搜索 / 目录配对相位（同时长、渐显渐隐与位移同步）：入场减速落位、退场加速离场
export const PHASE_MS = 320;
export const EASE_EXIT: [number, number, number, number] = [0.4, 0, 1, 1];
export const EASE_ENTRY: [number, number, number, number] = [0, 0, 0.2, 1];
