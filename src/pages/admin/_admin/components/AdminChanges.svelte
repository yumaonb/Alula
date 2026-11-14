<!-- AdminChanges.svelte — 待提交改动面板（后台布局常驻岛，swup 切页不消失）
     用法：<AdminChanges client:idle />（AdminLayout 中，#swup 之外，只水合一次） -->
<script lang="ts">
  import { onMount } from 'svelte';

  import { commitStaged } from '../js/github';
  import { adminStore, type StagedChange } from '../js/store';

  let connected = $state(false);
  let changes = $state<StagedChange[]>([]);
  let message = $state('');
  let busy = $state(false);
  let open = $state(false);
  let result = $state<
    { ok: true; url: string; count: number } | { ok: false; text: string } | null
  >(null);

  function statusOf(change: StagedChange): string {
    if (change.original === null) return '新增';
    if (change.content === null) return '删除';
    return '修改';
  }

  async function submit(): Promise<void> {
    if (busy || changes.length === 0) return;
    busy = true;
    result = null;
    adminStore.setCommitting(true);
    const paths = changes.map((c) => c.path);
    try {
      const text = message.trim() || `更新站点内容（${paths.length} 个文件）`;
      const info = await commitStaged(text, changes);
      adminStore.settle(paths);
      // 分支头已经移到这个新提交上，弹窗里的「最新提交编号」跟着更新，不必再请求一次
      adminStore.setHead(info.commitSha, info.commitUrl);
      message = '';
      open = false;
      result = { ok: true, url: info.commitUrl, count: info.count };
    } catch (err) {
      adminStore.setCommitting(false);
      result = { ok: false, text: err instanceof Error ? err.message : '提交失败' };
    } finally {
      busy = false;
    }
  }

  onMount(() =>
    adminStore.subscribe((state) => {
      connected = state.connected;
      changes = state.changes;
      if (state.changes.length === 0) open = false;
    }),
  );
</script>

