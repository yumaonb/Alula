// social-links.ts — 按有效开关为联系方式添加订阅入口
// 用法：在 src/pages/index.astro 中从 ../lib/social-links 引入。
import type { FeatureConfig } from '../data/config';
import { socialLinks, type SocialLink } from '../data/social-links';

export function getSocialLinks(selectedFeatures: FeatureConfig): SocialLink[] {
  return [
    ...socialLinks,
    ...(selectedFeatures.pages.posts && selectedFeatures.endpoints.postsRss
      ? [{ icon: 'la:rss', label: 'rss', url: '/posts/rss.xml' }]
      : []),
  ];
}
