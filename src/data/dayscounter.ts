// dayscounter.ts — 数据统计卡片配置
// 用法：import { daysCounterConfig } from "../../data/dayscounter"

export interface DaysCounterConfig {
  label: string;
  /** 起始日期 YYYY-MM-DD */
  startDate: string;
}

export const daysCounterConfig: DaysCounterConfig = {
  label: '入坑全栈',
  startDate: '2024-03-23',
};
