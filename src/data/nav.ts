// nav.ts — 站点导航与各界面入口图标（唯一来源）
// 用法：import { navItems, navItem } from "../../data/nav"
// 导航栏（桌面 / 手机）与各界面页头标题图标都从这取：
// 改这里一处，导航 + 对应页头同时生效。文章区（列表 / 分类 / 标签页）
// 的页头统一用「文章」条目（见 PostsShell.astro）。
export type NavKey = 'home' | 'about' | 'projects' | 'posts' | 'tools' | 'friends' | 'sponsor';

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  icon: string;
}

export const navItems: NavItem[] = [
  { key: 'home', href: '/', label: '首页', icon: 'la:home' },
  { key: 'about', href: '/about/', label: '关于', icon: 'la:user' },
  { key: 'projects', href: '/projects/', label: '项目', icon: 'la:cubes' },
  { key: 'posts', href: '/posts/', label: '文章', icon: 'la:book-open' },
  { key: 'tools', href: '/tools/', label: '工具', icon: 'la:wrench' },
  { key: 'friends', href: '/friends/', label: '友链', icon: 'la:link' },
  { key: 'sponsor', href: '/sponsor/', label: '赞助', icon: 'la:hand-holding-heart' },
];

// 按 key 取导航项（各界面页头用：图标与访问路径都与导航同源，页面不再写死自己的路径）
export const navItem = (key: NavKey): NavItem =>
  navItems.find((item) => item.key === key)!;
