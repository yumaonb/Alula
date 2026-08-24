/**
 * TechStack.ts — 技术栈数据
 * 用法：import { techStack } from "@/data/techstack"
 */

export interface TechCategory {
  category: string;
  items: string[];
}

export const techStack: TechCategory[] = [
  {
    category: '前端',
    items: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'Svelte', 'Astro'],
  },
  {
    category: '后端',
    items: ['PHP'],
  },
  {
    category: '数据库',
    items: ['MySQL'],
  },
  {
    category: '运维',
    items: ['Linux', 'Nginx', '宝塔', '1Panel', 'Docker'],
  },
  {
    category: '工具',
    items: ['Git', 'GitHub', 'pnpm', 'npm'],
  },
];