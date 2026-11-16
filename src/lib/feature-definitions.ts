// feature-definitions.ts — 前台可选功能的内部路由声明
// 用法：在 src/integrations/feature-routes.ts 中从 ../lib/feature-definitions 引入。
import type { FeatureConfig } from '../data/config';

export type FeatureKey = keyof FeatureConfig['pages'];

interface FeatureRoute {
  pattern: string;
  entrypoint: string;
}

interface FeatureDefinition {
  // 首条路由同时作为导航入口，导航地址不另存一份。
  routes: readonly [FeatureRoute, ...FeatureRoute[]];
}

export const featureDefinitions = {
  about: {
    routes: [{ pattern: '/about', entrypoint: 'about/AboutPage.astro' }],
  },
  projects: {
    routes: [{ pattern: '/projects', entrypoint: 'projects/ProjectsPage.astro' }],
  },
  posts: {
    routes: [
      { pattern: '/posts', entrypoint: 'posts/pages/index.astro' },
      { pattern: '/posts/[...slug]', entrypoint: 'posts/pages/[...slug].astro' },
      { pattern: '/posts/tag/[tag]', entrypoint: 'posts/pages/tag/[tag].astro' },
    ],
  },
  tools: {
    routes: [{ pattern: '/tools', entrypoint: 'tools/ToolsPage.astro' }],
  },
  friends: {
    routes: [{ pattern: '/friends', entrypoint: 'friends/FriendsPage.astro' }],
  },
  sponsor: {
    routes: [{ pattern: '/sponsor', entrypoint: 'sponsor/SponsorPage.astro' }],
  },
} as const satisfies Record<FeatureKey, FeatureDefinition>;
