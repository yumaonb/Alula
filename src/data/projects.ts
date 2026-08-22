// projects.ts — 项目数据配置
// 后续可替换为 GitHub API 调用

export interface Project {
  /** 项目名称 */
  name: string;
  /** 项目简介 */
  description: string;
  /** GitHub 仓库地址 */
  url: string;
  /** 主要语言 */
  language: string | null;
  /** Star 数 */
  stars: number;
  /** Fork 数 */
  forks: number;
  /** 标签/Topics */
  topics: string[];
  /** 最后更新时间（ISO 格式） */
  lastUpdated: string;
  /** 项目封面图（可选，留空则用语言颜色占位） */
  cover?: string;
  /** 是否置顶 */
  pinned?: boolean;
}

// ============================================
//  在这里配置你的项目列表
//  后续对接 GitHub API 时，只需替换此数据源
// ============================================

export const projects: Project[] = [
  {
    name: 'jieshaoye',
    description: '个人主页，基于 Astro + Vue 3 + TypeScript 构建，毛玻璃风格',
    url: 'https://github.com/yumaonb/jieshaoye',
    language: 'TypeScript',
    stars: 2,
    forks: 0,
    topics: ['astro', 'vue', 'portfolio', 'glassmorphism'],
    lastUpdated: '2026-08-20',
    pinned: true,
  },
  {
    name: 'Awesome-Bookmarks',
    description: '精心整理的前端开发资源合集，涵盖 Vue、React、Node.js 等方向',
    url: 'https://github.com/yumaonb/Awesome-Bookmarks',
    language: 'Markdown',
    stars: 15,
    forks: 3,
    topics: ['bookmarks', 'frontend', 'resources'],
    lastUpdated: '2026-07-10',
    pinned: true,
  },
  {
    name: 'vue3-admin-template',
    description: '基于 Vue 3 + Vite + Element Plus 的后台管理模板',
    url: 'https://github.com/yumaonb/vue3-admin-template',
    language: 'Vue',
    stars: 28,
    forks: 8,
    topics: ['vue3', 'vite', 'admin', 'element-plus'],
    lastUpdated: '2026-06-15',
  },
  {
    name: 'mini-tools',
    description: '实用小工具集合，包含时间戳转换、Base64 编解码、JSON 格式化等',
    url: 'https://github.com/yumaonb/mini-tools',
    language: 'JavaScript',
    stars: 8,
    forks: 2,
    topics: ['tools', 'utility', 'javascript'],
    lastUpdated: '2026-05-22',
  },
  {
    name: 'blog-middleware',
    description: '博客后端中间件，基于 Express + MongoDB，提供文章和评论接口',
    url: 'https://github.com/yumaonb/blog-middleware',
    language: 'JavaScript',
    stars: 5,
    forks: 1,
    topics: ['express', 'mongodb', 'backend', 'api'],
    lastUpdated: '2026-04-18',
  },
];