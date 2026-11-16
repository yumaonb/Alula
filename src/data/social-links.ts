// social-links.ts — 可编辑的联系方式列表
// 用法：在 src/lib/social-links.ts 中从 ../data/social-links 引入。

export interface SocialLink {
  icon: string;
  label: string;
  url: string;
}

// RSS 由文章与订阅开关自动控制，无需手动添加。
export const socialLinks: SocialLink[] = [
  { icon: 'la:github', label: 'GitHub', url: 'https://github.com/yumaonb' },
  { icon: 'simple-icons:tencentqq', label: 'QQ', url: 'https://qm.qq.com/q/UhGbjbysQW' },
  { icon: 'simple-icons:bilibili', label: 'Bilibili', url: 'https://b23.tv/XFTBHN3' },
  { icon: 'simple-icons:kuaishou', label: '快手', url: 'https://v.kuaishou.com/JwRUGjtp' },
  { icon: 'simple-icons:tiktok', label: '抖音', url: 'https://v.douyin.com/UrbqZZXQBzc/' },
];
