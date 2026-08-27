/**
 * site.ts — 站点配置
 * 用法：import { site } from "@/data/site"
 */

export interface SiteConfig {
  /** 站点名称 */
  name: string;
  /** 站点域名 */
  domain: string;
  /** 站点描述（SEO） */
  description: string;
  /** 页脚版权文字 */
  footerCopyright: string;
  /** 页脚备注 */
  footerNote: string;
  /** 语言 */
  lang: string;
  /** 主题色 */
  colorScheme: 'dark' | 'light';
}

export const site: SiteConfig = {
  name: '羽毛的小屋',
  domain: 'ym.2v.nz',
  description: '羽毛的小屋',
  footerCopyright: 'Copyright © 2026 羽毛. All Rights Reserved',
  footerNote: '由 <a href="https://astro.build" target="_blank" rel="noopener noreferrer">Astro</a> 和 <a href="https://svelte.dev" target="_blank" rel="noopener noreferrer">Svelte</a> 驱动',
  lang: 'zh-CN',
  colorScheme: 'dark',
};