// github.ts — 后台的 GitHub API 客户端（读取 + 一次性打包提交）
// 用法：import { verifyConnection, listPostFiles, commitStaged } from "../../assets/js/admin/github"
//
// 提交走 Git Data API 的五步流水线，无论暂存了多少文件都只产生一个 commit：
//   取分支头 → 取头提交的 tree → 逐个变更建 blob → 建 tree（带 base_tree）→ 建 commit → 移动分支引用
// 这样 N 个文件的改动只算一次提交，也不会像逐个 PUT contents 那样触发 N 次 Pages 构建。
// 仓库与令牌一律从 adminStore 现取，不在这里另存一份，避免两处状态不同步。

import { adminStore, type StagedChange } from './store';

const API = 'https://api.github.com';

/** API 错误：带上状态码，UI 才能区分「令牌无效」和「分支被别人推走了」 */
export class GitHubError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** 连接校验阶段 store 里还没写入，允许显式传令牌 */
  token?: string;
}

function headers(token?: string): Record<string, string> {
  const value = token ?? adminStore.state.config.token;
  if (!value) throw new GitHubError('尚未填写访问令牌', 401);
  return {
    Authorization: `Bearer ${value}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/**
 * 速率限制快照。GitHub 每个响应都带 x-ratelimit-* 头，
 * 所以随便一次请求就能顺手把当前额度记下来，不必额外调 /rate_limit。
 */
export interface RateLimit {
  /** 本窗口剩余可用次数 */
  remaining: number;
  /** 本窗口总次数（PAT 通常 5000/小时） */
  limit: number;
  /** 窗口重置时间 */
  resetAt: Date;
}

/** 最近一次请求的速率限制；还没发过请求时为 null */
let lastRateLimit: RateLimit | null = null;

/** 读取最近一次请求带回来的速率限制 */
export function getRateLimit(): RateLimit | null {
  return lastRateLimit;
}

/** 从响应头解析速率限制；缺头（某些代理/缓存）时保持原值 */
function captureRateLimit(res: Response): void {
  const remaining = Number(res.headers.get('x-ratelimit-remaining'));
  const limit = Number(res.headers.get('x-ratelimit-limit'));
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || !Number.isFinite(reset)) return;
  // reset 是秒级 UNIX 时间戳
  lastRateLimit = { remaining, limit, resetAt: new Date(reset * 1000) };
}

async function gh<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 成功失败都要记，失败响应（如 403 限流）同样带这些头
  captureRateLimit(res);

  if (!res.ok) {
    let detail = '';
    try {
      const payload = (await res.json()) as { message?: string };
      detail = payload.message ?? '';
    } catch {
      detail = res.statusText;
    }
    throw new GitHubError(detail || `GitHub API 请求失败（${res.status}）`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- base64 ↔ UTF-8 ----
// atob/btoa 只认 Latin-1，直接喂中文会乱码，必须自己过一遍字节。

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000; // 一次转太多字符会爆栈
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---- 读取 ----

export interface RepoInfo {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
}

export interface RepoInput {
  owner: string;
  repo: string;
}

/**
 * 解析仓库输入，兼容手写与直接粘链接：
 *   yumaonb/Alula · https://github.com/yumaonb/Alula · git@github.com:yumaonb/Alula.git
 *   github.com/yumaonb/Alula/tree/main · https://github.com/yumaonb/Alula/
 * 只取前两段，所以带 /tree/xxx 之类的尾巴也不影响；只写一个词（缺所有者）返回 null。
 */
export function parseRepoInput(value: string): RepoInput | null {
  const text = value
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '') // 去掉 https://
    .replace(/^[^/@\s]+@[^/:\s]+:/, '') // 去掉 git@github.com:
    .replace(/^(www\.)?github\.com\//i, '') // 去掉 github.com/
    .replace(/\.git$/i, '') // 去掉 .git 后缀
    .replace(/^\/+|\/+$/g, ''); // 去掉首尾斜杠

  const [owner, repo] = text.split('/').filter(Boolean);
  if (!owner || !repo) return null;
  return { owner, repo };
}

export interface ViewerInfo {
  login: string;
  name: string;
  avatarUrl: string;
}

export interface RefInfo {
  /** 分支头提交 sha，提交时要拿它当 expected，冲突时 GitHub 直接拒绝 */
  sha: string;
  branch: string;
}

export interface TreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

export interface FileText {
  text: string;
  /** 仓库里当前这份内容的 blob sha */
  sha: string;
}

/** 校验令牌与仓库：成功即证明三者都对得上，顺便拿到登录身份 */
export async function verifyConnection(
  owner: string,
  repo: string,
  token: string,
): Promise<{ viewer: ViewerInfo; repoInfo: RepoInfo }> {
  const [viewer, repoInfo] = await Promise.all([
    gh<{ login: string; name: string | null; avatar_url: string }>('/user', { token }),
    gh<{
      full_name: string;
      default_branch: string;
      private: boolean;
      html_url: string;
    }>(`/repos/${owner}/${repo}`, { token }),
  ]);

  return {
    viewer: {
      login: viewer.login,
      name: viewer.name ?? viewer.login,
      avatarUrl: viewer.avatar_url,
    },
    repoInfo: {
      fullName: repoInfo.full_name,
      defaultBranch: repoInfo.default_branch,
      private: repoInfo.private,
      htmlUrl: repoInfo.html_url,
    },
  };
}

/** 取分支头提交；分支不存在时返回 null（UI 好提示「分支名写错了」） */
export async function getBranchHead(branch: string): Promise<RefInfo | null> {
  const { owner, repo } = adminStore.state.config;
  try {
    const ref = await gh<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    return { sha: ref.object.sha, branch };
  } catch (err) {
    if (err instanceof GitHubError && err.status === 404) return null;
    throw err;
  }
}

/** 列出仓库里全部 Markdown 文章（走 tree API，一次请求拿完整清单） */
export async function listPostFiles(branch: string): Promise<TreeEntry[]> {
  const { owner, repo } = adminStore.state.config;
  const head = await getBranchHead(branch);
  if (!head) throw new GitHubError(`分支 ${branch} 不存在`, 404);

  const commit = await gh<{ tree: { sha: string } }>(
    `/repos/${owner}/${repo}/git/commits/${head.sha}`,
  );
  const tree = await gh<{ tree: TreeEntry[]; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${commit.tree.sha}?recursive=1`,
  );
  if (tree.truncated) throw new GitHubError('仓库文件太多，tree 结果被截断', 422);

  return tree.tree.filter(
    (e) => e.type === 'blob' && e.path.startsWith('src/content/posts/') && e.path.endsWith('.md'),
  );
}

