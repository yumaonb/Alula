// friends.ts — 友情链接数据
// 用法：import { friends } from "../../data/friends"

export interface Friend {
  name: string;
  avatar: string;
  desc: string;
  url: string;
}

export const friends: Friend[] = [
  {
    name: '星辰の主页',
    avatar: 'https://q.qlogo.cn/headimg_dl?dst_uin=179097240&spec=640&img_type=jpg',
    desc: '在代码与星光之间，构筑无限可能。',
    url: 'https://xcov.cn',
  },
];
