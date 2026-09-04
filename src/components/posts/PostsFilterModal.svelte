<!-- PostsFilterModal.svelte — 分类与标签筛选抽屉 -->
<script>
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';

  let isOpen = $state(false);
  let lastFocus = null;
  let filterRoot = null;
  let sidebar = null;
  let modalEl;

  function open() {
    if (isOpen) return;
    sidebar = document.querySelector('.posts-sidebar');
    filterRoot = sidebar?.querySelector('.sidebar-filter') || sidebar;
    if (!filterRoot?.children.length) return;

    isOpen = true;
    lastFocus = document.activeElement;
    const body = modalEl?.querySelector('.pfilter-modal-body');
    if (body && filterRoot) body.appendChild(filterRoot);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const closeBtn = modalEl?.querySelector('.pfilter-modal-close');
      closeBtn?.focus();
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.body.style.overflow = '';
    if (sidebar && filterRoot) sidebar.appendChild(filterRoot);
    lastFocus?.focus?.();
  }

  function onMaskClick(e) {
    if (e.target?.closest?.('[data-pfilter-close]')) { close(); return; }
    if (e.target?.closest?.('.cat-item') || e.target?.closest?.('.chip')) close();
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && isOpen) close();
  }

  onMount(() => {
    if (modalEl) document.body.appendChild(modalEl);

    const fab = document.getElementById('posts-filter-fab');
    if (fab) fab.addEventListener('click', open);

    function onEnterDesktop() { if (isOpen) close(); }
    if (typeof window.__onEnterDesktop === 'function') {
      window.__onEnterDesktop(onEnterDesktop);
    } else {
      window.matchMedia('(min-width: 769px)').addEventListener('change', e => {
        if (e.matches) onEnterDesktop();
      });
    }

    return () => {
      fab?.removeEventListener('click', open);
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={modalEl}
  class="pfilter-modal"
  class:open={isOpen}
  role="dialog"
  aria-modal="true"
  aria-label="分类与标签"
  onclick={onMaskClick}
>
  <div class="pfilter-modal-mask" data-pfilter-close></div>
  <div class="pfilter-modal-panel">
    <div class="pfilter-modal-header">
      <span class="pfilter-modal-title">
        <Icon icon="la:tags" class="pfilter-modal-title-icon" />
        分类与标签
      </span>
      <button class="pfilter-modal-close" data-pfilter-close aria-label="关闭筛选" onclick={close}>
        <Icon icon="la:times" />
      </button>
    </div>
    <div class="pfilter-modal-body"></div>
  </div>
</div>

<style>
  .pfilter-modal {
    position: fixed;
    inset: 0;
    z-index: 110;
    visibility: hidden;
    pointer-events: none;
    transition: visibility 0s linear 0.25s;
  }

  .pfilter-modal.open {
    visibility: visible;
    pointer-events: auto;
    transition-delay: 0s;
  }

  .pfilter-modal-mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  .pfilter-modal.open .pfilter-modal-mask { opacity: 1; }

  .pfilter-modal-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(320px, 85vw);
    display: flex;
    flex-direction: column;
    border-radius: var(--radius) 0 0 var(--radius);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37), inset 1px 0 0 rgba(255, 255, 255, 0.08);
    transform: translateX(100%);
    transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .pfilter-modal.open .pfilter-modal-panel { transform: translateX(0); }

  .pfilter-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 10px 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .pfilter-modal-header { min-height: 56px; }
  }

  .pfilter-modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.75);
  }

  .pfilter-modal-title-icon {
    width: 18px;
    height: 18px;
    opacity: 0.65;
  }

  .pfilter-modal-close {
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
    transition: color 0.15s ease, background 0.15s ease;
  }

  .pfilter-modal-close :global(svg) {
    width: 16px;
    height: 16px;
  }

  .pfilter-modal-close:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.04);
  }

  .pfilter-modal-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    padding: 14px 12px 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  :global(.pfilter-modal-body .glass),
  :global(.pfilter-modal-body .sidebar-filter) {
    position: static !important;
    max-height: none;
    top: auto !important;
    overflow: visible;
  }

  :global(.pfilter-modal-body .cat-panel),
  :global(.pfilter-modal-body .tag-panel) {
    padding: 14px;
  }
</style>
