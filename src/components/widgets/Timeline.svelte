<!-- Timeline.svelte — 关于页「历程」时间轴（电脑端横向滑动 / 手机端纵向排列）
     用法：<Timeline client:load />（数据在 src/data/timeline.ts） -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { timeline } from '../../data/timeline';

  const items = [...timeline].sort((a, b) => a.date.localeCompare(b.date));

  let viewport: HTMLDivElement | undefined = $state();
  let dragging = $state(false);
  let canPrev = $state(false);
  let canNext = $state(false);
  let railFill = $state(0);

  let pointerId: number | null = null;
  let pointerStart = 0;
  let scrollStart = 0;

  function sync(): void {
    if (!viewport) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    canPrev = viewport.scrollLeft > 1;
    canNext = viewport.scrollLeft < max - 1;
    railFill = Math.min(viewport.scrollWidth, viewport.scrollLeft + viewport.clientWidth);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!viewport || event.pointerType === 'touch') return;
    if (viewport.scrollWidth - viewport.clientWidth < 4) return;
    pointerId = event.pointerId;
    pointerStart = event.clientX;
    scrollStart = viewport.scrollLeft;
    dragging = true;
    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent): void {
    if (!viewport || !dragging || event.pointerId !== pointerId) return;
    viewport.scrollLeft = scrollStart - (event.clientX - pointerStart);
  }

  function stopDrag(): void {
    dragging = false;
    pointerId = null;
  }

  onMount(() => {
    if (!viewport) return;
    const el = viewport;
    sync();
    const frame = requestAnimationFrame(sync);
    const resize = new ResizeObserver(() => sync());
    resize.observe(el);
    if (el.firstElementChild) resize.observe(el.firstElementChild);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  });
</script>

