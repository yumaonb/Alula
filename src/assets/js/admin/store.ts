// store.ts — 后台内存态（连接配置 / 登录身份 / 暂存变更）
// 用法：import { adminStore } from "../../assets/js/admin/store"
//
// 只存在内存里：不写 localStorage / sessionStorage / cookie，也没有服务端。
// 因此整页刷新会清空（密钥靠浏览器密码管理器按表单的 autocomplete 标记保存），
// 而 swup 站内切页不会重新执行模块，连接状态与暂存队列自然跨页存活。

export interface AdminConfig {
  /** 仓库所有者；表单里同时充当密码管理器的「用户名」 */
  owner: string;
  repo: string;
  /** 提交目标分支 */
  branch: string;
  /** 细粒度 PAT，只进内存 */
  token: string;
}

export interface StagedChange {
  /** 仓库内路径，如 src/content/posts/devnotes/css/grid.md */
  path: string;
  /** 变更后的内容；null 表示删除该文件 */
  content: string | null;
  /** 仓库里的原始内容；null 表示新增文件 */
  original: string | null;
}

export interface AdminViewer {
  login: string;
  name: string;
  avatarUrl: string;
}

export interface AdminState {
  config: AdminConfig;
  connected: boolean;
  viewer: AdminViewer | null;
  /** 待提交队列，按暂存先后排列 */
  changes: StagedChange[];
  /** 正在推送提交；期间拒绝新的暂存，避免提交快照与队列不一致 */
  committing: boolean;
}

type Listener = (state: AdminState) => void;

const emptyConfig = (): AdminConfig => ({ owner: '', repo: '', branch: 'main', token: '' });

let state: AdminState = {
  config: emptyConfig(),
  connected: false,
  viewer: null,
  changes: [],
  committing: false,
};

const listeners = new Set<Listener>();

function setState(patch: Partial<AdminState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

/** 标记连接成功，写入配置与登录身份 */
function connect(config: AdminConfig, viewer: AdminViewer | null): void {
  setState({ config, connected: true, viewer });
}

/** 断开连接；连暂存队列一起清掉，避免换了仓库还把上一个仓库的改动提交上去 */
function disconnect(): void {
  setState({ config: emptyConfig(), connected: false, viewer: null, changes: [] });
}

function changeOf(path: string): StagedChange | null {
  return state.changes.find((c) => c.path === path) ?? null;
}

/** 暂存一次写入；content 传 null 表示删除，内容与原始一致则视为撤销暂存 */
function stage(path: string, content: string | null, original: string | null): void {
  if (state.committing) return;
  if (content !== null && content === original) {
    unstage(path);
    return;
  }
  const next: StagedChange = { path, content, original };
  const idx = state.changes.findIndex((c) => c.path === path);
  const changes =
    idx >= 0 ? state.changes.map((c, i) => (i === idx ? next : c)) : [...state.changes, next];
  setState({ changes });
}

function unstage(path: string): void {
  if (state.committing) return;
  const changes = state.changes.filter((c) => c.path !== path);
  if (changes.length !== state.changes.length) setState({ changes });
}

function discardAll(): void {
  if (state.committing) return;
  if (state.changes.length > 0) setState({ changes: [] });
}

/** 提交成功后把已提交的路径摘出队列 */
function settle(paths: string[]): void {
  const done = new Set(paths);
  const changes = state.changes.filter((c) => !done.has(c.path));
  setState({ changes, committing: false });
}

/** 进入 / 退出提交流程 */
function setCommitting(value: boolean): void {
  if (state.committing !== value) setState({ committing: value });
}

export const adminStore = {
  get state(): AdminState {
    return state;
  },
  /** 订阅变更；订阅时会立刻用当前状态回调一次 */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    fn(state);
    return () => {
      listeners.delete(fn);
    };
  },
  connect,
  disconnect,
  changeOf,
  stage,
  unstage,
  discardAll,
  settle,
  setCommitting,
};
