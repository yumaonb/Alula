// nav.ts — 当前构建的导航入口与页面标题元数据
// 用法：import { navItems, navItem } from '../../data/nav'
import { features } from 'virtual:site-features';

import { getNavItems, getNavItem, type NavKey, type NavItem } from './feature-definitions';

export type { NavKey, NavItem };

export const navItems: NavItem[] = getNavItems(features);

// 页头元数据独立于开关，关闭页面不会让描述查询失效。
export const navItem = (key: NavKey): NavItem => getNavItem(key);