<div class="timeline">
  <div class="timeline-fade timeline-fade--left" class:is-on={canPrev} aria-hidden="true"></div>
  <div class="timeline-fade timeline-fade--right" class:is-on={canNext} aria-hidden="true"></div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="timeline-viewport"
    class:is-dragging={dragging}
    bind:this={viewport}
    role="region"
    aria-label="成长历程，可横向滚动查看更多"
    tabindex="0"
    onscroll={sync}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={stopDrag}
    onpointercancel={stopDrag}
  >
    <ol class="timeline-track" style={`--rail-fill:${railFill}px`}>
      {#each items as item, index (item.date + item.title)}
        {@const year = item.date.slice(0, 4)}
        {@const day = item.date.slice(5).replace('-', '.')}
        <li class="timeline-item" class:is-latest={index === items.length - 1}>
          <time class="item-date" datetime={item.date}>
            <span class="date-year">{year}</span>
            <span class="date-day">{day}</span>
          </time>
          <span class="item-marker" aria-hidden="true">
            <span class="item-node"></span>
          </span>
          <div class="item-card glass hoverable">
            <h3 class="item-title">{item.title}</h3>
            <p class="item-desc">{item.description}</p>
          </div>
        </li>
      {/each}
    </ol>
  </div>
</div>

<style>
  .timeline {
    position: relative;
    width: 100%;
    --fade-width: 56px;
  }

  /* ---- 两端渐隐 ----
   * 铺一层和页面背景完全一致的固定背景，用 mask 渐隐：遮住卡片边缘 = 融入背景。
   * 不能直接把 mask 套在滚动区上——mask 祖先会让卡片里的 backdrop-filter 失效。 */
  .timeline-fade {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 2;
    width: var(--fade-width);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
    background-image:
      linear-gradient(rgba(0, 0, 0, var(--bg-scrim, 0)), rgba(0, 0, 0, var(--bg-scrim, 0))),
      var(--bg-image);
    background-attachment: fixed;
    background-size: max(100%, calc(100lvh * var(--bg-ratio, 1.5))) 100%;
    background-position: center;
    background-repeat: no-repeat;
  }

  .timeline-fade.is-on {
    opacity: 1;
  }

  .timeline-fade--left {
    left: 0;
    mask-image: linear-gradient(to right, #000, transparent);
    -webkit-mask-image: linear-gradient(to right, #000, transparent);
  }

  .timeline-fade--right {
    right: 0;
    mask-image: linear-gradient(to left, #000, transparent);
    -webkit-mask-image: linear-gradient(to left, #000, transparent);
  }

  /* ---- 横向滚动区：内容按滚动区边界自然裁切 ---- */
  .timeline-viewport {
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    -ms-overflow-style: none;
    cursor: grab;
  }

  .timeline-viewport::-webkit-scrollbar {
    display: none;
  }

  .timeline-viewport:focus-visible {
    outline: 1px solid var(--hover-line);
    outline-offset: 4px;
    border-radius: var(--radius-sm);
  }

  .timeline-viewport.is-dragging {
    cursor: grabbing;
    user-select: none;
  }

  /* ---- 轨道：一条贯穿所有节点的线 ---- */
  .timeline-track {
    position: relative;
    display: flex;
    align-items: stretch;
    width: max-content;
    min-width: 100%;
    padding: 2px 0 32px;
  }

  .timeline-track::before,
  .timeline-track::after {
    content: '';
    position: absolute;
    top: 55px;
    left: 0;
    height: 1px;
    pointer-events: none;
  }

  .timeline-track::before {
    right: 0;
    background: linear-gradient(to right, var(--ring), var(--hover-line) 55%, var(--ring));
  }

  /* 已经划过的部分提亮，给横向滚动一个进度感 */
  .timeline-track::after {
    width: var(--rail-fill, 0px);
    background: linear-gradient(to right, var(--hover-line), var(--white));
    opacity: 0.42;
  }

  .timeline-item {
    position: relative;
    flex: 0 0 272px;
    display: flex;
    flex-direction: column;
    padding-right: 24px;
  }

  .item-date {
    display: flex;
    align-items: baseline;
    gap: 8px;
    height: 44px;
    padding-bottom: 12px;
    font-style: normal;
  }

  .date-year {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--white);
  }

  .date-day {
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    color: var(--ink);
  }

  .item-marker {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    height: 18px;
  }

  .item-node {
    position: relative;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--white);
    box-shadow: 0 0 0 4px var(--rest-bg);
  }

  .is-latest .item-node::after {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 1px solid var(--hover-line);
    animation: node-pulse 2.8s ease-out infinite;
  }

  .item-card {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
    padding: 14px 16px 16px;
  }

  .item-title {
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--white);
    line-height: 1.4;
  }

  .item-desc {
    font-size: 0.76rem;
    line-height: 1.68;
    color: var(--ink);
  }

  @keyframes node-pulse {
    0% {
      transform: scale(0.7);
      opacity: 0.8;
    }
    70%,
    100% {
      transform: scale(1.4);
      opacity: 0;
    }
  }

  /* ---- 手机端：竖排，节点在左侧，跟着页面滚 ---- */
  @media (max-width: 768px) {
    .timeline-fade {
      display: none;
    }
    .timeline-viewport {
      overflow: visible;
      cursor: default;
      padding: 0;
    }

    .timeline-track {
      flex-direction: column;
      width: auto;
      min-width: 0;
      padding: 0;
    }

    .timeline-track::before {
      top: 6px;
      right: auto;
      bottom: 6px;
      left: 6px;
      width: 1px;
      height: auto;
      background: linear-gradient(to bottom, var(--hover-line), var(--ring));
    }

    .timeline-track::after {
      display: none;
    }

    .timeline-item {
      flex: none;
      width: 100%;
      padding: 0 0 20px 26px;
    }

    .timeline-item:last-child {
      padding-bottom: 0;
    }

    .item-date {
      height: auto;
      padding-bottom: 8px;
    }

    .item-marker {
      position: absolute;
      top: 6px;
      left: 0;
      width: 13px;
      height: 13px;
      justify-content: center;
    }

    .item-card {
      flex: none;
      margin-top: 0;
      padding: 12px 14px 14px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .timeline-fade {
      transition: none;
    }

    .is-latest .item-node::after {
      animation: none;
      opacity: 0;
    }
  }
</style>
