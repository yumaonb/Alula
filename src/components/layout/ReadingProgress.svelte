<!-- ReadingProgress.svelte — 阅读进度按钮 -->
<script>
  import { onMount, onDestroy } from 'svelte';

  let isVisible = $state(false);
  let percent = $state(0);
  let dashOffset = $state(100);

  function update() {
    isVisible = window.scrollY > 100;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    percent = Math.round(p * 100);
    dashOffset = 100 * (1 - p);
  }

  onMount(() => {
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  });
</script>

<button class="back-to-widget" class:visible={isVisible} aria-label="阅读进度">
  <svg class="progress-ring" viewBox="0 0 54 54" aria-hidden="true">
    <rect class="progress-ring-bg" x="1" y="1" width="52" height="52" rx="5" pathLength="100" />
    <rect
      class="progress-ring-bar"
      x="1" y="1" width="52" height="52" rx="5" pathLength="100"
      style="stroke-dasharray: 100; stroke-dashoffset: {dashOffset}"
    />
  </svg>
  <span class="progress-text">{percent}%</span>
</button>

<style>
  .back-to-widget { overflow: visible; }

  .progress-ring {
    position: absolute;
    inset: -1px;
    width: calc(100% + 2px);
    height: calc(100% + 2px);
    pointer-events: none;
  }

  .progress-ring-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 2;
  }

  .progress-ring-bar {
    fill: none;
    stroke: rgba(255, 255, 255, 0.9);
    stroke-width: 2;
    stroke-linecap: round;
    filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.8));
    transition: stroke-dashoffset 0.1s linear;
  }

  .progress-text {
    font-size: 0.72rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.75);
    font-variant-numeric: tabular-nums;
  }
</style>
