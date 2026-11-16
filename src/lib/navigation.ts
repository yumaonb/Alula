// navigation.ts — 从导航设置、路由声明与有效开关派生导航
// 用法：在 src/components/layout/NavBar.astro 中从 ../../lib/navigation 引入。
import type { FeatureConfig } from '../data/config';
import { navConfig, type NavKey } from '../data/nav';
import { featureDefinitions } from './feature-definitions';

interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  icon: string;
}

// 页头元数据独立于开关，关闭页面不会让描述查询失效。
export function getNavItem(key: NavKey): NavItem {
  const href =
    key === 'home' ? '/' : `${featureDefinitions[key].routes[0].pattern.replace(/\/$/, '')}/`;
  return { key, href, ...navConfig[key] };
}

export function getNavItems(selectedFeatures: FeatureConfig): NavItem[] {
  return (Object.keys(navConfig) as NavKey[])
    .filter((key) => key === 'home' || selectedFeatures.pages[key])
    .map(getNavItem);
}
