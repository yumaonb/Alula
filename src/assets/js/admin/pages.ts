// pages.ts — 后台页面控制器（仪表盘 / 文章列表 / 文章编辑）
// 用法：由 AdminLayout 引入：import "../../assets/js/admin/pages"
// 模块只在首次加载求值一次；swup 换掉 #swup 里的内容后由 boot() 重新绑定当前页面。

import {
  GitHubError,
  getFileTextOrNull,
  listCategoryMeta,
  listPostFiles,
  type TreeEntry,
} from './github';
import { renderRateLimit, setAccordion, setNavActive, toast } from './shell';
import { adminStore } from './store';

const POSTS_PREFIX = 'src/content/posts/';

type Cleanup = () => void;

function formatError(err: unknown): string {
  if (err instanceof GitHubError) {
    if (err.status === 401) return '令牌无效或已过期（401）';
    if (err.status === 403) return '权限不足或触发限流（403）';
    if (err.status === 404) return '资源不存在（404），检查仓库与分支名';
    if (err.status === 409) return '分支已被更新（409），重新连接后再提交';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return '未知错误';
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function pageName(): string {
  return document.querySelector('[data-admin-page]')?.getAttribute('data-admin-page') ?? '';
}

/**
 * 顶栏在 #swup 之外，swup 换页不会替换它，所以标题得自己更新。
 * 文案取自当前页面根元素上的 data-admin-title。
 */
function syncPageTitle(): void {
  const root = document.querySelector('[data-admin-page]');
  const title = root?.getAttribute('data-admin-title') ?? '';
  const target = byId('admin-topbar-title');
  if (target && title) target.textContent = title;
}

/** 连上之后跑一次；断开再连会重跑 */
function whenConnected(run: () => Promise<void>): Cleanup {
  let loaded = false;
  return adminStore.subscribe((state) => {
    if (!state.connected) {
      loaded = false;
      return;
    }
    if (loaded) return;
    loaded = true;
    void run()
      .catch((err: unknown) => {
        loaded = false;
        toast(formatError(err), 'error');
      })
      // 成功失败都刷新：失败（如限流）时这次请求同样消耗/反映了额度
      .finally(renderRateLimit);
  });
}

function setText(id: string, value: string): void {
  const target = byId(id);
  if (target) target.textContent = value;
}

// ---- 仪表盘 ----

/** 仪表盘只剩静态说明与入口，没有需要绑定的状态 */
function initDashboard(): Cleanup {
  return () => {};
}

// ---- 文章列表 ----

function initPostsList(): Cleanup {
  const cleanups: Cleanup[] = [];
  const list = byId<HTMLUListElement>('admin-posts-list');
  const filter = byId<HTMLInputElement>('admin-posts-filter');
  const newPath = byId<HTMLInputElement>('admin-new-path');
  const newOpen = byId<HTMLAnchorElement>('admin-new-open');
  let files: TreeEntry[] = [];

  function render(): void {
    if (!list) return;
    const query = filter?.value.trim().toLowerCase() ?? '';
    const shown = query ? files.filter((f) => f.path.toLowerCase().includes(query)) : files;

    list.textContent = '';
    if (shown.length === 0) {
      const li = document.createElement('li');
      li.className = 'admin-empty';
      li.textContent = files.length === 0 ? '仓库里还没有文章' : '没有匹配的文件';
      list.appendChild(li);
      return;
    }

    for (const file of shown) {
      const li = document.createElement('li');
      li.className = 'admin-file-row';

      const link = document.createElement('a');
      link.className = 'admin-file-link';
      link.href = `/admin/posts/edit/?path=${encodeURIComponent(file.path)}`;
      link.textContent = file.path.slice(POSTS_PREFIX.length);
      li.appendChild(link);

      const staged = adminStore.changeOf(file.path);
      if (staged) {
        const chip = document.createElement('span');
        chip.className = 'admin-chip is-staged';
        chip.textContent = staged.content === null ? '待删除' : '已暂存';
        li.appendChild(chip);
      }

      list.appendChild(li);
    }
  }

  /** 新建文章的入口是普通链接，交给 swup 接管，避免整页刷新丢掉内存里的令牌 */
  function syncNewLink(): void {
    if (!newOpen) return;
    const value = (newPath?.value ?? '').trim().replace(/^\/+/, '');
    const path = value.startsWith(POSTS_PREFIX) ? value : POSTS_PREFIX + value;
    newOpen.href = `/admin/posts/edit/?path=${encodeURIComponent(path || POSTS_PREFIX)}`;
  }

  filter?.addEventListener('input', render);
  cleanups.push(() => filter?.removeEventListener('input', render));
  newPath?.addEventListener('input', syncNewLink);
  cleanups.push(() => newPath?.removeEventListener('input', syncNewLink));
  syncNewLink();

  cleanups.push(adminStore.subscribe(() => render()));

  cleanups.push(
    whenConnected(async () => {
      setText('admin-posts-status', '读取中…');
      files = await listPostFiles(adminStore.state.config.branch);
      files.sort((a, b) => a.path.localeCompare(b.path));
      setText('admin-posts-status', `共 ${files.length} 个 Markdown 文件`);
      render();
    }),
  );

  return () => cleanups.forEach((fn) => fn());
}

// ---- 分类管理 ----

/**
 * 分类树由「文章所在目录」推出来：每个分类至少得有一篇文章才存在。
 * 只列出有 index.json 的目录会漏掉大量没配元数据的分类，所以这里以文章路径为准，
 * index.json 存在与否只决定「有没有配显示名」。
 */
function initCategories(): Cleanup {
  const cleanups: Cleanup[] = [];
  const list = byId<HTMLUListElement>('admin-cats-list');
  const filter = byId<HTMLInputElement>('admin-cats-filter');
  let dirs: string[] = [];
  let withMeta = new Set<string>();

  function render(): void {
    if (!list) return;
    const query = filter?.value.trim().toLowerCase() ?? '';
    const shown = query ? dirs.filter((d) => d.toLowerCase().includes(query)) : dirs;

    list.textContent = '';
    if (shown.length === 0) {
      const li = document.createElement('li');
      li.className = 'admin-empty';
      li.textContent = dirs.length === 0 ? '还没有任何分类' : '没有匹配的分类';
      list.appendChild(li);
      return;
    }

    for (const dir of shown) {
      const li = document.createElement('li');
      li.className = 'admin-file-row';

      // 分类没有独立页面可编辑，点进编辑器看它的 index.json（不存在就是新建）
      const link = document.createElement('a');
      link.className = 'admin-file-link';
      link.href = `/admin/posts/edit/?path=${encodeURIComponent(`${POSTS_PREFIX}${dir}/index.json`)}`;
      link.textContent = dir;
      li.appendChild(link);

      if (!withMeta.has(dir)) {
        const chip = document.createElement('span');
        chip.className = 'admin-chip';
        chip.textContent = '无 index.json';
        li.appendChild(chip);
      }

      list.appendChild(li);
    }
  }

  filter?.addEventListener('input', render);
  cleanups.push(() => filter?.removeEventListener('input', render));

  cleanups.push(
    whenConnected(async () => {
      setText('admin-cats-status', '读取中…');
      const branch = adminStore.state.config.branch;
      const [files, meta] = await Promise.all([listPostFiles(branch), listCategoryMeta(branch)]);

      const set = new Set<string>();
      for (const file of files) {
        const rel = file.path.slice(POSTS_PREFIX.length);
        const parts = rel.split('/');
        // 末段是文件名，往上每一层目录都是一个分类
        for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join('/'));
      }
      // 只有 index.json、目录下暂时没文章的，也算一个分类
      for (const path of meta.keys()) set.add(path.slice(POSTS_PREFIX.length, -'/index.json'.length));

      dirs = [...set].sort((a, b) => a.localeCompare(b));
      withMeta = new Set(
        [...meta.keys()].map((p) => p.slice(POSTS_PREFIX.length, -'/index.json'.length)),
      );

      setText('admin-cats-status', `共 ${dirs.length} 个分类`);
      render();
    }),
  );

  return () => cleanups.forEach((fn) => fn());
}

// ---- 文章编辑 ----

function initEditor(): Cleanup {
  const cleanups: Cleanup[] = [];
  const textarea = byId<HTMLTextAreaElement>('admin-editor-text');
  const saveBtn = byId<HTMLButtonElement>('admin-editor-save');
  const deleteBtn = byId<HTMLButtonElement>('admin-editor-delete');
  const fileList = byId<HTMLUListElement>('admin-file-list');
  const fileFilter = byId<HTMLInputElement>('admin-file-filter');

  const requested = new URLSearchParams(window.location.search).get('path') ?? '';
  let currentPath = requested;
  let original: string | null = null;
  let files: TreeEntry[] = [];

  function refreshChip(): void {
    const chip = byId('admin-editor-state');
    if (!chip) return;
    const staged = adminStore.changeOf(currentPath);
    if (staged) {
      chip.textContent = staged.content === null ? '待删除' : '已暂存';
      chip.className = 'admin-chip is-staged';
      return;
    }
    const dirty = textarea ? textarea.value !== (original ?? '') : false;
    chip.textContent = dirty ? '有未暂存修改' : '未暂存';
    chip.className = dirty ? 'admin-chip is-dirty' : 'admin-chip';
  }

  function refreshLines(): void {
    if (!textarea) return;
    setText('admin-editor-lines', `${textarea.value.split('\n').length} 行`);
  }

  function renderFiles(): void {
    if (!fileList) return;
    const query = fileFilter?.value.trim().toLowerCase() ?? '';
    const shown = query ? files.filter((f) => f.path.toLowerCase().includes(query)) : files;

    fileList.textContent = '';
    if (shown.length === 0) {
      const li = document.createElement('li');
      li.className = 'admin-empty';
      li.textContent = files.length === 0 ? '仓库里还没有文章' : '没有匹配的文件';
      fileList.appendChild(li);
      return;
    }

    for (const file of shown) {
      const li = document.createElement('li');
      li.className = 'admin-file-row';
      if (file.path === currentPath) li.classList.add('is-active');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-file-link';
      button.textContent = file.path.slice(POSTS_PREFIX.length);
      button.addEventListener('click', () => void openFile(file.path));
      li.appendChild(button);

      const staged = adminStore.changeOf(file.path);
      if (staged) {
        const chip = document.createElement('span');
        chip.className = 'admin-chip is-staged';
        chip.textContent = staged.content === null ? '待删除' : '已暂存';
        li.appendChild(chip);
      }

      fileList.appendChild(li);
    }
  }

  async function openFile(path: string): Promise<void> {
    if (!textarea) return;
    currentPath = path;

    const staged = adminStore.changeOf(path);
    if (staged) {
      original = staged.original;
      textarea.value = staged.content ?? '';
    } else {
      const remote = await getFileTextOrNull(path, adminStore.state.config.branch);
      original = remote?.text ?? null;
      textarea.value = remote?.text ?? '';
    }

    setText('admin-editor-path', path);
    refreshChip();
    refreshLines();
    renderFiles();
  }

  function save(): void {
    if (!textarea) return;
    if (!currentPath) {
      toast('先在左侧选一个文件', 'error');
      return;
    }
    adminStore.stage(currentPath, textarea.value, original);
    toast('已暂存，记得在右下角一次性提交');
    refreshChip();
    renderFiles();
  }

  function removeFile(): void {
    if (!currentPath) return;
    if (original === null && !adminStore.changeOf(currentPath)) {
      toast('这个文件还没暂存过，没什么可删', 'error');
      return;
    }
    adminStore.stage(currentPath, null, original);
    toast('已暂存删除');
    refreshChip();
    renderFiles();
  }

  function onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  }

  saveBtn?.addEventListener('click', save);
  deleteBtn?.addEventListener('click', removeFile);
  textarea?.addEventListener('input', () => {
    refreshChip();
    refreshLines();
  });
  fileFilter?.addEventListener('input', renderFiles);
  document.addEventListener('keydown', onKeydown);

  cleanups.push(() => {
    saveBtn?.removeEventListener('click', save);
    deleteBtn?.removeEventListener('click', removeFile);
    fileFilter?.removeEventListener('input', renderFiles);
    document.removeEventListener('keydown', onKeydown);
  });

  cleanups.push(adminStore.subscribe(() => refreshChip()));

  cleanups.push(
    whenConnected(async () => {
      files = await listPostFiles(adminStore.state.config.branch);
      files.sort((a, b) => a.path.localeCompare(b.path));
      renderFiles();
      if (currentPath) await openFile(currentPath);
    }),
  );

  return () => cleanups.forEach((fn) => fn());
}

