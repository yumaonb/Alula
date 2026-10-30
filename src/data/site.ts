// site.ts — 站点配置
// 用法：import { site } from "../../data/site"

export interface SiteConfig {
  name: string;
  domain: string;
  description: string;
  footerCopyright: string;
  footerNote: string;
  lang: string;
}

export const site: SiteConfig = {
  name: '羽毛的小屋',
  domain: 'ym.2v.nz',
  description: '羽毛的小屋',
  footerCopyright: 'Copyright © 2026 羽毛. All Rights Reserved',
  footerNote:
    '由 <a href="https://astro.build" target="_blank" rel="noopener noreferrer">Astro</a> 和 <a href="https://svelte.dev" target="_blank" rel="noopener noreferrer">Svelte</a> 驱动',
  lang: 'zh-CN',
};
