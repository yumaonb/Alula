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
    const { data, ts } = JSON.parse(raw) as { data: T; ts?: number };
    // ts 缺失或不是有效数字时一律视为无缓存：Date.now() - undefined 得 NaN，
    // 而 NaN > cacheTTL 恒为 false，会让这条缓存永不过期
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
    if (Date.now() - ts > cacheTTL) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(key: CacheKey, data: unknown): void {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify({ data, ts: Date.now() }));
  } catch (err) {
    // 配额满 / 隐私模式下写入会失败：记一条，否则缓存没写进去没人知道
    console.error('[github] 缓存写入失败', key, err);
  }
}

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

/** 单页仓库数：GitHub 允许每页最多 100 条 */
const PER_PAGE = 100;

/** 翻页上限：GitHub 公开仓库数上限 1000，10 页足够取完，兜底防死循环 */
const MAX_PAGES = 10;

/** 请求超时：连上了但一直不返回时骨架会永远转，必须有上限 */
const TIMEOUT_MS = 10000;

/** 发一次 GitHub API 请求。
 *  超时必须设：失败有兜底，挂起没有——不设超时就是无限等待，页面永远停在骨架。
 *  非 2xx 一并在这里转成带 `[github]` 前缀的错误，调用方不必各自判断。 */
async function requestGithub(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    throw new Error(
      `[github] ${timedOut ? `请求超时（${TIMEOUT_MS / 1000}s）` : '网络请求失败'}：${url}`,
      { cause: err },
    );
  }
  if (!res.ok) throw new Error(`[github] GitHub API 请求失败 (${res.status})：${url}`);
  return res;
}

/** 解析 JSON 响应。
 *  限流 / 代理劫持会返回 200 + HTML 错误页，裸调 res.json() 抛的是 SyntaxError，
 *  看不出问题出在 GitHub 数据上，这里转成说得清的错误。 */
async function readJson<T>(res: Response, url: string): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch (err) {
    throw new Error(`[github] 响应不是 JSON（可能是限流页或代理拦截）：${url}`, { cause: err });
  }
}

/** 从 Link 头取出下一页的 URL（没有 rel="next" 就是最后一页） */
function nextPageUrl(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
    if (match) return match[1];
  }
  return null;
}

/** 同一键的并发请求合并成一次：骨架与卡片同时取数时不必各打一次 API */
const inFlight = new Map<CacheKey, Promise<unknown>>();

/** 缓存 + 去重 + 落库的公共入口：先查缓存，未命中走 fetcher，结果写回缓存 */
async function cachedRequest<T>(key: CacheKey, fetcher: () => Promise<T>): Promise<T> {
  pruneOnce();
  const cached = loadCache<T>(key);
  if (cached !== null) return cached;

  const pending = inFlight.get(key);
  if (pending) return (await pending) as T;

  const task = fetcher()
    .then((data) => {
      saveCache(key, data);
      return data;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, task);
  return task;
}

export async function fetchRepos(): Promise<RepoInfo[]> {
  return cachedRequest<RepoInfo[]>('repos', async () => {
    // 逐页取完：只取第一页会让仓库多的账号被静默截断，
    // 与「仓库总数」卡片显示的真实数量对不上
    const raw: RawRepo[] = [];
    let url: string | null =
      `https://api.github.com/users/${projectOwner}/repos?per_page=${PER_PAGE}&sort=updated`;
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const res = await requestGithub(url);
      const data = await readJson<RawRepo[]>(res, url);
      raw.push(...data);
      url = nextPageUrl(res.headers.get('Link'));
    }

    return raw
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
  });
}

export async function fetchRepoCount(): Promise<number> {
  return cachedRequest<number>('repo_count', async () => {
    const url = `https://api.github.com/users/${projectOwner}`;
    const res = await requestGithub(url);
    const userData = await readJson<{ public_repos?: number }>(res, url);
    return userData.public_repos ?? 0;
  });
}
