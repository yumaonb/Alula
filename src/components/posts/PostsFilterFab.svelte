<!-- PostsFilterFab.svelte — 分类与标签悬浮按钮（文章区专属） -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import Icon from '@iconify/svelte';

  let isVisible = $state(false);
  let isUnavailable = $state(false);
  let lastHiddenAt = 0;

  function syncAvailability() {
    isUnavailable = !document.querySelector('.posts-sidebar');
  }

  function updateVisibility() {
    isVisible = window.scrollY > 100;
  }

  function onScroll() {
    updateVisibility();
  }

  onMount(() => {
    syncAvailability();
    updateVisibility();
    window.addEventListener('scroll', onScroll, { passive: true });

    document.addEventListener('swup:content:replace', syncAvailability);
    document.addEventListener('swup:content:replace', updateVisibility);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('swup:content:replace', syncAvailability);
      document.removeEventListener('swup:content:replace', updateVisibility);
    };
  });
</script>

<button
  class="back-to-widget"
  class:visible={isVisible}
  class:unavailable={isUnavailable}
  id="posts-filter-fab"
  aria-label="分类与标签"
  aria-haspopup="dialog"
  aria-expanded="false"
>
  <Icon icon="la:tags" class="back-to-widget-icon" />
</button>

<style>
  @media (min-width: 769px) {
    #posts-filter-fab {
      display: none;
    }
  }
</style>
