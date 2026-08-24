/**
 * dayscounter.ts — 数据统计卡片配置
 * 用法：import { daysCounterConfig } from "@/data/dayscounter"
 */

export interface DaysCounterConfig {
  /** 统计卡片标签（如"入坑全栈"） */
  label: string;
  /** 起始日期 YYYY-MM-DD */
  startDate: string;
}

export const daysCounterConfig: DaysCounterConfig = {
  label: '入坑全栈',
  startDate: '2024-03-23',
};