{#if connected}
  <div class="admin-dock">
    {#if open}
      <div class="admin-dock-panel">
        <div class="admin-dock-head">
          <span class="admin-dock-title">待提交改动</span>
          <span class="admin-dock-num">{changes.length}</span>
        </div>

        {#if changes.length === 0}
          <p class="admin-dock-empty">队列是空的，去文章编辑里改点东西吧。</p>
        {:else}
          <ul class="admin-dock-list">
            {#each changes as change (change.path)}
              <li class="admin-dock-item">
                <span class="badge" class:is-delete={change.content === null}>
                  {statusOf(change)}
                </span>
                <span class="admin-dock-path" title={change.path}>{change.path}</span>
                <button
                  class="admin-dock-undo"
                  title="撤销暂存"
                  aria-label={`撤销 ${change.path}`}
                  onclick={() => adminStore.unstage(change.path)}>×</button
                >
              </li>
            {/each}
          </ul>

          <textarea
            class="admin-dock-message"
            rows="2"
            placeholder="提交说明（留空自动生成）"
            bind:value={message}></textarea>

          <div class="admin-dock-actions">
            <button class="btn" onclick={() => adminStore.discardAll()}>丢弃全部</button>
            <button class="btn btn--primary" disabled={busy} onclick={submit}>
              {busy ? '提交中…' : `一次提交 ${changes.length} 个文件`}
            </button>
          </div>
        {/if}

        {#if result}
          <p class="admin-dock-result" class:is-error={!result.ok}>
            {#if result.ok}
              已提交 {result.count} 个文件 ·
              <a href={result.url} target="_blank" rel="noopener noreferrer">查看提交</a>
            {:else}
              {result.text}
            {/if}
          </p>
        {/if}
      </div>
    {/if}

    <button
      class="admin-dock-fab"
      class:has-changes={changes.length > 0}
      class:is-open={open}
      aria-expanded={open}
      aria-label="待提交改动"
      onclick={() => (open = !open)}
    >
      <svg
        class="admin-dock-ico admin-dock-ico--clock"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m0 18a8 8 0 1 1 8-8a8 8 0 0 1-8 8m1-13h-2v6l5 3l1-1.7l-4-2.3z"
        />
      </svg>
      <svg
        class="admin-dock-ico admin-dock-ico--close"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
      {#if changes.length > 0}<span class="admin-dock-count">{changes.length}</span>{/if}
    </button>
  </div>
{/if}

<style>
  .admin-dock {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 120;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
  }

  .admin-dock-fab {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface);
    cursor: pointer;
    color: var(--ink);
    box-shadow: var(--admin-shadow);
  }

  .admin-dock-fab:hover,
  .admin-dock-fab:focus-visible {
    border-color: var(--border-strong);
  }

  /* 时钟与叉号叠在同一位置：开面板时交叉淡入淡出 + 旋转缩放，呈「旋转变形」
   * （时钟转走、叉号转进），比直接换图丝滑。 */
  .admin-dock-ico {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 22px;
    height: 22px;
    transition:
      opacity 0.2s ease,
      transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .admin-dock-ico--clock {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }

  .admin-dock-ico--close {
    opacity: 0;
    transform: rotate(-90deg) scale(0.5);
  }

  .admin-dock-fab.is-open .admin-dock-ico--clock {
    opacity: 0;
    transform: rotate(90deg) scale(0.5);
  }

  .admin-dock-fab.is-open .admin-dock-ico--close {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }

  .admin-dock-fab.has-changes {
    border-color: var(--blue);
    background: var(--blue);
    color: var(--on-primary);
  }

  /* 数量圆点：主色底 + 白环，有改动时从蓝底 fab 上也能读清；开面板时淡出收起 */
  .admin-dock-count {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 9px;
    background: var(--blue);
    box-shadow: 0 0 0 2px var(--surface);
    color: var(--on-primary);
    font-size: 0.7rem;
    line-height: 16px;
    text-align: center;
    transition:
      opacity 0.16s ease,
      transform 0.16s ease;
  }

  .admin-dock-fab.is-open .admin-dock-count {
    opacity: 0;
    transform: scale(0.4);
  }

  .admin-dock-panel {
    width: min(380px, calc(100vw - 40px));
    max-height: min(60vh, 520px);
    overflow-y: auto;
    padding: 14px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: var(--admin-shadow);
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: admin-dock-in 0.26s cubic-bezier(0.34, 1.4, 0.64, 1);
  }

  @keyframes admin-dock-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
  }

  .admin-dock-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.9rem;
    color: var(--ink);
  }

  .admin-dock-num {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--blue-soft);
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--blue-strong);
  }

  .admin-dock-empty {
    font-size: 0.82rem;
    color: var(--ink-muted);
  }

  .admin-dock-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .admin-dock-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.78rem;
  }

  .admin-dock-path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* 路径太长时优先保留文件名 */
    direction: rtl;
    text-align: left;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.74rem;
    color: var(--ink);
  }

  .admin-dock-undo {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--ink-muted);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }

  /* 撤销是破坏性小动作，hover 给一档红底预警 */
  .admin-dock-undo:hover,
  .admin-dock-undo:focus-visible {
    color: var(--red);
    background: var(--red-soft);
  }

  .admin-dock-message {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 0.82rem;
    resize: vertical;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .admin-dock-message:focus-visible {
    outline: none;
    border-color: var(--blue);
    box-shadow: 0 0 0 3px var(--focus-halo);
  }

  .admin-dock-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .admin-dock-actions .btn--primary {
    flex: 1;
  }

  .admin-dock-result {
    font-size: 0.78rem;
    color: var(--ink);
  }

  /* 失败结果：红字 + 加粗，和成功态区分 */
  .admin-dock-result.is-error {
    color: var(--red);
    font-weight: 600;
  }

  /* 减少动态偏好：只留颜色/透明度变化，去掉旋转、缩放与位移 */
  @media (prefers-reduced-motion: reduce) {
    .admin-dock-panel {
      animation: none;
    }

    .admin-dock-ico,
    .admin-dock-count {
      transition: opacity 0.2s ease;
      transform: none;
    }

    .admin-dock-fab.is-open .admin-dock-ico--clock,
    .admin-dock-fab.is-open .admin-dock-ico--close,
    .admin-dock-fab.is-open .admin-dock-count {
      transform: none;
    }
  }
</style>