/** 读单个文件内容；大文件走 blob API 兜底（contents API 对 >1MB 只回 encoding: none） */
export async function getFileText(path: string, branch: string): Promise<FileText> {
  const { owner, repo } = adminStore.state.config;
  const res = await gh<{ content: string; encoding: string; sha: string }>(
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
  );

  if (res.encoding === 'base64' && res.content) {
    return { text: decodeBase64(res.content), sha: res.sha };
  }

  const blob = await gh<{ content: string; encoding: string }>(
    `/repos/${owner}/${repo}/git/blobs/${res.sha}`,
  );
  return { text: decodeBase64(blob.content), sha: res.sha };
}

/** 读文件，不存在时返回 null（新增文章的正常路径） */
export async function getFileTextOrNull(path: string, branch: string): Promise<FileText | null> {
  try {
    return await getFileText(path, branch);
  } catch (err) {
    if (err instanceof GitHubError && err.status === 404) return null;
    throw err;
  }
}

// ---- 一次性打包提交 ----

export interface CommitResult {
  commitSha: string;
  commitUrl: string;
  /** 本次提交涉及的文件数（含删除） */
  count: number;
}

/**
 * 把暂存队列里的全部变更打成一个提交推上去。
 *
 * 关键点：tree 带 `base_tree`，所以只需要列出「有改动的路径」，
 * 其余文件由 GitHub 沿用基准 tree，不必把整棵仓库树发上去。
 */
export async function commitStaged(
  message: string,
  changes: StagedChange[],
): Promise<CommitResult> {
  if (changes.length === 0) throw new GitHubError('暂存队列是空的，没有可提交的改动', 400);

  const { owner, repo, branch } = adminStore.state.config;
  const base = `/repos/${owner}/${repo}`;

  const head = await getBranchHead(branch);
  if (!head) throw new GitHubError(`分支 ${branch} 不存在`, 404);

  const headCommit = await gh<{ tree: { sha: string } }>(`${base}/git/commits/${head.sha}`);

  // 逐个变更建 blob；删除不需要 blob
  const writes = changes.filter((c) => c.content !== null);
  const blobs = await Promise.all(
    writes.map(async (change) => {
      const blob = await gh<{ sha: string }>(`${base}/git/blobs`, {
        method: 'POST',
        body: { content: encodeBase64(change.content as string), encoding: 'base64' },
      });
      return { path: change.path, sha: blob.sha };
    }),
  );

  // sha 传 null 就是删除该路径
  const tree = [
    ...blobs.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })),
    ...changes
      .filter((c) => c.content === null)
      .map((c) => ({ path: c.path, mode: '100644', type: 'blob', sha: null })),
  ];

  const newTree = await gh<{ sha: string }>(`${base}/git/trees`, {
    method: 'POST',
    body: { base_tree: headCommit.tree.sha, tree },
  });

  const commit = await gh<{ sha: string; html_url: string }>(`${base}/git/commits`, {
    method: 'POST',
    body: { message, tree: newTree.sha, parents: [head.sha] },
  });

  // 带上 expected sha：这期间有人推了新提交就返回 409，不会把别人的改动顶掉
  await gh(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: { sha: commit.sha, force: false },
  });

  return {
    commitSha: commit.sha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
    count: changes.length,
  };
}
