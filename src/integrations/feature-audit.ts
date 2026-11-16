// feature-audit.ts — 阻止关闭功能的模块进入构建并记录客户端产物来源
// 用法：由 feature-routes.ts 引入 featureAudit
import type { AstroConfig } from 'astro';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FeatureConfig } from '../data/config';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function disabledModule(id: string, selectedFeatures: FeatureConfig): boolean {
  const normalized = id.replaceAll(String.fromCharCode(92), '/');
  for (const [key, isEnabled] of Object.entries(selectedFeatures.pages)) {
    if (!isEnabled && normalized.includes(`/src/features/${key}/`)) return true;
  }
  if (!selectedFeatures.endpoints.sitemap && normalized.includes('/src/features/sitemap/'))
    return true;
  if (
    !(selectedFeatures.pages.posts && selectedFeatures.endpoints.postsRss) &&
    normalized.includes('/src/features/posts/endpoints/rss.xml.ts')
  )
    return true;
  return !selectedFeatures.pages.posts && normalized.includes('/photoswipe/');
}

type BuildPlugin = Extract<NonNullable<AstroConfig['vite']['plugins']>[number], { name: string }>;

export function featureAudit(selectedFeatures: FeatureConfig, reportDir: URL): BuildPlugin {
  let isServerBuild = false;
  return {
    name: 'feature-audit',
    configResolved(config) {
      isServerBuild = Boolean(config.build.ssr);
    },
    generateBundle(_options, bundle) {
      const forbidden = [...this.getModuleIds()].filter((id) =>
        disabledModule(id, selectedFeatures),
      );
      if (forbidden.length > 0)
        this.error(`[features] 关闭功能仍进入模块图：\n${forbidden.join('\n')}`);
      if (isServerBuild) return;
      const chunks = Object.values(bundle).flatMap((output) =>
        output.type === 'chunk'
          ? [
              {
                file: output.fileName,
                modules: Object.keys(output.modules).map((id) =>
                  relative(ROOT, id).replaceAll(String.fromCharCode(92), '/'),
                ),
              },
            ]
          : [],
      );
      const report = join(fileURLToPath(reportDir), 'feature-client.json');
      mkdirSync(dirname(report), { recursive: true });
      writeFileSync(report, JSON.stringify({ features: selectedFeatures, chunks }, null, 2));
    },
  };
}
