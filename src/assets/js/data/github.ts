// github.ts — GitHub 数据查询（带 localStorage 缓存）
// 用法：import { fetchRepos, fetchRepoCount } from "../../assets/js/data/github"

import { projectOwner, cacheTTL } from '../../../data/github';

const CACHE_PREFIX = 'gh_';

/** 记录当前缓存属于哪个用户名：换用户名时据此定位要清理的旧键 */
const CACHE_OWNER_KEY = 'gh_cache_owner';

/** 会写进 localStorage 的缓存键。新增缓存要在这里登记，否则清理旧用户名时认不出来 */
const CACHE_KEYS = ['repos', 'repo_count'] as const;
type CacheKey = (typeof CACHE_KEYS)[number];

/** 缓存键带用户名：换账号后不会拿旧账号的缓存顶上 */
function cacheKey(key: CacheKey): string {
  return `${CACHE_PREFIX}${projectOwner}_${key}`;
}

/**
 * 清掉上一个用户名留下的缓存：只删「记录里的旧用户名 + 已登记键尾」这一种组合，
 * 其余键（别的维度、以后新增的缓存、无关前缀）一律不动。
 */
function dropOtherOwnerCache(): void {
  try {
    const lastOwner = localStorage.getItem(CACHE_OWNER_KEY);
    if (lastOwner && lastOwner !== projectOwner) {
      for (const key of CACHE_KEYS) {
        localStorage.removeItem(`${CACHE_PREFIX}${lastOwner}_${key}`);
      }
    }
    localStorage.setItem(CACHE_OWNER_KEY, projectOwner);
  } catch {
    // 存储不可用（隐私模式 / 被禁用）时没有可清的东西
  }
}

let pruned = false;
/** 首次取数据时清一次旧用户名的缓存，之后不再扫 localStorage */
function pruneOnce(): void {
  if (pruned) return;
  pruned = true;
  dropOtherOwnerCache();
}

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

function loadCache<T>(key: CacheKey): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - ts > cacheTTL) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(key: CacheKey, data: unknown) {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export async function fetchRepos(): Promise<RepoInfo[]> {
  pruneOnce();
  const cached = loadCache<RepoInfo[]>('repos');
  if (cached) return cached;

  const res = await fetch(
    `https://api.github.com/users/${projectOwner}/repos?per_page=100&sort=updated`,
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
  pruneOnce();
  const cached = loadCache<number>('repo_count');
  if (cached !== null) return cached;

  const res = await fetch(`https://api.github.com/users/${projectOwner}`);
  if (!res.ok) throw new Error(`GitHub API 请求失败 (${res.status})`);

  const userData: { public_repos?: number } = await res.json();
  const count = userData.public_repos ?? 0;

  saveCache('repo_count', count);
  return count;
}
