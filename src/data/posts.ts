/**
 * posts.ts — 文章/分类配置
 * 用法：import { posts } from "@/data/posts"
 */

export interface CategoryConfig {
  /** 分类页面的路径前缀，默认 ""（分类在 /posts/ 下） */
  categoryBase: string;
}

export interface PostsConfig {
  /** 内容根目录（相对于项目根），默认 "content/posts" */
  contentRoot: string;
  /** 分类相关配置 */
  category: CategoryConfig;
}

export const posts: PostsConfig = {
  contentRoot: "content/posts",
  category: {
    categoryBase: "",
  },
};