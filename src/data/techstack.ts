// techstack.ts — 技术栈数据（按类别分组）
// 用法：import { techStack } from "../../data/techstack"

export interface TechCategory {
  category: string;
  items: string[];
}

export const techStack: TechCategory[] = [
  {
    category: '前端',
    items: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'Vite', 'Svelte', 'Astro'],
  },
  {
    category: '后端',
    items: ['Node.js', 'PHP', 'ThinkPHP'],
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
    category: '脚本',
    items: ['Shell'],
  },
  {
    category: '工具',
    items: ['Git', 'GitHub', 'node:test', 'pnpm', 'npm', 'Markdown'],
  },
    {
    category: 'AI工具',
    items: ['Chat GPT（Codex）', 'Cursor', 'Claude Code', 'DeepSeek', 'Kimi'],
  },
];
