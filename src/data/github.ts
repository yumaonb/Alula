// github.ts — GitHub 配置
// 用法：import { githubUsername, cacheTTL } from "@/data/github"

export const githubUsername = 'yumaonb';

/** 存放 giscus 评论的仓库名，需与 Comments.astro 中的 giscus 配置一致 */
export const githubRepo = 'Alula';

/** localStorage 缓存时间（毫秒） */
export const cacheTTL = 60 * 60 * 1000;