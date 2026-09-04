<!-- BackToTop.svelte — 返回顶部按钮 -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import Icon from '@iconify/svelte';

  let isVisible = $state(false);

  function toggleBtn() {
    isVisible = window.scrollY > 100;
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onMount(() => {
    toggleBtn();
    window.addEventListener('scroll', toggleBtn, { passive: true });
    return () => window.removeEventListener('scroll', toggleBtn);
  });
</script>

<button class="back-to-widget" class:visible={isVisible} aria-label="返回顶部" onclick={scrollToTop}>
  <Icon icon="la:arrow-up" class="back-to-widget-icon" />
</button>
