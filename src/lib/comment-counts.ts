// comment-counts.ts — giscus 评论数（构建期从 GitHub API 拉取）
//
// 站点评论由 giscus 提供，按「pathname」映射到 GitHub Discussion：
// giscus 创建讨论时会把讨论标题写成「去掉前导斜杠的页面路径」
// （例如 /posts/devnotes/css/at-rule/ → 标题 "posts/devnotes/css/at-rule/"）。
// 因此构建期拉取仓库全部 Discussions，按标题即可精确匹配每篇文章并取到评论数。
//
// 只允许在服务端（页面 / Astro 组件 frontmatter）使用，禁止客户端引用。
// 任何网络异常都返回 null（调用方隐藏评论数），保证构建不因网络问题失败。
import { githubUsername, githubRepo } from '../data/github';

/**
 * 归一化路径（去掉首尾斜杠），如 "posts/devnotes/css/at-rule/" → "posts/devnotes/css/at-rule"
 */
function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

/** 单页拉取结果：null 表示请求失败 */
interface DiscussionPage {
  title: string;
  comments: number;
}

const PER_PAGE = 100;
const MAX_PAGES = 20;
const TIMEOUT_MS = 10_000;

/** 拉取一页讨论；失败返回 null */
async function fetchDiscussionsPage(page: number): Promise<DiscussionPage[] | null> {
  const url = `https://api.github.com/repos/${githubUsername}/${githubRepo}/discussions?per_page=${PER_PAGE}&page=${page}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DiscussionPage[];
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 拉取全仓库 giscus 讨论，建立「归一化路径 → 评论数」映射。
 *
 * @returns 成功返回映射（未匹配到讨论的路径不在其中）；
 *          整体失败（网络 / 限流 / 解析异常）返回 null，调用方据此隐藏评论数。
 */
export async function loadCommentCounts(): Promise<Record<string, number> | null> {
  const counts: Record<string, number> = {};
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const items = await fetchDiscussionsPage(page);
      if (!items) return null; // 中途失败：整体视为不可用，避免只显示部分计数
      if (items.length === 0) break;
      for (const item of items) {
        const key = normalizePath(item.title);
        if (key) counts[key] = item.comments;
      }
      if (items.length < PER_PAGE) break;
    }
    return counts;
  } catch {
    return null;
  }
}

/**
 * 取某篇文章的评论数。
 * @param counts loadCommentCounts 的返回值（null 表示不可用）
 * @param url    文章完整 URL，如 /posts/devnotes/css/at-rule/
 */
export function commentCountFor(counts: Record<string, number> | null, url: string): number | undefined {
  if (!counts) return undefined;
  const key = normalizePath(url);
  return counts[key] ?? 0;
}
