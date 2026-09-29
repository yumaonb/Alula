// github.ts — GitHub 数据查询（带 localStorage 缓存）
// 用法：import { fetchRepos, fetchRepoCount } from "../../assets/js/github"

import { githubUsername, cacheTTL } from '../../data/github';

const CACHE_PREFIX = 'gh_';

/** 展示用的仓库字段（GitHub API 响应的子集） */
export interface RepoInfo {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  created_at: string;
}

function loadCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - ts > cacheTTL) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(key: string, data: unknown) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export async function fetchRepos(): Promise<RepoInfo[]> {
  const cached = loadCache<RepoInfo[]>('repos');
  if (cached) return cached;

  const res = await fetch(
    `https://api.github.com/users/${githubUsername}/repos?per_page=100&sort=updated`,
  );
  if (!res.ok) throw new Error(`GitHub API 请求失败 (${res.status})`);

  interface RawRepo {
    name: string;
    description: string | null;
    html_url: string;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    topics?: string[];
    created_at: string;
  }
  const data: RawRepo[] = await res.json();
  const repos = data
    .map((r) => ({
      name: r.name,
      description: r.description,
      html_url: r.html_url,
      language: r.language,
      stargazers_count: r.stargazers_count,
      forks_count: r.forks_count,
      topics: r.topics ?? [],
      created_at: r.created_at,
    }))
    .sort((a, b) => b.stargazers_count - a.stargazers_count);

  saveCache('repos', repos);
  return repos;
}

export async function fetchRepoCount(): Promise<number> {
  const cached = loadCache<number>('repo_count');
  if (cached !== null) return cached;

  const res = await fetch(`https://api.github.com/users/${githubUsername}`);
  if (!res.ok) throw new Error(`GitHub API 请求失败 (${res.status})`);

  const userData: { public_repos?: number } = await res.json();
  const count = userData.public_repos ?? 0;

  saveCache('repo_count', count);
  return count;
}
