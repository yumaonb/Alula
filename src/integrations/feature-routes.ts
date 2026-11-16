// feature-routes.ts — 在编译前选择功能路由与布局入口
// 用法：由 astro.config.ts 引入 featureRoutesIntegration
import type { AstroIntegration } from 'astro';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FeatureConfig } from '../data/config';
import { featureDefinitions, type FeatureKey } from '../lib/feature-definitions';
import { featureAudit } from './feature-audit';
import { featureAssets } from './feature-assets';
import { featureEntries } from './feature-entries';

interface FeatureRoutesOptions {
  reportDir?: URL;
}

export function featureRoutesIntegration(
  selectedFeatures: FeatureConfig,
  { reportDir = new URL('../../.astro/', import.meta.url) }: FeatureRoutesOptions = {},
): AstroIntegration {
  const routes = [
    ...Object.entries(featureDefinitions).flatMap(([key, definition]) =>
      definition.routes.map((route) => ({
        ...route,
        isEnabled: selectedFeatures.pages[key as FeatureKey],
      })),
    ),
    {
      isEnabled: selectedFeatures.endpoints.sitemap,
      pattern: '/sitemap.xml',
      entrypoint: 'sitemap/sitemap.xml.ts',
    },
    {
      isEnabled: selectedFeatures.pages.posts && selectedFeatures.endpoints.postsRss,
      pattern: '/posts/rss.xml',
      entrypoint: 'posts/endpoints/rss.xml.ts',
    },
  ].filter((route) => route.isEnabled);

  return {
    name: 'feature-routes',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig, addWatchFile }) => {
        addWatchFile(new URL('../data/config.ts', import.meta.url));
        addWatchFile(new URL('../lib/feature-definitions.ts', import.meta.url));
        addWatchFile(new URL('../data/nav.ts', import.meta.url));
        addWatchFile(new URL('../data/social-links.ts', import.meta.url));
        for (const route of routes) {
          const entrypoint = new URL(`../features/${route.entrypoint}`, import.meta.url);
          if (!existsSync(entrypoint))
            throw new Error(`[features] 路由入口不存在：${entrypoint.pathname}`);
          injectRoute({ pattern: route.pattern, entrypoint, prerender: true });
        }
        updateConfig({
          vite: {
            plugins: [
              featureEntries(selectedFeatures),
              featureAssets(selectedFeatures),
              featureAudit(selectedFeatures, reportDir),
            ],
          },
        });
      },
      'astro:build:done': () => {
        const report = join(fileURLToPath(reportDir), 'feature-routes.json');
        mkdirSync(dirname(report), { recursive: true });
        writeFileSync(report, JSON.stringify({ features: selectedFeatures, routes }, null, 2));
      },
    },
  };
}