// ---- 装配 ----

let activeCleanup: Cleanup | null = null;

/** 侧栏在 #swup 之外，切页时不会重渲染，高亮与展开态都得自己跟上 */
function syncNavActive(): void {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  // 取「匹配得最长」的那一项：/admin/posts/edit 既落了 /admin 的前缀、
  // 又精确匹配自己那一项，只按「能匹配就点亮」会让两项一起亮。
  // 分区首页（/admin）例外：它是所有后台页的前缀，只按完全相等算，否则每页都亮。
  // 这条判断与 AdminNav.astro 里的 isActive 是同一套，改一处要同步另一处。
  let best: HTMLAnchorElement | null = null;
  let bestLen = -1;
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-nav-path]')) {
    const target = (link.dataset.navPath ?? '').replace(/\/+$/, '') || '/';
    const hit =
      target === path || (target !== '/admin' && path.startsWith(`${target}/`));
    if (hit && target.length > bestLen) {
      best = link;
      bestLen = target.length;
    }
  }

  // 一项都没匹配上（例如将来加了没登记进侧栏的页面）就全部清掉，
  // 别让上一页的高亮留在那儿
  setNavActive(best);

  // 命中的那一项如果藏在收起的二级菜单里，就是「亮着但看不见」，
  // 所以把它所在的父项展开。但只对「没被用户手动开合过」的组这么做：
  // 用户特意收起过的组，一切页又被弹开，会显得不听话。
  for (const group of document.querySelectorAll('[data-nav-accordion]')) {
    if (!best || !group.contains(best)) continue;
    if (group.hasAttribute('data-nav-user-touched')) continue;
    setAccordion(group, true);
  }
}

