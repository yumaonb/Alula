// social-links.ts — 联系方式元数据与订阅入口的纯配置
// 用法：由 src/data/profile.ts 与 src/integrations/feature-assets.ts 引入。
import type { FeatureConfig } from './config';

export interface SocialLink {
  icon: string;
  label: string;
  url: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  { icon: 'la:github', label: 'GitHub', url: 'https://github.com/yumaonb' },
  { icon: 'simple-icons:tencentqq', label: 'QQ', url: 'https://qm.qq.com/q/UhGbjbysQW' },
  { icon: 'simple-icons:bilibili', label: 'Bilibili', url: 'https://b23.tv/XFTBHN3' },
  { icon: 'simple-icons:kuaishou', label: '快手', url: 'https://v.kuaishou.com/JwRUGjtp' },
  { icon: 'simple-icons:tiktok', label: '抖音', url: 'https://v.douyin.com/UrbqZZXQBzc/' },
];

export function getSocialLinks(selectedFeatures: FeatureConfig): SocialLink[] {
  return [
    ...SOCIAL_LINKS,
    ...(selectedFeatures.pages.posts && selectedFeatures.endpoints.postsRss
      ? [{ icon: 'la:rss', label: 'rss', url: '/posts/rss.xml' }]
      : []),
  ];
}
