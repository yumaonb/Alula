// shell.ts — 后台外壳运行时（连接弹窗 / 仓库状态 / 顶部提示）
// 用法：由 AdminLayout 引入：import "./js/shell"
//
// 外壳在 #swup 容器之外，swup 切页不会碰它，所以连接状态与表单里填到一半的密钥
// 都不会因为切页丢失。密钥只写进内存，不落任何浏览器存储。
//
// 同一个弹窗按连接状态换内容：未连接是填仓库与令牌的表单，已连接是仓库状态。

import {
  getBranchHead,
  getRateLimit,
  githubErrorMessage,
  parseRepoInput,
  verifyConnection,
} from './github';
import { adminStore } from './store';
import { toggleGroup } from './expand-collapse';
import { preloadMotion } from './motion';

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

export function setText(id: string, text: string): void {
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

/**
 * 速率限制的两处展示：连接弹窗与后台首页仓库状态，id 成对登记在这里，
 * 新增一处往数组里加一行即可。未取到额度时的兜底文案按场景各给。
 */
const RATE_TARGETS = [
  {
    value: 'admin-rate-value',
    total: 'admin-rate-total',
    reset: 'admin-rate-reset',
    resetIdle: '连接后显示',
  },
  {
    value: 'admin-dash-rate-value',
    total: 'admin-dash-rate-total',
    reset: 'admin-dash-rate-reset',
    resetIdle: '—',
  },
] as const;

/** 把速率限制画出来：剩余次数突出，总量做次要信息，重置时间单独一格 */
export function renderRateLimit(): void {
  const limit = getRateLimit();
  for (const target of RATE_TARGETS) {
    const value = document.getElementById(target.value);
    const total = document.getElementById(target.total);
    const reset = document.getElementById(target.reset);
    if (!value || !total || !reset) continue;

    if (!limit) {
      value.textContent = '—';
      total.textContent = '／ —';
      reset.textContent = target.resetIdle;
      continue;
    }

    value.textContent = String(limit.remaining);
    total.textContent = `／ ${limit.limit}`;
    reset.textContent = formatReset(limit.resetAt);
  }
}

/**
 * 「最新提交编号」的两种形态：有提交地址就做成可点链接（点开去 GitHub 看这次提交），
 * 没地址（读失败）就退回纯文本。
 * 注意：链接里的文字也得自己写——模板初始是「—」，只设 href 会显示成破折号。
 * 连接弹窗与后台首页仓库状态共用，展示口径改一处两处同时生效。
 */
export function renderHead(linkId: string, textId: string): void {
  const { connected, head, headUrl } = adminStore.state;
  const link = document.getElementById(linkId) as HTMLAnchorElement | null;
  const text = document.getElementById(textId);
  if (!link || !text) return;

  if (connected && headUrl) {
    link.href = headUrl;
    link.textContent = shortSha(head);
    link.hidden = false;
    text.hidden = true;
    return;
  }

  link.hidden = true;
  text.hidden = false;
  link.removeAttribute('href');
  text.textContent = connected ? shortSha(head) : '—';
}

/** 把 store 里的状态画到弹窗上：未连接显示表单，已连接显示仓库状态 */
function renderState(): void {
  const { connected, config, changes } = adminStore.state;
  shell?.classList.toggle('is-connected', connected);
  // 弹窗挂在外壳之外，拿不到 .admin-shell 的类，所以自己同步一份；
  // admin.css 里表单/仓库状态的互斥就是认这个类。
  document.getElementById('admin-conn-panel')?.classList.toggle('is-connected', connected);

  setText('admin-conn-label', connected ? '已连接' : '未连接');
  setText('admin-status-repo', connected ? `${config.owner}/${config.repo}` : '—');
  setText('admin-status-branch', connected ? config.branch : '—');
  setText('admin-status-staged', String(changes.length));

  renderHead('admin-status-head-link', 'admin-status-head');

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

/**
 * 侧栏二级菜单的开合：容器带 data-nav-accordion，父项按钮带 data-nav-toggle。
 *
 * byUser 区分「用户点的」和「切页时自动展开的」：用户手动收起过的组会被记上标记，
 * 之后切页不再自动把它弹开——否则用户收起来、一切页又自己张开，像是不听话。
 * 用 dataset 而不是 JS 变量存，是因为侧栏在 #swup 之外、切页不重建，
 * 标记挂在 DOM 上天然能跨页保留。
 *
 * 飞行由同目录 expand-collapse.ts（前台 util 版的独立拷贝）驱动（CSS 只留端点）：
 * 展开/收起窗口与刚体同曲线同长；首屏的自动展开赶在 motion 就绪之前，直接落位不播动画。
 */
export function setAccordion(group: Element, open: boolean, byUser = false): void {
  if (byUser) group.setAttribute('data-nav-user-touched', '');
  const wasOpen = group.classList.contains('is-open');
  measureNavSub(group);
  group.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', String(open));
  if (open === wasOpen) return;

  const wrap = group.querySelector<HTMLElement>('.admin-nav-sub');
  const clip = group.querySelector<HTMLElement>('.admin-nav-sub-clip');
  if (!wrap || !clip) {
    group.classList.toggle('is-open', open);
    return;
  }
  toggleGroup({
    wrap,
    clip,
    height: clip.offsetHeight,
    open,
    onState: () => group.classList.toggle('is-open', open),
  });
}

/**
 * 把子菜单的真实高度写进 --sub-h，供 CSS 的 max-height 使用。
 *
 * 不写死高度是因为分组可增可减：写死 108px 的话，加到第四项时动画会在
 * 108px 处截断，最后一项看起来没滑到位。这里量的是内层内容自身高度——
 * 它恒等于内容高度、不受外层窗口压缩影响，所以随时量都准。
 * 必须在切换 is-open 之前量；展开状态下量会拿到被 max-height 限制的旧值。
 */
export function measureNavSub(group: Element): void {
  const clip = group.querySelector<HTMLElement>('.admin-nav-sub-clip');
  if (!clip) return;
  group
    .querySelector<HTMLElement>('.admin-nav-sub')
    ?.style.setProperty('--sub-h', `${clip.offsetHeight}px`);
}

/** 量一遍所有分组，把实高写进 --sub-h（供 CSS 端点用） */
export function initNavSubHeights(): void {
  for (const group of document.querySelectorAll('[data-nav-accordion]')) measureNavSub(group);
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
    const notFound = '仓库不存在，或令牌没有这个仓库的权限（404）';
    const message = githubErrorMessage(err, notFound) ?? '连接失败，请检查网络';
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

  // 首屏先把各组子菜单的实高量出来写进 --sub-h。
  // 顺序很重要：必须在 syncNavActive()（pages.ts 的 boot）自动展开之前完成，
  // 否则那一次展开会因为没量到高度而跳一下。
  initNavSubHeights();

  // motion 懒加载：首屏不拉这个 54 KB 的共享块，等首帧画完再取。
  // 用户真正点击通常在几百毫秒之后，到那时动画引擎已就绪；
  // 万一还没就绪，animateLazy 会把元素直接落到终态，不会卡住。
  const warmMotion = (): void => void preloadMotion();
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmMotion, { timeout: 2000 });
  } else {
    globalThis.setTimeout(warmMotion, 200);
  }

  // 父项按钮只开关自己的子菜单，不跳转；点击不冒泡到下面那圈链接监听。
  // 侧栏在 #swup 之外、切页时整块不重渲染，所以这里只绑一次就够。
  for (const toggle of document.querySelectorAll<HTMLButtonElement>('[data-nav-toggle]')) {
    toggle.addEventListener('click', () => {
      const group = toggle.closest('[data-nav-accordion]');
      if (group) setAccordion(group, !group.classList.contains('is-open'), true);
    });
  }

  // 点了分区就跳走了，抽屉别留在屏幕上。
  // 同时立刻把高亮挪到被点的那一项：swup 换页要等新页面拿到手才触发 after-swap，
  // 那之前高亮还停在旧项上，看着像「点了没反应」。syncNavActive() 会在换页后
  // 按真实路径再校正一次，所以这里先乐观地点亮是安全的。
  // 点了子项就顺手把父项展开：此时父项是收起的话，高亮会藏在一片 0 高度里看不见。
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-nav-path]')) {
    link.addEventListener('click', () => {
      setDrawer(false);
      setNavActive(link);
      const group = link.closest('[data-nav-accordion]');
      if (group) setAccordion(group, true);
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
