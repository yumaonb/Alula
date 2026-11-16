// feature-assets.ts — 按功能生成公开说明与评论主题资源
// 用法：由 feature-routes.ts 引入 featureAssets
import type { AstroConfig } from 'astro';
import { readFileSync } from 'node:fs';

import type { FeatureConfig } from '../data/config';
import { getNavItems } from '../lib/navigation';
import { getSocialLinks } from '../lib/social-links';
import { site } from '../data/site';

type BuildPlugin = Extract<NonNullable<AstroConfig['vite']['plugins']>[number], { name: string }>;

export function featureAssets(selectedFeatures: FeatureConfig): BuildPlugin {
  const navItems = getNavItems(selectedFeatures);
  const socialLinks = getSocialLinks(selectedFeatures);
  const assets = new Map<string, string>([
    ['robots.txt', 'User-agent: *\nAllow: /\nDisallow: /admin/\n'],
    [
      'llms.txt',
      [
        `# ${site.name}`,
        '',
        '> 使用 Astro、Svelte 与 TypeScript 构建的个人站点。',
        '',
        '## 页面',
        '',
        ...navItems.map((item) => `- [${item.label}](${new URL(item.href, site.url).href})`),
        '',
        '## 联系方式',
        '',
        ...socialLinks.map((item) => `- [${item.label}](${new URL(item.url, site.url).href})`),
        '',
        '## 源码',
        '',
        '- [GitHub 仓库](https://github.com/yumaonb/Alula/)',
        '',
      ].join('\n'),
    ],
  ]);
  if (selectedFeatures.pages.posts) {
    assets.set(
      'css/giscus.css',
      readFileSync(new URL('../features/posts/assets/giscus.css', import.meta.url), 'utf8'),
    );
  }
  return {
    name: 'feature-assets',
    generateBundle() {
      for (const [fileName, source] of assets) this.emitFile({ type: 'asset', fileName, source });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url ?? '').split('?')[0].replace(/^\//, '');
        const source = assets.get(pathname);
        if (source === undefined) return next();
        response.setHeader(
          'Content-Type',
          pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/plain; charset=utf-8',
        );
        response.end(source);
      });
    },
  };
}
