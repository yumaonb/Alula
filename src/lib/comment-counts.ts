// comment-counts.ts — giscus 评论数（构建期从 GitHub API 拉取）
// 用法：import { loadCommentCounts, commentCountFor } from "../../lib/comment-counts"
// 匹配方式：giscus 按 pathname 映射讨论，讨论标题为「去掉前导斜杠的页面路径」，
// 构建期拉取仓库全部 Discussions 按标题匹配每篇文章的评论数。
// 仅限服务端使用；任何网络异常返回 null，调用方隐藏评论数，构建不因网络失败。

import { githubUsername, githubRepo } from '../data/github';

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

export function commentCountFor(
  counts: Record<string, number> | null,
  url: string,
): number | undefined {
  if (!counts) return undefined;
  const key = normalizePath(url);
  return counts[key] ?? 0;
}
