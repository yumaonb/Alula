// shell.ts — 后台外壳运行时（连接弹窗 / 仓库状态 / 顶部提示）
// 用法：由 AdminLayout 引入：import "../../assets/js/admin/shell"
//
// 外壳在 #swup 容器之外，swup 切页不会碰它，所以连接状态与表单里填到一半的密钥
// 都不会因为切页丢失。密钥只写进内存，不落任何浏览器存储。
//
// 同一个弹窗按连接状态换内容：未连接是填仓库与令牌的表单，已连接是仓库状态。

import {
  GitHubError,
  getBranchHead,
  getRateLimit,
  parseRepoInput,
  verifyConnection,
} from './github';
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

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function inputValue(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '';
}

/** 提交编号太长，弹窗里只给前 7 位（和 GitHub 自己的短 sha 一致） */
function shortSha(sha: string | null): string {
  return sha ? sha.slice(0, 7) : '读取失败';
}

/**
 * 重置时间写全（年月日 + 时:分）。
 * 不能只写时:分——额度窗口是滚动的，跨天甚至跨月时「23:47 重置」会让人
 * 误以为是今天。这里按本地时区显示，跟用户表上的钟一致。
 */
function formatReset(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())} ${p(at.getHours())}:${p(at.getMinutes())}`;
}

/** 把速率限制画出来：剩余次数突出，总量做次要信息，重置时间单独一格 */
export function renderRateLimit(): void {
  const limit = getRateLimit();
  const value = document.getElementById('admin-rate-value');
  const total = document.getElementById('admin-rate-total');
  const reset = document.getElementById('admin-rate-reset');
  if (!value || !total || !reset) return;

  if (!limit) {
    value.textContent = '—';
    total.textContent = '／ —';
    reset.textContent = '连接后显示';
    return;
  }

  value.textContent = String(limit.remaining);
  total.textContent = `／ ${limit.limit}`;
  reset.textContent = formatReset(limit.resetAt);
}

/** 把 store 里的状态画到弹窗上：未连接显示表单，已连接显示仓库状态 */
function renderState(): void {
  const { connected, config, head, headUrl, changes } = adminStore.state;
  shell?.classList.toggle('is-connected', connected);
  // 弹窗挂在外壳之外，拿不到 .admin-shell 的类，所以自己同步一份；
  // admin.css 里表单/仓库状态的互斥就是认这个类。
  document.getElementById('admin-conn-panel')?.classList.toggle('is-connected', connected);

  setText('admin-conn-label', connected ? '已连接' : '未连接');
  setText('admin-status-repo', connected ? `${config.owner}/${config.repo}` : '—');
  setText('admin-status-branch', connected ? config.branch : '—');
  setText('admin-status-head', connected ? shortSha(head) : '—');
  setText('admin-status-staged', String(changes.length));

  // 有地址就把「最新提交编号」变成可点的链接，没地址（读失败）就退回纯文本。
  // 注意：链接里的文字也得自己写——模板初始是「—」，只设 href 会显示成破折号。
  const link = document.getElementById('admin-status-head-link') as HTMLAnchorElement | null;
  const text = document.getElementById('admin-status-head');
  if (link && text) {
    if (connected && headUrl) {
      link.href = headUrl;
      link.textContent = shortSha(head);
      link.hidden = false;
      text.hidden = true;
    } else {
      link.hidden = true;
      text.hidden = false;
      link.removeAttribute('href');
    }
  }

  renderRateLimit();
}

function setBusy(busy: boolean): void {
  const btn = document.getElementById('admin-conn-submit') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = busy;
    btn.textContent = busy ? '校验中…' : '连接';
  }
}

/** 把高亮挪到指定项（传 null 则全部清掉），其余清掉 */
export function setNavActive(target: HTMLElement | null): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-nav-path]')) {
    const active = link === target;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/** 弹窗开合；连接成功后自动收起 */
function setPanel(open: boolean): void {
  const panel = document.getElementById('admin-conn-panel');
  const toggle = document.getElementById('admin-conn-toggle');
  panel?.classList.toggle('is-open', open);
  toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');

  if (!open) return;

  // 每次打开都重画一次速率限制：这数字只在请求时才更新，
  // 而用户正是在打开弹窗这一刻看它，不刷新就会停在连接时的旧值。
  renderRateLimit();

  // 打开时把焦点送进第一个可填字段，密码管理器才认得出这是登录表单
  const first = adminStore.state.connected
    ? document.getElementById('admin-disconnect')
    : document.getElementById('admin-repo-input');
  (first as HTMLElement | null)?.focus();
}

function isPanelOpen(): boolean {
  return document.getElementById('admin-conn-panel')?.classList.contains('is-open') ?? false;
}

/**
 * 把仓库栏里的链接就地改写成 owner/repo。
 *
 * 关键点：不能只在 blur 里做。点「连接」按钮时，浏览器的事件顺序是
 * mousedown → blur（这里改写 input.value）→ mouseup → click，
 * blur 在 click 之前，所以看着是安全的；但如果用户是用键盘（Tab 到按钮后回车）
 * 或者某些浏览器不派发 blur，click 就会读到没转换过的原文。
 * 因此 submit() 里也会先解析一次——parseRepoInput 是幂等的，
 * 转换过再解析结果不变，两处都调没有副作用。
 */
function normalizeRepoField(): void {
  const input = document.getElementById('admin-repo-input') as HTMLInputElement | null;
  if (!input) return;
  const parsed = parseRepoInput(input.value);
  if (!parsed) return;
  const canonical = `${parsed.owner}/${parsed.repo}`;
  if (input.value !== canonical) input.value = canonical;
}

function isDrawerOpen(): boolean {
  return document.getElementById('admin-nav')?.classList.contains('is-open') ?? false;
}

/** 手机端侧栏抽屉的开合；遮罩与关闭按钮都带 data-drawer-close */
function setDrawer(open: boolean): void {
  document.getElementById('admin-nav')?.classList.toggle('is-open', open);
  document.querySelector('.admin-drawer-backdrop')?.classList.toggle('is-open', open);
  document.getElementById('admin-drawer-toggle')?.setAttribute('aria-expanded', String(open));
}

/** 连接后取一次分支头；取不到就显示读取失败，不影响已经建立的连接 */
async function refreshHead(): Promise<void> {
  try {
    const head = await getBranchHead(adminStore.state.config.branch);
    const { owner, repo } = adminStore.state.config;
    adminStore.setHead(head?.sha ?? null, head ? commitUrl(owner, repo, head.sha) : null);
  } catch {
    adminStore.setHead(null, null);
  }
}

/** 某个提交在 GitHub 上的页面地址 */
function commitUrl(owner: string, repo: string, sha: string): string {
  return `https://github.com/${owner}/${repo}/commit/${sha}`;
}