// ---- 网站设置 ----

/**
 * 网站设置下的八页目前只有表单骨架，还没有读写逻辑：
 * 它们要改的是 src/data/*.ts，而那是 TS 源码不是 JSON，写回去需要先把数据换成 JSON
 * 再让 .ts 只做 import + 类型断言。在此之前故意不接 adminStore，避免改坏仓库里的源文件。
 *
 * 这里留一个共用的占位实现：只把计数类状态文案改成「待接入」，
 * 不注册任何监听，返回空 cleanup 让 boot() 的契约保持一致。
 */
function initSettingsPlaceholder(cardIds: string[]): Cleanup {
  for (const id of cardIds) {
    const status = byId(id);
    if (status) status.textContent = '待接入';
  }
  return () => {};
}

function initSettingsSite(): Cleanup {
  return initSettingsPlaceholder([]);
}

function initSettingsProfile(): Cleanup {
  return initSettingsPlaceholder([]);
}

function initSettingsBackground(): Cleanup {
  return initSettingsPlaceholder([]);
}

function initSettingsHome(): Cleanup {
  return initSettingsPlaceholder([]);
}

function initSettingsFriends(): Cleanup {
  return initSettingsPlaceholder(['admin-friend-status']);
}

function initSettingsQuotes(): Cleanup {
  return initSettingsPlaceholder(['admin-quotes-status']);
}

