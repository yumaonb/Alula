<!-- PostsFilterModal.svelte — 分类与标签筛选抽屉
     用法：<PostsFilterModal client:idle />（BaseLayout 中，#swup 之外，只水合一次）
     入口：#posts-filter-fab 按钮点击打开；打开时把 sidebar-filter 移入抽屉展示 -->
<script lang="ts">
  import { onMount } from 'svelte';

  import { createDrawer, mountDrawer } from '../../assets/js/ui/drawer';

  import '../../assets/css/shared/drawer.css';

  let isOpen = $state(false);
  let filterRoot: Element | null = null;
  let sidebar: HTMLElement | null = null;
  let modalEl: HTMLDivElement | null = null;

  const drawer = createDrawer({
    modalEl: () => modalEl,
    isOpen: () => isOpen,
    setOpen: (open) => {
      isOpen = open;
    },
    fabId: 'posts-filter-fab',
    canOpen: () => {
      sidebar = document.querySelector<HTMLElement>('.posts-sidebar');
      filterRoot = sidebar?.querySelector('.sidebar-filter') || sidebar;
      return !!filterRoot?.children.length;
    },
    onBeforeOpen: () => {
      // 抽屉展示的是侧栏里的筛选面板，打开时把它搬进来
      const body = modalEl?.querySelector('.pfilter-modal-body');
      if (body && filterRoot) body.appendChild(filterRoot);
    },
    onClosed: () => {
      // 关闭后放回侧栏原位
      if (sidebar && filterRoot) sidebar.appendChild(filterRoot);
    },
    // 点分类 / 标签跳走前先关抽屉
    closeOn: ['[data-pfilter-close]', '.cat-item', '.chip'],
    focusOn: '.pfilter-modal-close',
  });

  onMount(() =>
    mountDrawer({
      modalEl,
      isOpen: () => isOpen,
      open: drawer.open,
      close: drawer.close,
      bindEntry: (openDrawer) => {
        const fab = document.getElementById('posts-filter-fab');
        if (!fab) return () => {};
        fab.addEventListener('click', openDrawer);
        return () => fab.removeEventListener('click', openDrawer);
      },
    }),
  );
</script>

<svelte:window onkeydown={drawer.onKeydown} />

<div
  bind:this={modalEl}
  class="pfilter-modal drawer"
  class:open={isOpen}
  role="dialog"
  aria-modal="true"
  aria-label="分类与标签"
  tabindex="-1"
  onclick={drawer.onPanelClick}
>
  <div class="pfilter-modal-mask drawer-mask" data-pfilter-close></div>
  <div class="pfilter-modal-panel drawer-panel glass">
    <div class="pfilter-modal-header drawer-header">
      <span class="pfilter-modal-title drawer-title">
        <svg
          class="pfilter-modal-title-icon drawer-title-icon"
          viewBox="0 0 32 32"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="m14.594 4l-.313.281l-11 11l-.687.719l.687.719l9 9l.719.687l.719-.687l11-11l.281-.313V4zm.844 2H23v7.563l-10 10L5.437 16zM26 7v2h1v8.156l-9.5 9.438l-1.25-1.25l-1.406 1.406l1.937 1.969l.719.687l.688-.687l10.53-10.407L29 18V7zm-6 1c-.55 0-1 .45-1 1s.45 1 1 1s1-.45 1-1s-.45-1-1-1"
          />
        </svg>
        分类与标签
      </span>
      <button
        class="pfilter-modal-close drawer-close hoverable"
        data-pfilter-close
        aria-label="关闭筛选"
        onclick={drawer.close}
      >
        <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path
            d="M7.219 5.781L5.78 7.22L14.563 16L5.78 24.781l1.44 1.439L16 17.437l8.781 8.782l1.438-1.438L17.437 16l8.782-8.781L24.78 5.78L16 14.563z"
          />
        </svg>
      </button>
    </div>
    <div class="pfilter-modal-body drawer-body"></div>
  </div>
</div>

<style>
  /* 骨架见 assets/css/shared/drawer.css；这里只留筛选抽屉的差异 */
  .pfilter-modal-body {
    padding: 14px 12px 20px;
    overflow-y: auto;
    scrollbar-width: thin;
    flex-direction: column;
    gap: 18px;
  }

  :global(.pfilter-modal .pfilter-modal-body .glass),
  :global(.pfilter-modal .pfilter-modal-body .sidebar-filter) {
    position: static;
    max-height: none;
    top: auto;
    overflow: visible;
  }

  :global(.pfilter-modal-body .cat-panel),
  :global(.pfilter-modal-body .tag-panel) {
    padding: 14px;
  }
</style>
