// config.ts — 页面与端点的构建开关
// 用法：import { features } from './config'
export interface FeatureConfig {
  pages: {
    about: boolean;
    projects: boolean;
    posts: boolean;
    tools: boolean;
    friends: boolean;
    sponsor: boolean;
  };
  endpoints: {
    sitemap: boolean;
    postsRss: boolean;
  };
}

export const features: FeatureConfig = {
  pages: {
    about: true,
    projects: true,
    posts: true,
    tools: true,
    friends: true,
    sponsor: true,
  },
  endpoints: {
    sitemap: true,
    postsRss: true,
  },
};
