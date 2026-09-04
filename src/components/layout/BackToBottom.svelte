<!-- BackToBottom.svelte — 到底部按钮 -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import Icon from '@iconify/svelte';

  let isVisible = $state(false);

  function toggleBtn() {
    isVisible = window.scrollY > 100;
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }

  onMount(() => {
    toggleBtn();
    window.addEventListener('scroll', toggleBtn, { passive: true });
    return () => window.removeEventListener('scroll', toggleBtn);
  });
</script>

<button class="back-to-widget" class:visible={isVisible} aria-label="到底部" onclick={scrollToBottom}>
  <Icon icon="la:arrow-down" class="back-to-widget-icon" />
</button>
