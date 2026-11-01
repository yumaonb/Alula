// github.ts — GitHub 地址配置（按用途分三块，各块互相独立）
// 用法：import { giscusRepo, projectOwner, adminRepo } from "../../data/github"

/* ---- 1. 评论：giscus 数据仓库 ---- */

/** giscus 评论数据仓库（owner/repo）。换仓库要连 repo-id / category-id 一起改 */
export const giscusRepo = 'yumaonb/Alula';

/* ---- 2. 项目与项目数量：拉取哪个账号的仓库 ---- */

/** 项目列表与项目数量都取这个账号的仓库 */
export const projectOwner = 'yumaonb';

/* ---- 3. 后台：默认连接的仓库 ---- */

/** 后台默认连接的仓库（owner/repo），绑定 token 后可改连别的仓库 */
export const adminRepo = 'yumaonb/Alula';

/* ---- 缓存 ---- */

/** localStorage 缓存时间（毫秒） */
export const cacheTTL = 60 * 60 * 1000;
