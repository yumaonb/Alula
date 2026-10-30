// tools.ts — 实用工具数据（按分类组织，每个分类含标题与工具列表）
// 用法：import { toolCategories } from "../../data/tools"

export interface ToolItem {
  title: string;
  desc: string;
  url: string;
}

export interface ToolCategory {
  title: string;
  tools: ToolItem[];
}

export const toolCategories: ToolCategory[] = [
  {
    title: 'ai工具',
    tools: [
      {
        title: 'deepseek',
        desc: '反正很好用，需登录',
        url: 'https://chat.deepseek.com',
      },
      {
        title: '豆包',
        desc: 'emm...至少不需要登录，还算能用',
        url: 'https://www.doubao.com',
      },
      {
        title: 'glm（智谱清言）',
        desc: '不需要登录可以直接用的ai，能力不错',
        url: 'https://chatglm.cn',
      },
    ],
  },
    {
    title: '速查文档',
    tools: [
      {
        title: '菜鸟教程',
        desc: '覆盖的编程语言很多，就是查起来有些费劲，但至少全啊',
        url: 'https://www.runoob.com',
      },
            {
        title: 'MDN',
        desc: '不必多言，前端相关的很全',
        url: 'https://developer.mozilla.org/zh-CN/',
      },
    ],
  },
  {
    title: '运维工具',
    tools: [
      {
        title: 'ITDOG',
        desc: '不必多言，老牌的测速站',
        url: 'https://www.itdog.cn/',
      },
      {
        title: '宝塔拨测',
        desc: '也是个测速站，宝塔出的应该不会差',
        url: 'https://t.bt.cn/',
      },
      {
        title: 'ip查询',
        desc: '信息很全，甚至还能测个速（测本机网络速度）',
        url: 'https://ip.skk.moe/',
      },
      {
        title: 'WHOIS查询',
        desc: '腾讯云的，查域名信息的，个人感觉这个算是用起来最舒服的一个了',
        url: 'https://whois.cloud.tencent.com/',
      },
      {
        title: 'crt.sh',
        desc: '可以查某个域名（包括其子域名）申请过的ssl证书，可以起到一个查某个域名的子域名的作用',
        url: 'https://crt.sh/',
      },
      {
        title: 'DNS Checker',
        desc: '全球多节点DNS解析查询工具，查域名解析到了哪挺好用的',
        url: 'https://dnschecker.org/',
      },
    ],
  },
  {
    title: '开发工具',
    tools: [
      {
        title: 'json格式化工具',
        desc: '格式化json的，方便开发',
        url: 'https://pagespeed.web.dev/?hl=zh-cn',
      },
      {
        title: 'lightthouse测试',
        desc: '测网站性能的，需要科学上网',
        url: 'https://pagespeed.web.dev/?hl=zh-cn',
      },
    ],
  },
];
