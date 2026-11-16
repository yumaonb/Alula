// nav.ts — 导航名称、图标与显示顺序配置
// 用法：在 src/lib/navigation.ts 中从 ../data/nav 引入。
import type { FeatureConfig } from './config';

export type NavKey = 'home' | keyof FeatureConfig['pages'];

interface NavLabel {
  label: string;
  icon: string;
}

// 调整条目顺序即可调整导航顺序；键名对应功能开关，地址由路由声明派生。
export const navConfig: Record<NavKey, NavLabel> = {
  home: { label: '首页', icon: 'la:home' },
  about: { label: '关于', icon: 'la:user' },
  projects: { label: '项目', icon: 'la:cubes' },
  posts: { label: '文章', icon: 'la:book-open' },
  tools: { label: '工具', icon: 'la:wrench' },
  friends: { label: '友链', icon: 'la:link' },
  sponsor: { label: '赞助', icon: 'la:hand-holding-heart' },
};
