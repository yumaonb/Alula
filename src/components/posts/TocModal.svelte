<!-- TocModal.svelte — 文章目录抽屉
     入口：#toc-fab 按钮点击打开；打开时把 .toc-nav 从文章侧栏移入抽屉展示 -->
<script>
  import { onMount } from 'svelte';

  let isOpen = $state(false);
  let lastFocus = null;
  let hosted = null;
  let hostHome = null;
  let navHeader = null;
  let modalEl;
  let bodyEl;

  /** 让入口按钮的 aria-expanded 跟随抽屉开关 */
  function setFabExpanded(v) {
    const fab = document.getElementById('toc-fab');
    if (fab) fab.setAttribute('aria-expanded', v ? 'true' : 'false');
  }

  function open() {
    if (isOpen) return;
    const nav = document.querySelector('.toc-nav');
    if (!nav) return;
    isOpen = true;
    setFabExpanded(true);
    lastFocus = document.activeElement;
    hostHome = nav.parentNode;
    hosted = nav;
    navHeader = nav.querySelector('.toc-header');
    if (navHeader) navHeader.remove();
    bodyEl?.appendChild(nav);
    if (window.__tocSnap) window.__tocSnap();
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      modalEl?.querySelector('.toc-modal-close')?.focus();
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    setFabExpanded(false);
    document.body.style.overflow = '';
    if (hosted && hostHome && hostHome.isConnected) {
      hostHome.appendChild(hosted);
      if (navHeader) hosted.prepend(navHeader);
    }
    hosted = null;
    hostHome = null;
    navHeader = null;
    lastFocus?.focus?.();
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && isOpen) close();
  }

  function onModalClick(e) {
    if (e.target?.closest?.('[data-toc-close]')) {
      close();
      return;
    }
    if (e.target?.closest?.('.toc-link')) close();
  }

  /** 入口按钮在 SideWidgets 容器内，容器级事件委托即可（与挂载顺序无关） */
  function onWidgetsClick(e) {
    if (e.target?.closest?.('#toc-fab')) open();
  }

  onMount(() => {
    // 挂到 body 防止被 .side-widgets 的 fixed 层叠上下文压住
    if (modalEl) document.body.appendChild(modalEl);

    const widgets = document.getElementById('side-widgets');
    widgets?.addEventListener('click', onWidgetsClick);

    // 复用 NavBar 的共享 matchMedia 监听器
    function onEnterDesktop() {
      if (isOpen) close();
    }
    if (typeof window.__onEnterDesktop === 'function') {
      window.__onEnterDesktop(onEnterDesktop);
    } else {
      window.matchMedia('(min-width: 769px)').addEventListener('change', (e) => {
        if (e.matches) onEnterDesktop();
      });
    }

    // swup 切页时抽屉必然要关（切走前先关闭）
    function onVisitStart() {
      if (isOpen) close();
    }
    document.addEventListener('swup:visit:start', onVisitStart);

    return () => {
      widgets?.removeEventListener('click', onWidgetsClick);
      document.removeEventListener('swup:visit:start', onVisitStart);
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={modalEl}
  class="toc-modal"
  class:open={isOpen}
  role="dialog"
  aria-modal="true"
  aria-label="文章目录"
  onclick={onModalClick}
>
  <div class="toc-modal-mask" data-toc-close></div>
  <div class="toc-modal-panel">
    <div class="toc-modal-header">
      <span class="toc-modal-title">
        <svg
          class="toc-modal-title-icon"
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
      <button class="toc-modal-close" data-toc-close aria-label="关闭目录" onclick={close}>
        <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path
            d="M17.4 16l4.9-4.9a.7.7 0 0 0-1-1L16.4 15l-4.9-4.9a.7.7 0 0 0-1 1l4.9 4.9-4.9 4.9a.7.7 0 0 0 1 1l4.9-4.9 4.9 4.9a.7.7 0 0 0 1-1z"
          />
        </svg>
      </button>
    </div>
    <div class="toc-modal-body" bind:this={bodyEl}></div>
  </div>
</div>

<style>
  .toc-modal {
    position: fixed;
    inset: 0;
    z-index: 110;
    visibility: hidden;
    pointer-events: none;
    transition: visibility 0s linear 0.25s;
  }

  .toc-modal.open {
    visibility: visible;
    pointer-events: auto;
    transition-delay: 0s;
  }

  .toc-modal-mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  .toc-modal.open .toc-modal-mask {
    opacity: 1;
  }

  .toc-modal-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(320px, 85vw);
    display: flex;
    flex-direction: column;
    border-radius: var(--radius) 0 0 var(--radius);
    background: transparent;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.37),
      inset 1px 0 0 rgba(255, 255, 255, 0.08);
    transform: translateX(100%);
    transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .toc-modal.open .toc-modal-panel {
    transform: translateX(0);
  }

  .toc-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 10px 10px 16px;
    min-height: 68px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .toc-modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.75);
  }

  .toc-modal-title-icon {
    width: 18px;
    height: 18px;
    opacity: 0.65;
  }

  @media (max-width: 768px) {
    .toc-modal-header {
      min-height: 56px;
    }
  }

  .toc-modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .toc-modal-close :global(svg) {
    width: 16px;
    height: 16px;
  }

  .toc-modal-close:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.04);
  }

  .toc-modal-body {
    flex: 1;
    display: flex;
    min-height: 0;
    padding: 4px 10px 10px;
  }

  :global(.toc-modal-body .toc-nav) {
    flex: 1;
    min-height: 0;
  }

  :global(.toc-modal .toc-modal-body .toc-track) {
    max-height: none;
    flex: 1;
  }
</style>
