<!-- BackToComments.svelte — 到评论按钮 -->
<script>
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';

  let isVisible = $state(false);
  let isUnavailable = $state(false);
  let settleTimer = null;
  let lastHiddenAt = 0;

  function syncAvailability(hasTarget) {
    const wantUnavailable = !hasTarget;
    if (isUnavailable === wantUnavailable) return;

    const settled = !isVisible && Date.now() - lastHiddenAt > 300;
    if (!settled) {
      if (!settleTimer) {
        settleTimer = setTimeout(() => {
          settleTimer = null;
          toggleBtn();
        }, 400);
      }
      return;
    }
    isUnavailable = wantUnavailable;
  }

  function toggleBtn() {
    const hasTarget = !!document.getElementById('comments-section');
    syncAvailability(hasTarget);

    const wasShown = isVisible;
    isVisible = hasTarget && window.scrollY > 100;
    if (wasShown && !isVisible) lastHiddenAt = Date.now();
  }

  function scrollToComments() {
    const target = document.getElementById('comments-section');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onMount(() => {
    toggleBtn();
    window.addEventListener('scroll', toggleBtn, { passive: true });
    return () => {
      window.removeEventListener('scroll', toggleBtn);
      if (settleTimer) clearTimeout(settleTimer);
    };
  });
</script>

<button
  class="back-to-widget"
  class:visible={isVisible}
  class:unavailable={isUnavailable}
  aria-label="到评论"
  onclick={scrollToComments}
>
  <Icon icon="la:comment" class="back-to-widget-icon" />
</button>
