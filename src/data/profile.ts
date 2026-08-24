/**
 * profile.ts — 个人信息配置
 * 用法：import { nickname, motto, intro, socialLinks } from "@/data/profile"
 */

export interface SocialLink {
  icon: string;
  label: string;
  url: string;
}

/** 昵称 */
export const nickname = '羽毛';

/** 签名 / 座右铭 */
export const motto = '阅己 越己 悦己';

/** 首页自我介绍（支持 HTML） */
export const intro = '这里是羽毛的小屋，一位热爱探索的学生<br>本项目技术栈：Astro · Svelte · TypeScript<br>源码已开源至github：<a href="https://github.com/yumaonb/YuSwift/" target="_blank" rel="noopener">点我前往项目地址</a><br>本站随时可能更换域名，建议收藏项目地址或收藏中转页：<a href="https://yumaonb.github.io/" target="_blank" rel="noopener">yumaonb.github.io</a>';

/** 联系方式 */
export const socialLinks: SocialLink[] = [
  { icon: 'la:github', label: 'GitHub', url: 'https://github.com/yumaonb' },
  { icon: 'simple-icons:bilibili', label: 'Bilibili', url: 'https://b23.tv/XFTBHN3' },
  { icon: 'simple-icons:kuaishou', label: '快手', url: 'https://v.kuaishou.com/JwRUGjtp' },
  { icon: 'simple-icons:tiktok', label: '抖音', url: 'https://v.douyin.com/UrbqZZXQBzc/' },
  { icon: 'la:qq', label: 'QQ', url: 'https://qm.qq.com/q/UhGbjbysQW' },
];