async function submit(): Promise<void> {
  // 先转换再解析：光标没离开输入框就点按钮时，blur 可能还没跑到
  normalizeRepoField();
  const parsed = parseRepoInput(inputValue('admin-repo-input'));
  const token = inputValue('admin-token');

  if (!parsed) {
    toast('仓库要写成「所有者/仓库名」，或直接粘仓库链接', 'error');
    return;
  }
  if (!token) {
    toast('还没填访问令牌', 'error');
    return;
  }

  setBusy(true);
  try {
    const { viewer, repoInfo } = await verifyConnection(parsed.owner, parsed.repo, token);
    // 分支不必手填，直接用仓库的默认分支
    adminStore.connect(
      { owner: parsed.owner, repo: parsed.repo, branch: repoInfo.defaultBranch, token },
      viewer,
    );
    setPanel(false);
    toast(`已连接 ${repoInfo.fullName}`);
    void refreshHead();
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

  adminStore.subscribe(renderState);

  document.getElementById('admin-conn-toggle')?.addEventListener('click', () => {
    setPanel(!isPanelOpen());
  });

  // 遮罩与右上角 × 都带 data-conn-close
  for (const el of document.querySelectorAll('[data-conn-close]')) {
    el.addEventListener('click', () => setPanel(false));
  }

  document.getElementById('admin-conn-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    void submit();
  });

  // 光标离开仓库栏就把链接改写成 owner/repo（贴链接的用户能看到它被「纠正」）
  document.getElementById('admin-repo-input')?.addEventListener('blur', normalizeRepoField);

  document.getElementById('admin-disconnect')?.addEventListener('click', () => {
    adminStore.disconnect();
    setPanel(false);
    toast('已断开连接');
  });

  // 手机端抽屉：按钮开合，遮罩/关闭按钮/选中分区后都收起
  document.getElementById('admin-drawer-toggle')?.addEventListener('click', () => {
    setDrawer(!isDrawerOpen());
  });

  for (const el of document.querySelectorAll('[data-drawer-close]')) {
    el.addEventListener('click', () => setDrawer(false));
  }

  // 点了分区就跳走了，抽屉别留在屏幕上。
  // 同时立刻把高亮挪到被点的那一项：swup 换页要等新页面拿到手才触发 after-swap，
  // 那之前高亮还停在旧项上，看着像「点了没反应」。syncNavActive() 会在换页后
  // 按真实路径再校正一次，所以这里先乐观地点亮是安全的。
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-nav-path]')) {
    link.addEventListener('click', () => {
      setDrawer(false);
      setNavActive(link);
    });
  }

  // 视口变宽回桌面布局时，抽屉状态要清掉，否则遮罩会留在宽屏上
  window.matchMedia('(max-width: 768px)').addEventListener('change', (e) => {
    if (!e.matches) setDrawer(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isPanelOpen()) setPanel(false);
    else if (isDrawerOpen()) setDrawer(false);
  });

  // 有未提交的改动时拦一下刷新/关页（现代浏览器只认 preventDefault）
  window.addEventListener('beforeunload', (e) => {
    if (adminStore.state.changes.length === 0) return;
    e.preventDefault();
  });
}

// 模块由 AdminLayout 引入即完成初始化；幂等守卫保证 swup 换页不会重复绑定
initShell();