function initSettingsSponsor(): Cleanup {
  return initSettingsPlaceholder(['admin-support-status']);
}

function initSettingsIntegrations(): Cleanup {
  return initSettingsPlaceholder([]);
}

function boot(): void {
  activeCleanup?.();
  activeCleanup = null;

  syncNavActive();
  syncPageTitle();

  const name = pageName();
  if (name === 'dashboard') activeCleanup = initDashboard();
  else if (name === 'posts') activeCleanup = initPostsList();
  else if (name === 'categories') activeCleanup = initCategories();
  else if (name === 'editor') activeCleanup = initEditor();
  else if (name === 'settings-site') activeCleanup = initSettingsSite();
  else if (name === 'settings-profile') activeCleanup = initSettingsProfile();
  else if (name === 'settings-background') activeCleanup = initSettingsBackground();
  else if (name === 'settings-home') activeCleanup = initSettingsHome();
  else if (name === 'settings-friends') activeCleanup = initSettingsFriends();
  else if (name === 'settings-quotes') activeCleanup = initSettingsQuotes();
  else if (name === 'settings-sponsor') activeCleanup = initSettingsSponsor();
  else if (name === 'settings-integrations') activeCleanup = initSettingsIntegrations();
}

document.addEventListener('astro:after-swap', boot);
boot();
