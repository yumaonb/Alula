<!-- Clock.svelte — 实时时钟（指针动画 + 时间/日期显示）
     用法：<Clock client:load />（首页 / 关于页） -->
<script lang="ts">
  import { onMount } from 'svelte';

  let ready = $state(false);
  let now = $state(new Date());
  let time = $state('');
  let date = $state('');
  let timer: ReturnType<typeof setInterval> | null = null;
  let raf = 0;

  let hDeg = $state(0);
  let mDeg = $state(0);
  let sDeg = $state(0);

  function hAngle(d: Date): number {
    const h = d.getHours() % 12;
    const m = d.getMinutes();
    const s = d.getSeconds();
    return h * 30 + m * 0.5 + s / 120;
  }

  function mAngle(d: Date): number {
    return d.getMinutes() * 6 + d.getSeconds() * 0.1;
  }

  function sAngle(d: Date): number {
    return d.getSeconds() * 6;
  }

  const EASE_DURATION = 4000;
  let easeStart = 0;
  let easeFromH = 0,
    easeFromM = 0,
    easeFromS = 0;
  let easeToH = 0,
    easeToM = 0,
    easeToS = 0;
  let easing = false;

  function easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 5);
  }

  function loop(ts: number): void {
    if (easing) {
      const elapsed = ts - easeStart;
      const t = Math.min(elapsed / EASE_DURATION, 1);
      const e = easeOut(t);
      hDeg = easeFromH + (easeToH - easeFromH) * e;
      mDeg = easeFromM + (easeToM - easeFromM) * e;
      sDeg = easeFromS + (easeToS - easeFromS) * e;
      if (t < 1) {
        raf = requestAnimationFrame(loop);
      } else {
        // 动画期间时间仍在走，结束时直接对齐当前时间，避免指针永久滞后
        easing = false;
        const d = new Date();
        hDeg = hAngle(d);
        mDeg = mAngle(d);
        sDeg = sAngle(d);
      }
    }
  }

  function tick(): void {
    now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    time = `${h}:${m}:${s}`;

    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    date = `${y}/${mo}/${d}`;

    // 指针角度直接取当前时间，与文本显示同源，不会累积偏差
    if (ready && !easing) {
      hDeg = hAngle(now);
      mDeg = mAngle(now);
      sDeg = sAngle(now);
    }
  }

  onMount(() => {
    tick();

    // 转起都是整圈（360/720/1080），动画结束时朝向正确
    const targetH = hAngle(now) + 360;
    const targetM = mAngle(now) + 720;
    const targetS = sAngle(now) + 1080;

    easeFromH = hDeg;
    easeFromM = mDeg;
    easeFromS = sDeg;
    easeToH = targetH;
    easeToM = targetM;
    easeToS = targetS;
    easeStart = performance.now();
    easing = true;

    ready = true;
    raf = requestAnimationFrame(loop);
    timer = setInterval(tick, 1000);

    // tab 不可见时暂停计时器，节省 CPU
    function onVisibility(): void {
      if (document.hidden) {
        if (timer) clearInterval(timer);
        timer = null;
      } else if (!timer) {
        tick();
        timer = setInterval(tick, 1000);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timer) clearInterval(timer);
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  });
</script>

<div class="clock-body">
  <svg class="clock-icon" width="100" height="100" viewBox="0 0 24 24" fill="none">
    <circle
      cx="12"
      cy="12"
      r="10.8"
      fill="none"
      stroke="rgba(255,255,255,0.15)"
      stroke-width="0.3"
    />
    <line
      x1="12"
      y1="2.4"
      x2="12"
      y2="3.8"
      stroke="rgba(255,255,255,0.55)"
      stroke-width="0.5"
      stroke-linecap="round"
    />
    <line
      x1="21.6"
      y1="12"
      x2="20.2"
      y2="12"
      stroke="rgba(255,255,255,0.55)"
      stroke-width="0.5"
      stroke-linecap="round"
    />
    <line
      x1="12"
      y1="21.6"
      x2="12"
      y2="20.2"
      stroke="rgba(255,255,255,0.55)"
      stroke-width="0.5"
      stroke-linecap="round"
    />
    <line
      x1="2.4"
      y1="12"
      x2="3.8"
      y2="12"
      stroke="rgba(255,255,255,0.55)"
      stroke-width="0.5"
      stroke-linecap="round"
    />
    <line
      x1="12"
      y1="12.8"
      x2="12"
      y2="7.2"
      stroke="rgba(255,255,255,1)"
      stroke-width="2"
      stroke-linecap="round"
      style="transform: rotate({hDeg}deg); transform-origin: 12px 12px;"
    />
    <line
      x1="12"
      y1="13.0"
      x2="12"
      y2="4.0"
      stroke="rgba(255,255,255,0.7)"
      stroke-width="1.2"
      stroke-linecap="round"
      style="transform: rotate({mDeg}deg); transform-origin: 12px 12px;"
    />
    <line
      x1="12"
      y1="13.3"
      x2="12"
      y2="3.5"
      stroke="#ff4d4f"
      stroke-width="0.5"
      stroke-linecap="round"
      style="transform: rotate({sDeg}deg); transform-origin: 12px 12px;"
    />
    <circle cx="12" cy="12" r="0.7" fill="#ff4d4f" />
  </svg>

  <div class="clock-info">
    {#if ready}
      <span class="clock-time" aria-live="polite">{time}</span>
      <span class="clock-date">{date}</span>
    {:else}
      <div
        class="skeleton"
        style="width:150px;font-size:2rem;line-height:1.2;margin-bottom:4px"
      ></div>
      <div class="skeleton" style="width:90px;font-size:1.05rem"></div>
    {/if}
  </div>
</div>

<style>
  .clock-body {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 108px;
    overflow: visible;
  }
  .clock-icon {
    flex-shrink: 0;
    color: var(--icon-ink);
    border-radius: 50%;
    box-shadow:
      0 3px 6px rgba(0, 0, 0, 0.4),
      0 8px 20px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  .clock-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .clock-time {
    font-size: 2rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.06em;
    line-height: 1.2;
    background: linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .clock-date {
    font-size: 1.05rem;
    color: var(--color-text);
    letter-spacing: 0.02em;
  }
  @media (min-width: 1024px) {
    .clock-time {
      font-size: 2.2rem;
    }
  }
</style>
