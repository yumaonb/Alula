/**
 * github.js — GitHub API 查询模块
 * 提供带 localStorage 缓存的 GitHub 数据查询能力
 */

const GITHUB_USERNAME = 'yumaonb';
const CACHE_PREFIX = 'gh_';
const CACHE_TTL = 60 * 60 * 1000; // 1 小时

function loadCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function saveCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export async function fetchRepos() {
  const cached = loadCache('repos');
  if (cached) return cached;

  const res = await fetch(
    `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=updated`
  );
  if (!res.ok) throw new Error(`GitHub API 请求失败 (${res.status})`);

  const data = await res.json();
  const repos = data
    .map((r) => ({
      name: r.name,
      description: r.description,
      html_url: r.html_url,
      language: r.language,
      stargazers_count: r.stargazers_count,
      forks_count: r.forks_count,
      topics: r.topics || [],
      pushed_at: r.pushed_at,
    }))
    .sort((a, b) => b.stargazers_count - a.stargazers_count);

  saveCache('repos', repos);
  return repos;
}

export async function fetchRepoCount() {
  const cached = loadCache('repo_count');
  if (cached !== null) return cached;

  const res = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}`);
  if (!res.ok) throw new Error(`GitHub API 请求失败 (${res.status})`);

  const userData = await res.json();
  const count = userData.public_repos || 0;

  saveCache('repo_count', count);
  return count;
}