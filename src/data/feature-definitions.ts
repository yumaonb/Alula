// feature-definitions.ts — 前台功能的路由与导航元数据
// 用法：由 src/data/nav.ts 与 src/integrations/feature-routes.ts 引入。
import type { FeatureConfig } from './config';

export type FeatureKey = keyof FeatureConfig['pages'];
export type NavKey = 'home' | FeatureKey;

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  icon: string;
}

interface FeatureRoute {
  pattern: string;
  entrypoint: string;
}

interface FeatureDefinition {
  // 首条路由同时作为导航入口，导航地址不另存一份。
  routes: readonly [FeatureRoute, ...FeatureRoute[]];
  nav: { label: string; icon: string };
}

export const featureDefinitions = {
  about: {
    routes: [{ pattern: '/about', entrypoint: 'about/AboutPage.astro' }],
    nav: { label: '关于', icon: 'la:user' },
  },
  projects: {
    routes: [{ pattern: '/projects', entrypoint: 'projects/ProjectsPage.astro' }],
    nav: { label: '项目', icon: 'la:cubes' },
  },
  posts: {
    routes: [
      { pattern: '/posts', entrypoint: 'posts/pages/index.astro' },
      { pattern: '/posts/[...slug]', entrypoint: 'posts/pages/[...slug].astro' },
      { pattern: '/posts/tag/[tag]', entrypoint: 'posts/pages/tag/[tag].astro' },
    ],
    nav: { label: '文章', icon: 'la:book-open' },
  },
  tools: {
    routes: [{ pattern: '/tools', entrypoint: 'tools/ToolsPage.astro' }],
    nav: { label: '工具', icon: 'la:wrench' },
  },
  friends: {
    routes: [{ pattern: '/friends', entrypoint: 'friends/FriendsPage.astro' }],
    nav: { label: '友链', icon: 'la:link' },
  },
  sponsor: {
    routes: [{ pattern: '/sponsor', entrypoint: 'sponsor/SponsorPage.astro' }],
    nav: { label: '赞助', icon: 'la:hand-holding-heart' },
  },
} as const satisfies Record<keyof FeatureConfig['pages'], FeatureDefinition>;

const ALL_NAV_ITEMS: NavItem[] = [
  { key: 'home', href: '/', label: '首页', icon: 'la:home' },
  ...Object.entries(featureDefinitions).map(([key, definition]) => ({
    key: key as FeatureKey,
    href: `${definition.routes[0].pattern.replace(/\/$/, '')}/`,
    ...definition.nav,
  })),
];

export function getNavItems(selectedFeatures: FeatureConfig): NavItem[] {
  return ALL_NAV_ITEMS.filter((item) => item.key === 'home' || selectedFeatures.pages[item.key]);
}

export function getNavItem(key: NavKey): NavItem {
  return ALL_NAV_ITEMS.find((item) => item.key === key)!;
}
