<!-- PostsDrawers.svelte — 文章区两个抽屉合一：目录（#toc-fab）+ 分类与标签（#posts-filter-fab）
     用法：<PostsDrawers client:idle />（BaseLayout 中，#swup 之外，只水合一次）
     两个抽屉各绑自己的入口按钮、各自开合；目录节点常驻目录抽屉体（手机端版面，
     toc.ts 按版面归位），筛选抽屉打开时把侧栏筛选搬进自己体内展示 -->
<script lang="ts">
  import { onMount } from 'svelte';

  import { queryTocNav } from '../../assets/js/util/post-sidebar';
  import { createDrawer, mountDrawer } from '../../assets/js/ui/drawer';

  import '../../assets/css/shared/drawer.css';

  let tocOpen = $state(false);
  let tocModalEl: HTMLDivElement | null = null;
  let tocBodyEl: HTMLDivElement | null = null;
  let filterOpen = $state(false);
  let filterModalEl: HTMLDivElement | null = null;
  let filterRoot: Element | null = null;
  let filterSidebar: HTMLElement | null = null;

  /** 面板在抽屉里的版式差异由各面板组件自己负责（变体类），
   *  抽屉不必穿透它们的内部结构；进出要成对，撤销掉才不会把抽屉版式带回侧栏 */
  function markPanelsInDrawer(inDrawer: boolean): void {
    filterRoot?.querySelectorAll<HTMLElement>('.cat-panel, .tag-panel').forEach((panel) => {
      const isCategory = panel.classList.contains('cat-panel');
      panel.classList.toggle(
        isCategory ? 'cat-panel--in-drawer' : 'tag-panel--in-drawer',
        inDrawer,
      );
    });
  }

  const tocDrawer = createDrawer({
    modalEl: () => tocModalEl,
    isOpen: () => tocOpen,
    setOpen: (open) => {
      tocOpen = open;
    },
    fabId: 'toc-fab',
    // 「这页有没有目录」口径之一：节点在不在（全部口径见 PostsShell.astro 的 hasToc 注释）
    canOpen: () => !!tocBodyEl && !!window.__toc && !!queryTocNav(),
    onOpened: () => {
      // 先确保节点在位（版面跨界 / 切页漏了一次也不会开出空抽屉），
      // 再重测：锁滚动后滚动条消失、整页重排，目录几何要重来
      window.__toc?.ensure();
      window.__toc?.remeasure();
    },
    // 点目录项跳转前先关抽屉
    closeOn: ['[data-toc-close]', '.toc-link'],
    focusOn: '.toc-modal-close',
  });

  const filterDrawer = createDrawer({
    modalEl: () => filterModalEl,
    isOpen: () => filterOpen,
    setOpen: (open) => {
      filterOpen = open;
    },
    fabId: 'posts-filter-fab',
    canOpen: () => {
      // 只认筛选子树，取不到就不开：兜底到整个侧栏会把作者卡、头像一起搬进抽屉，
      // 关回来时还会把分类树的展开状态弄乱
      const root = document.querySelector<HTMLElement>('.posts-sidebar .sidebar-filter');
      return !!root && root.children.length > 0;
    },
    onBeforeOpen: () => {
      // 抽屉展示的是侧栏里的筛选面板，打开时把它搬进来
      filterSidebar = document.querySelector<HTMLElement>('.posts-sidebar');
      filterRoot = filterSidebar?.querySelector<HTMLElement>('.sidebar-filter') ?? null;
      if (!filterSidebar || !filterRoot) {
        console.error('[PostsDrawers] 找不到 .posts-sidebar 或 .sidebar-filter，筛选内容为空');
        return;
      }
      filterModalEl?.querySelector('.pfilter-modal-body')?.appendChild(filterRoot);
      markPanelsInDrawer(true);
    },
    onClosed: () => {
      // 关闭后放回侧栏原位，变体类要一起撤销：
      // 留在身上会让面板回到侧栏后仍是抽屉里的版式
      markPanelsInDrawer(false);
      if (filterSidebar && filterRoot) filterSidebar.appendChild(filterRoot);
    },
    // 点分类 / 标签跳走前先关抽屉
    closeOn: ['[data-pfilter-close]', '.cat-item', '.tag-panel .chip'],
    focusOn: '.pfilter-modal-close',
  });

  onMount(() => {
    // 登记目录抽屉容器：目录节点在手机端常驻这里（toc.ts 按版面归位）
    if (tocBodyEl) {
      window.__tocDrawerHost = tocBodyEl;
      window.__toc?.ensure();
    }
    const unmountToc = mountDrawer({
      modalEl: tocModalEl,
      isOpen: () => tocOpen,
      open: tocDrawer.open,
      close: tocDrawer.close,
      bindEntry: (openDrawer) => {
        const widgets = document.getElementById('side-widgets');
        if (!widgets) return () => {};
        function onWidgetsClick(e: MouseEvent): void {
          const target = e.target as HTMLElement | null;
          if (target?.closest('#toc-fab')) openDrawer();
        }
        widgets.addEventListener('click', onWidgetsClick);
        return () => widgets.removeEventListener('click', onWidgetsClick);
      },
    });
    const unmountFilter = mountDrawer({
      modalEl: filterModalEl,
      isOpen: () => filterOpen,
      open: filterDrawer.open,
      close: filterDrawer.close,
      bindEntry: (openDrawer) => {
        const fab = document.getElementById('posts-filter-fab');
        if (!fab) return () => {};
        fab.addEventListener('click', openDrawer);
        return () => fab.removeEventListener('click', openDrawer);
      },
    });
    return () => {
      unmountToc();
      unmountFilter();
      if (window.__tocDrawerHost === tocBodyEl) window.__tocDrawerHost = undefined;
    };
  });

  // 两个抽屉共用一个 window 监听：各自的 onKeydown 只看自己的 isOpen，互不干扰
  function onKeydown(e: KeyboardEvent): void {
    tocDrawer.onKeydown(e);
    filterDrawer.onKeydown(e);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  bind:this={tocModalEl}
  class="toc-modal drawer"
  class:open={tocOpen}
  role="dialog"
  aria-modal="true"
  aria-label="文章目录"
  tabindex="-1"
  onclick={tocDrawer.onPanelClick}
>
  <div class="toc-modal-mask drawer-mask" data-toc-close></div>
  <div class="toc-modal-panel drawer-panel glass">
    <div class="toc-modal-header drawer-header">
      <span class="toc-modal-title drawer-title">
        <svg
          class="toc-modal-title-icon drawer-title-icon"
          viewBox="0 0 32 32"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M4 5v6h6V5zm2 2v2H6V7zm6 0v2h15V7zm-8 6v6h6v-6zm2 2v2H6v-2zm6 0v2h15v-2zm-8 6v6h6v-6zm2 2v2H6v-2zm6 0v2h15v-2z"
          />
        </svg>
        文章目录
      </span>
      <button
        class="toc-modal-close drawer-close hoverable"
        data-toc-close
        aria-label="关闭目录"
        onclick={tocDrawer.close}
      >
        <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path
            d="M17.4 16l4.9-4.9a.7.7 0 0 0-1-1L16.4 15l-4.9-4.9a.7.7 0 0 0-1 1l4.9 4.9-4.9 4.9a.7.7 0 0 0 1 1l4.9-4.9 4.9 4.9a.7.7 0 0 0 1-1z"
          />
        </svg>
      </button>
    </div>
    <div class="toc-modal-body drawer-body" bind:this={tocBodyEl}></div>
  </div>
</div>

<div
  bind:this={filterModalEl}
  class="pfilter-modal drawer"
  class:open={filterOpen}
  role="dialog"
  aria-modal="true"
  aria-label="分类与标签"
  tabindex="-1"
  onclick={filterDrawer.onPanelClick}
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
        onclick={filterDrawer.close}
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
  /* 目录抽屉的差异（骨架见 assets/css/shared/drawer.css） */
  .toc-modal-header {
    min-height: 68px;
  }

  @media (max-width: 768px) {
    .toc-modal-header {
      min-height: 56px;
    }
  }

  .toc-modal-body {
    padding: 4px 10px 10px;
  }

  /* 目录在抽屉里的版式差异由目录组件自己负责（.toc-nav--in-drawer 变体类），
     这里只管抽屉自己的容器，不穿透目录组件的内部结构 */
  :global(.toc-modal-body .toc-nav--in-drawer .toc-scroll) {
    max-height: none;
    height: 100%;
  }

  /* 筛选抽屉的差异（骨架见 assets/css/shared/drawer.css） */
  .pfilter-modal-body {
    padding: 14px 12px 20px;
    overflow-y: auto;
    scrollbar-width: thin;
    gap: 18px;
  }

  /* 筛选子树整体在抽屉里的版式：这是抽屉自己的容器，不算穿透面板内部结构 */
  :global(.pfilter-modal .pfilter-modal-body .glass),
  :global(.pfilter-modal .pfilter-modal-body .sidebar-filter) {
    position: static;
    max-height: none;
    top: auto;
    overflow: visible;
  }
</style>
