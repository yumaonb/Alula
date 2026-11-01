<!-- TocModal.svelte — 文章目录抽屉
     用法：<TocModal client:idle />（BaseLayout 中，#swup 之外，只水合一次）
     入口：#toc-fab 按钮点击打开；目录节点常驻这里（手机端版面，toc.ts 按版面归位），这里只管抽屉开合 -->
<script lang="ts">
  import { onMount } from 'svelte';

  import { lockBodyScroll, unlockBodyScroll } from '../../assets/js/util/body-scroll-lock';
  import { mountDrawer } from '../../assets/js/ui/drawer';

  import '../../assets/css/shared/drawer.css';

  let isOpen = $state(false);
  let lastFocus: HTMLElement | null = null;
  let modalEl: HTMLDivElement | null = null;
  let bodyEl: HTMLDivElement | null = null;

  function setFabExpanded(v: boolean): void {
    const fab = document.getElementById('toc-fab');
    if (fab) fab.setAttribute('aria-expanded', v ? 'true' : 'false');
  }

  function open(): void {
    if (isOpen) return;
    if (!bodyEl || !window.__toc || !document.querySelector('.toc-nav')) return;
    isOpen = true;
    setFabExpanded(true);
    lastFocus = document.activeElement as HTMLElement | null;
    lockBodyScroll();
    // 先确保节点在位（版面跨界 / 切页漏了一次也不会开出空抽屉），
    // 再重测：锁滚动后滚动条消失、整页重排，目录几何要重来
    window.__toc?.ensure();
    window.__toc?.remeasure();
    requestAnimationFrame(() => {
      modalEl?.querySelector('.toc-modal-close')?.focus();
    });
  }

  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    setFabExpanded(false);
    unlockBodyScroll();
    lastFocus?.focus();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && isOpen) close();
  }

  function onModalClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-toc-close]')) {
      close();
      return;
    }
    if (target.closest('.toc-link')) close();
  }

  /** 入口按钮在 SideWidgets 容器内，容器级事件委托即可（与挂载顺序无关） */
  onMount(() => {
    // 登记抽屉容器：目录节点在手机端常驻这里（toc.ts 按版面归位）
    if (bodyEl) {
      window.__tocDrawerHost = bodyEl;
      window.__toc?.ensure();
    }
    const unmount = mountDrawer({
      modalEl,
      isOpen: () => isOpen,
      open,
      close,
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
    return () => {
      unmount();
      if (window.__tocDrawerHost === bodyEl) window.__tocDrawerHost = undefined;
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div
  bind:this={modalEl}
  class="toc-modal drawer"
  class:open={isOpen}
  role="dialog"
  aria-modal="true"
  aria-label="文章目录"
  tabindex="-1"
  onclick={onModalClick}
  onkeydown={onKeydown}
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
            d="M4 5v6h6V5zm2 2h2v2H6zm6 0v2h15V7zm-8 6v6h6v-6zm2 2h2v2H6zm6 0v2h15v-2zm-8 6v6h6v-6zm2 2h2v2H6zm6 0v2h15v-2z"
          />
        </svg>
        文章目录
      </span>
      <button
        class="toc-modal-close drawer-close hoverable"
        data-toc-close
        aria-label="关闭目录"
        onclick={close}
      >
        <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path
            d="M17.4 16l4.9-4.9a.7.7 0 0 0-1-1L16.4 15l-4.9-4.9a.7.7 0 0 0-1 1l4.9 4.9-4.9 4.9a.7.7 0 0 0 1 1l4.9-4.9 4.9 4.9a.7.7 0 0 0 1-1z"
          />
        </svg>
      </button>
    </div>
    <div class="toc-modal-body drawer-body" bind:this={bodyEl}></div>
  </div>
</div>

<style>
  /* 骨架见 assets/css/shared/drawer.css；这里只留目录抽屉的差异 */
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

  /* 抽屉自己有标题栏，侧栏那行标题在抽屉里隐藏（不再靠摘 DOM 节点） */
  :global(.toc-modal-body .toc-nav .toc-header) {
    display: none;
  }

  :global(.toc-modal-body .toc-nav) {
    flex: 1;
    min-height: 0;
  }

  :global(.toc-modal .toc-modal-body .toc-track) {
    flex: 1;
    min-height: 0;
  }

  :global(.toc-modal .toc-modal-body .toc-scroll) {
    max-height: none;
    height: 100%;
  }
</style>
