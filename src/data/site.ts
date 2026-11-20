// site.ts — 站点配置
// 用法：import { site } from "../../data/site"

export interface SiteConfig {
  name: string;
  domain: string;
  /** 站点绝对地址（含协议）：分享卡、RSS、评论区等需要绝对 URL 的地方统一用它 */
  url: string;
  description: string;
  /** 页脚版权行：RSS 的 <copyright> 也用它，两边必须同一句 */
  footerCopyright: string;
  /** 内容许可：文章页「许可协议」与页脚都指向它 */
  contentLicense: {
    /** 许可名称，如 "CC BY-NC-SA 4.0" */
    name: string;
    /** 许可全文链接 */
    url: string;
  };
  footerNote: string;
  lang: string;
}

export const site: SiteConfig = {
  name: '羽毛的小屋',
  domain: 'ym.2v.nz',
  url: 'https://ym.2v.nz',
  description: '记录学习所见，分享技术笔记与项目经验。',
  footerCopyright: 'Copyright © 2026 羽毛. 内容采用 CC BY-NC-SA 4.0 许可',
  contentLicense: {
    name: 'CC BY-NC-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  },
  footerNote: '由 <a href="https://astro.build" target="_blank" rel="noopener noreferrer">Astro</a> 和 <a href="https://svelte.dev" target="_blank" rel="noopener noreferrer">Svelte</a> 驱动',
  lang: 'zh-CN',
};
