/**
 * sponsor.ts — 赞助页面配置
 * 用法：import { sponsorLink, sponsorList, supportActions } from "@/data/sponsor"
 */

export interface SponsorLink {
  name: string;
  href: string;
  desc: string;
  icon: string;
}

export interface SponsorList {
  icon: string;
  title: string;
  desc: string;
  href: string;
  target: string;
}

export interface SupportAction {
  icon: string;
  title: string;
  desc: string;
  href?: string;
  target?: string;
}

/** 主赞助卡片（爱发电） */
export const sponsorLink: SponsorLink = {
  name: '爱发电',
  href: 'https://www.ifdian.net/a/yumaonb',
  desc: '前往爱发电支持我们的创作',
  icon: 'la:heart',
};

/** 赞助名单入口 */
export const sponsorList: SponsorList = {
  icon: 'la:users',
  title: '爱发电赞助名单',
  desc: '感谢每一位赞助者',
  href: 'https://www.ifdian.net/a/yumaonb?tab=sponsor',
  target: '_blank',
};

/** 其他支持方式 */
export const supportActions: SupportAction[] = [
  { icon: 'la:star', title: 'Star 仓库', desc: '给项目点个 Star 鼓励一下', href: 'https://github.com/yumaonb/YuSwift/', target: '_blank' },
  { icon: 'la:share-square', title: '分享本站', desc: '把本站分享给更多朋友' },
  { icon: 'la:bookmark', title: '收藏本站', desc: '按 Ctrl+D 收藏到书签' },
];