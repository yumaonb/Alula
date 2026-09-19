// shell.ts — 后台外壳运行时（连接表单 / 未连接遮罩 / 顶部提示）
// 用法：由 AdminLayout 引入：import "../../assets/js/admin/shell"
//
// 外壳在 #swup 容器之外，swup 切页不会碰它，所以连接状态与表单里填到一半的密钥
// 都不会因为切页丢失。密钥只写进内存，不落任何浏览器存储。

import { GitHubError, verifyConnection } from './github';
import { adminStore } from './store';

const shell = document.getElementById('admin-shell');

/** 顶部提示：3 秒后自动淡出，新的提示会顶掉旧的 */
export function toast(text: string, kind: 'ok' | 'error' = 'ok'): void {
  const el = document.getElementById('admin-toast');
  if (!el) return;
  el.textContent = text;
  el.className = `admin-toast is-visible is-${kind}`;
  window.clearTimeout(Number(el.dataset.timer || 0));
  const timer = window.setTimeout(() => {
    el.className = 'admin-toast';
  }, 3000);
  el.dataset.timer = String(timer);
}

/** 把连接状态同步到外壳类名与顶部文案（页面里的「未连接」提示由 .is-connected 控制显隐） */
function renderConnection(): void {
  const { connected, viewer, config } = adminStore.state;
  shell?.classList.toggle('is-connected', connected);

  const text = document.getElementById('admin-conn-text');
  if (!text) return;
  text.textContent = connected
    ? `${config.owner}/${config.repo} · ${config.branch}${viewer ? ` · @${viewer.login}` : ''}`
    : '未连接 GitHub';
}

function setBusy(busy: boolean): void {
  const btn = document.getElementById('admin-conn-submit') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = busy;
    btn.textContent = busy ? '校验中…' : '连接';
  }
}

function readForm(): { owner: string; repo: string; branch: string; token: string } {
  const value = (id: string) =>
    (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '';
  return {
    owner: value('admin-owner'),
    repo: value('admin-repo'),
    branch: value('admin-branch') || 'main',
    token: (document.getElementById('admin-token') as HTMLInputElement | null)?.value.trim() ?? '',
  };
}

/** 连接面板的开合；连接成功后自动收起 */
function setPanel(open: boolean): void {
  const panel = document.getElementById('admin-conn-panel');
  const toggle = document.getElementById('admin-conn-toggle');
  panel?.classList.toggle('is-open', open);
  toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

async function submit(): Promise<void> {
  const { owner, repo, branch, token } = readForm();
  if (!owner || !repo || !token) {
    toast('所有者、仓库名与令牌都要填', 'error');
    return;
  }

  setBusy(true);
  try {
    const { viewer } = await verifyConnection(owner, repo, token);
    adminStore.connect({ owner, repo, branch, token }, viewer);
    setPanel(false);
    toast(`已连接 ${owner}/${repo}`);
  } catch (err) {
    const message =
      err instanceof GitHubError
        ? err.status === 401
          ? '令牌无效或已过期（401）'
          : err.status === 404
            ? '仓库不存在，或令牌没有这个仓库的权限（404）'
            : err.message
        : '连接失败，请检查网络';
    toast(message, 'error');
  } finally {
    setBusy(false);
  }
}

export function initShell(): void {
  if (window.__adminShellInit || !shell) return;
  window.__adminShellInit = true;

  adminStore.subscribe(renderConnection);

  document.getElementById('admin-conn-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('admin-conn-panel');
    setPanel(!panel?.classList.contains('is-open'));
  });

  document.getElementById('admin-conn-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    void submit();
  });

  document.getElementById('admin-disconnect')?.addEventListener('click', () => {
    adminStore.disconnect();
    setPanel(true);
    toast('已断开连接');
  });

  // 有未提交的改动时拦一下刷新/关页（现代浏览器只认 preventDefault）
  window.addEventListener('beforeunload', (e) => {
    if (adminStore.state.changes.length === 0) return;
    e.preventDefault();
  });
}

// 模块由 AdminLayout 引入即完成初始化；幂等守卫保证 swup 换页不会重复绑定
initShell();
