/**
 * friends.ts — 友情链接数据
 * 用法：import { friends } from "@/data/friends"
 */

export interface Friend {
  name: string;
  avatar: string;
  desc: string;
  url: string;
}

export const friends: Friend[] = [
  {
    name: '示例友链',
    avatar: '头像链接',
    desc: '介绍',
    url: '网址',
  },
  {
    name: '示例友链',
    avatar: '头像链接',
    desc: '介绍',
    url: '网址',
  },
];