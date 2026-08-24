<!-- Clock.svelte — 实时时钟 -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import Icon from '@iconify/svelte';

  let ready = $state(false);
  let now = $state(new Date());
  let time = $state('');
  let date = $state('');
  let timer;
  let raf;

  let hDeg = $state(0);
  let mDeg = $state(0);
  let sDeg = $state(0);

  let hBase = 0;
  let mBase = 0;
  let sBase = 0;

  let prevH = 0;
  let prevM = 0;
  let prevS = 0;

  function hAngle(d) {
    const h = d.getHours() % 12;
    const m = d.getMinutes();
    const s = d.getSeconds();
    return h * 30 + m * 0.5 + s / 120;
  }

  function mAngle(d) {
    return d.getMinutes() * 6 + d.getSeconds() * 0.1;
  }

  function sAngle(d) {
    return d.getSeconds() * 6;
  }

  const EASE_DURATION = 4000;
  let easeStart = 0;
  let easeFromH = 0, easeFromM = 0, easeFromS = 0;
  let easeToH = 0, easeToM = 0, easeToS = 0;
  let easing = false;

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  function loop(ts) {
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
        easing = false;
        hBase = easeToH;
        mBase = easeToM;
        sBase = easeToS;
        prevH = hAngle(now);
        prevM = mAngle(now);
        prevS = sAngle(now);
      }
    }
  }

  function tick() {
    now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    time = `${h}:${m}:${s}`;

    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    date = `${y}/${mo}/${d}`;

    if (ready && !easing) {
      const curH = hAngle(now);
      const curM = mAngle(now);
      const curS = sAngle(now);
      let dh = curH - prevH;
      let dm = curM - prevM;
      let ds = curS - prevS;
      if (dh < -180) dh += 360;
      if (dm < -180) dm += 360;
      if (ds < -180) ds += 360;
      hBase += dh;
      mBase += dm;
      sBase += ds;
      prevH = curH;
      prevM = curM;
      prevS = curS;
      hDeg = hBase;
      mDeg = mBase;
      sDeg = sBase;
    }
  }

  onMount(() => {
    tick();
    prevH = hAngle(now);
    prevM = mAngle(now);
    prevS = sAngle(now);

    const targetH = prevH + 360;
    const targetM = prevM + 540;
    const targetS = prevS + 720;

    easeFromH = hDeg;
    easeFromM = mDeg;
    easeFromS = sDeg;
    easeToH = targetH;
    easeToM = targetM;
    easeToS = targetS;
    easeStart = performance.now();
    easing = true;

    hBase = targetH;
    mBase = targetM;
    sBase = targetS;

    ready = true;
    raf = requestAnimationFrame(loop);
    timer = setInterval(tick, 1000);

    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  });
</script>

<div class="clock-body">
  <svg class="clock-icon" width="100" height="100" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10.8" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.3" />
    <!-- 四个简约刻度 -->
    <line x1="12" y1="2.4" x2="12" y2="3.8" stroke="rgba(255,255,255,0.55)" stroke-width="0.5" stroke-linecap="round" />
    <line x1="21.6" y1="12" x2="20.2" y2="12" stroke="rgba(255,255,255,0.55)" stroke-width="0.5" stroke-linecap="round" />
    <line x1="12" y1="21.6" x2="12" y2="20.2" stroke="rgba(255,255,255,0.55)" stroke-width="0.5" stroke-linecap="round" />
    <line x1="2.4" y1="12" x2="3.8" y2="12" stroke="rgba(255,255,255,0.55)" stroke-width="0.5" stroke-linecap="round" />
    <!-- 时针 -->
    <line x1="12" y1="12.8" x2="12" y2="7.2"
      stroke="rgba(255,255,255,1)" stroke-width="2" stroke-linecap="round"
      style="transform: rotate({hDeg}deg); transform-origin: 12px 12px;" />
    <!-- 分针 -->
    <line x1="12" y1="13.0" x2="12" y2="4.0"
      stroke="rgba(255,255,255,0.7)" stroke-width="1.2" stroke-linecap="round"
      style="transform: rotate({mDeg}deg); transform-origin: 12px 12px;" />
    <!-- 秒针 -->
    <line x1="12" y1="13.3" x2="12" y2="3.5"
      stroke="#ff4d4f" stroke-width="0.5" stroke-linecap="round"
      style="transform: rotate({sDeg}deg); transform-origin: 12px 12px;" />
    <!-- 中心点 -->
    <circle cx="12" cy="12" r="0.7" fill="#ff4d4f" />
  </svg>

  <div class="clock-info">
    {#if ready}
      <span class="clock-time" aria-live="polite">{time}</span>
      <span class="clock-date">{date}</span>
    {:else}
      <div class="skeleton" style="width:150px;font-size:2rem;line-height:1.2;margin-bottom:4px"></div>
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
    color: rgba(255, 255, 255, 0.7);
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
    color: rgba(255, 255, 255, 0.38);
    letter-spacing: 0.02em;
  }
  @media (min-width: 1024px) {
    .clock-time { font-size: 2.2rem; }
  }
</style>