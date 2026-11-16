// feature-entries.ts — 提供有效功能配置并解析显式功能入口
// 用法：由 src/integrations/feature-routes.ts 引入。
import type { AstroConfig } from 'astro';
import { fileURLToPath } from 'node:url';

import type { FeatureConfig } from '../data/config';

type BuildPlugin = Extract<NonNullable<AstroConfig['vite']['plugins']>[number], { name: string }>;

const FEATURES_ID = 'virtual:site-features';
const RESOLVED_FEATURES_ID = `\0${FEATURES_ID}`;

export function featureEntries(selectedFeatures: FeatureConfig): BuildPlugin {
  const hasPosts = selectedFeatures.pages.posts;
  const entries = new Map([
    [
      'virtual:features/page-row.astro',
      hasPosts ? '../features/posts/layouts/PostsRow.astro' : '../components/layout/PageRow.astro',
    ],
    [
      'virtual:features/page-extras.astro',
      hasPosts
        ? '../features/posts/components/PostsExtras.astro'
        : '../components/layout/PageExtras.astro',
    ],
    [
      'virtual:features/image-fallback',
      hasPosts
        ? '../features/posts/scripts/image-fallback.ts'
        : '../assets/js/ui/image-fallback.ts',
    ],
    [
      'virtual:features/sitemap-posts',
      hasPosts ? '../features/posts/sitemap-entries.ts' : '../features/sitemap/post-entries.ts',
    ],
  ]);
  const featureSource = `export const features = ${JSON.stringify(selectedFeatures)};`;

  return {
    name: 'feature-entries',
    enforce: 'pre',
    resolveId(source) {
      if (source === FEATURES_ID) return RESOLVED_FEATURES_ID;
      const entry = entries.get(source);
      if (!entry) return;
      // 组件交回真实文件路径，保留 Astro 的脚本提取与岛水合编译。
      return fileURLToPath(new URL(entry, import.meta.url)).replaceAll('\\', '/');
    },
    load(id) {
      if (id === RESOLVED_FEATURES_ID) return featureSource;
    },
  };
}
