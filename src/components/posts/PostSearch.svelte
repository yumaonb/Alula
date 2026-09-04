<!-- PostSearch.svelte — 文章搜索框组件 -->
<script>
  import { onMount, onDestroy } from 'svelte';

  let { placeholder = '搜索文章…', categoryPath = '', filterUrls = [] } = $props();

  let kw = $state('');
  let results = $state([]);
  let activeIndex = $state(-1);
  let isOpen = $state(false);
  let isLoading = $state(false);
  let errorMsg = $state('');
  let seq = 0;
  let timer;
  let inputEl = $state(null);
  let dropdownEl = $state(null);
  let pagefindMod = null;

  async function loadPagefind() {
    if (!pagefindMod) {
      try {
        const resp = await fetch('/pagefind/pagefind.js');
        const text = await resp.text();
        const blob = new Blob([text], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        pagefindMod = await import(/* @vite-ignore */ url);
        URL.revokeObjectURL(url);
        if (pagefindMod.options) pagefindMod.options({ excerptLength: 20 });
      } catch (e) {
        console.error('[PostSearch] Pagefind load failed', e);
        throw e;
      }
    }
    return pagefindMod;
  }

  function clearSearch() {
    kw = '';
    results = [];
    isOpen = false;
    activeIndex = -1;
    inputEl?.focus();
  }

  function onInput() {
    activeIndex = -1;
    if (timer) clearTimeout(timer);
    if (!kw.trim()) {
      results = [];
      isOpen = false;
      errorMsg = '';
      return;
    }
    timer = setTimeout(() => doSearch(), 200);
  }

  async function doSearch() {
    const s = ++seq;
    const q = kw.trim();
    if (!q) { results = []; isOpen = false; return; }

    isOpen = true;
    isLoading = true;
    errorMsg = '';

    try {
      const pf = await loadPagefind();
      const res = await pf.search(q);
      const loaded = await Promise.all(res.results.map(r => r.data()));
      if (s !== seq) return;

      let filtered = loaded;
      if (categoryPath) {
        const prefix = categoryPath.startsWith('/') ? categoryPath : '/' + categoryPath;
        filtered = filtered.filter(it => it.url.startsWith(prefix));
      } else if (filterUrls.length > 0) {
        const allowed = new Set(filterUrls);
        filtered = filtered.filter(it => allowed.has(it.url));
      }

      results = filtered;
      activeIndex = -1;
    } catch {
      if (s !== seq) return;
      errorMsg = '搜索索引不可用（请先构建站点）';
    } finally {
      if (s === seq) isLoading = false;
    }
  }

  function onKeydown(e) {
    const n = results.length;
    if (e.key === 'ArrowDown' && n > 0) {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, n - 1);
      scrollActiveIntoView();
    } else if (e.key === 'ArrowUp' && n > 0) {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      scrollActiveIntoView();
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const url = results[activeIndex]?.url;
      if (url) window.location.href = url;
    } else if (e.key === 'Escape') {
      clearSearch();
    }
  }

  function scrollActiveIntoView() {
    requestAnimationFrame(() => {
      const items = dropdownEl?.querySelectorAll('.psd-item');
      if (items?.[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
    });
  }

  function onItemMouseover(index) {
    activeIndex = index;
  }

  function onOutsideClick(e) {
    if (!e.target?.closest?.('.post-search-wrap')) {
      isOpen = false;
    }
  }

  function getTitle(result) {
    return result.meta?.title ||
      decodeURIComponent(result.url.replace(/\/$/, '').split('/').pop() || result.url);
  }

  onMount(() => {
    document.addEventListener('click', onOutsideClick);
    return () => document.removeEventListener('click', onOutsideClick);
  });

  onDestroy(() => {
    if (timer) clearTimeout(timer);
  });
</script>

<div class="post-search-wrap">
  <div class="post-search">
    <svg class="post-search-icon" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M19.4 15a6.4 6.4 0 0 0 1.3-3.8 6.5 6.5 0 1 0-6.5 6.5 6.4 6.4 0 0 0 3.8-1.3l5.3 5.3a.7.7 0 0 0 1-1l-4.9-5.7zM13 19.1a5.1 5.1 0 1 1 5.1-5.1 5.1 5.1 0 0 1-5.1 5.1z"/>
    </svg>
    <input
      bind:this={inputEl}
      bind:value={kw}
      oninput={onInput}
      onfocus={() => { loadPagefind().catch(()=>{}); if (kw.trim()) isOpen = true; }}
      onkeydown={onKeydown}
      type="search"
      class="post-search-input"
      {placeholder}
      autocomplete="off"
      spellcheck="false"
    />
    {#if kw.length > 0}
      <button type="button" class="post-search-clear" aria-label="清空搜索" onclick={clearSearch}>
        <svg class="post-search-clear-icon" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path d="M17.4 16l4.9-4.9a.7.7 0 0 0-1-1L16.4 15l-4.9-4.9a.7.7 0 0 0-1 1l4.9 4.9-4.9 4.9a.7.7 0 0 0 1 1l4.9-4.9 4.9 4.9a.7.7 0 0 0 1-1z"/>
        </svg>
      </button>
    {/if}
    {#if kw.length === 0}
      <kbd class="post-search-kbd" aria-hidden="true">/</kbd>
    {/if}
  </div>

  {#if isOpen}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="post-search-dropdown" bind:this={dropdownEl}>
      {#if isLoading}
        <div class="psd-empty">搜索中…</div>
      {:else if errorMsg}
        <div class="psd-empty">{errorMsg}</div>
      {:else if results.length === 0}
        <div class="psd-empty">没有找到与「{kw}」相关的文章</div>
      {:else}
        {#each results as result, i}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <a
            class="psd-item"
            class:psd-item--active={i === activeIndex}
            href={result.url}
            data-index={i}
            onmouseover={() => onItemMouseover(i)}
            onfocus={() => onItemMouseover(i)}
          >
            <span class="psd-item-title">{getTitle(result)}</span>
            <span class="psd-item-excerpt">{@html result.excerpt}</span>
          </a>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .post-search-wrap {
    position: relative;
  }

  .post-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.1),
      0 4px 16px rgba(0, 0, 0, 0.2);
    transition: box-shadow 0.25s ease, background 0.25s ease;
  }

  .post-search:focus-within {
    background: rgba(255, 255, 255, 0.08);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .post-search-icon {
    width: 15px;
    height: 15px;
    color: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }

  .post-search-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 0.88rem;
  }

  .post-search-input::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }

  .post-search-input::-webkit-search-cancel-button {
    -webkit-appearance: none;
  }

  .post-search-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: color 0.2s ease, background 0.2s ease;
  }

  .post-search-clear:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.2);
  }

  .post-search-clear-icon {
    width: 10px;
    height: 10px;
  }

  .post-search-kbd {
    flex-shrink: 0;
    min-width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.4);
    font-family: inherit;
    font-size: 0.7rem;
    line-height: 1;
  }

  @media (max-width: 768px) {
    .post-search-kbd {
      display: none;
    }
  }

  .post-search-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    max-height: min(520px, 62vh);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: var(--radius);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  .post-search-dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .post-search-dropdown::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .post-search-dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  :global(.psd-item) {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 10px;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  :global(.psd-item:hover),
  :global(.psd-item--active) {
    background: rgba(255, 255, 255, 0.12);
  }

  :global(.psd-item--active) {
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
  }

  :global(.psd-item-title) {
    font-size: 0.9rem;
    font-weight: 600;
    color: #fff;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.psd-item-excerpt) {
    font-size: 0.78rem;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.5);
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  :global(.psd-item-excerpt mark) {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
    border-radius: 3px;
    padding: 0 2px;
  }

  :global(.psd-empty) {
    flex-shrink: 0;
    padding: 20px 12px;
    font-size: 0.76rem;
    color: rgba(255, 255, 255, 0.35);
    text-align: center;
  }
</style>
