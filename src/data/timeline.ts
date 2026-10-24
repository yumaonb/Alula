// timeline.ts — 关于页「历程」时间轴配置
// 用法：import { timeline } from "../../data/timeline"
// 条目顺序随意，组件按 date 升序排列；date 用 YYYY-MM-DD。

export interface TimelineEntry {
  /** 事件开始日期 YYYY-MM-DD */
  date: string;
  /** 事件标题 */
  title: string;
  /** 一句话说明 */
  description: string;
}

/** 时间轴条目：顺序随意，按日期升序渲染 */
export const timeline: TimelineEntry[] = [
  {
    date: '2024-03-23',
    title: '入坑前端',
    description: '第一次写下 HTML 与 CSS，把「做一个自己的网站」这件事提上日程。',
  },
  {
    date: '2024-06-16',
    title: '第一个静态页',
    description: '用 HTML + CSS 拼出第一个能跑起来的页面，开始看懂盒子是怎么摆的。',
  },
  {
    date: '2024-10-08',
    title: '让页面动起来',
    description: '从 JavaScript 入手，第一次用代码回应点击、滚动和时间。',
  },
  {
    date: '2025-01-12',
    title: '认识 Astro',
    description: '被「默认不加载 JS」的岛屿架构吸引，决定用它重做自己的站点。',
  },
  {
    date: '2025-04-18',
    title: '小屋上线',
    description: '「羽毛的小屋」第一次出现在公网，域名换过几次，房子一直在。',
  },
  {
    date: '2025-08-02',
    title: '拥抱 TypeScript',
    description: '给站点补上类型，从「能跑就行」转向「改得动、留得住」。',
  },
  {
    date: '2025-11-24',
    title: '重做视觉',
    description: '磨砂、令牌、动效逐个调，把深色毛玻璃这套语言磨到顺手。',
  },
  {
    date: '2026-02-14',
    title: '搬上 GitHub',
    description: '第一次认真写 README、整理提交，让作品可以被别人看见。',
  },
  {
    date: '2026-06-20',
    title: '开始写笔记',
    description: '把踩过的坑整理成文章，才发现讲清楚比做出来更难。',
  },
  {
    date: '2026-10-01',
    title: '仍在路上',
    description: '入坑两年半，好奇心还在，继续把想法做成看得见的东西。',
  },
];
