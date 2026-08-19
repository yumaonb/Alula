<template>
  <div class="clock-body">
    <svg class="clock-icon" width="100" height="100" viewBox="0 0 24 24" fill="none">
      <!-- 背景圆 -->
      <circle cx="12" cy="12" r="10.5" fill="rgba(255,255,255,0.08)" />
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1" />
      <!-- 普通刻度 -->
      <line x1="16" y1="5.072" x2="16.464" y2="3.736" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.45" />
      <line x1="18.928" y1="8" x2="20.017" y2="7.264" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.45" />
      <line x1="18.928" y1="16" x2="20.017" y2="16.736" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.45" />
      <line x1="16" y1="18.928" x2="16.464" y2="20.264" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.45" />
      <line x1="8" y1="18.928" x2="7.536" y2="20.264" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.45" />
      <line x1="5.072" y1="16" x2="3.983" y2="16.736" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.45" />
      <line x1="5.072" y1="8" x2="3.983" y2="7.264" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.45" />
      <line x1="8" y1="5.072" x2="7.536" y2="3.736" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.45" />
      <!-- 12/3/6/9 突出刻度 -->
      <line x1="12" y1="4" x2="12" y2="2.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.7" />
      <line x1="20" y1="12" x2="21.8" y2="12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.7" />
      <line x1="12" y1="20" x2="12" y2="21.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.7" />
      <line x1="4" y1="12" x2="2.2" y2="12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.7" />
      <!-- 时针 -->
      <line :x1="12" :y1="12.8" :x2="12" :y2="5.8"
        stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
        :style="{ transform: `rotate(${hDeg}deg)`, transformOrigin: '12px 12px' }" />
      <!-- 分针 -->
      <line :x1="12" :y1="13.2" :x2="12" :y2="3.8"
        stroke="currentColor" stroke-width="1" stroke-linecap="round"
        :style="{ transform: `rotate(${mDeg}deg)`, transformOrigin: '12px 12px' }" />
      <!-- 秒针 -->
      <line
        :x1="12" :y1="13.5" :x2="12" :y2="3.2"
        stroke="rgba(255,255,255,0.55)" stroke-width="0.6" stroke-linecap="round"
        :style="{ transform: `rotate(${sDeg}deg)`, transformOrigin: '12px 12px' }" />
      <!-- 中心点 -->
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>

    <div class="clock-info">
      <template v-if="ready">
        <span class="clock-time" aria-live="polite">{{ time }}</span>
        <span class="clock-date">{{ date }}</span>
      </template>
      <template v-else>
        <div class="skeleton" style="width:150px;font-size:2rem;line-height:1.2;margin-bottom:4px"></div>
        <div class="skeleton" style="width:90px;font-size:1.05rem"></div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const ready = ref(false);
const now = ref(new Date());
const time = ref("");
const date = ref("");
let timer;
let raf;

const hDeg = ref(0);
const mDeg = ref(0);
const sDeg = ref(0);

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
    hDeg.value = easeFromH + (easeToH - easeFromH) * e;
    mDeg.value = easeFromM + (easeToM - easeFromM) * e;
    sDeg.value = easeFromS + (easeToS - easeFromS) * e;
    if (t < 1) {
      raf = requestAnimationFrame(loop);
    } else {
      easing = false;
      hBase = easeToH;
      mBase = easeToM;
      sBase = easeToS;
      prevH = hAngle(now.value);
      prevM = mAngle(now.value);
      prevS = sAngle(now.value);
    }
  }
}

function tick() {
  now.value = new Date();
  const h = String(now.value.getHours()).padStart(2, "0");
  const m = String(now.value.getMinutes()).padStart(2, "0");
  const s = String(now.value.getSeconds()).padStart(2, "0");
  time.value = `${h}:${m}:${s}`;

  const y = now.value.getFullYear();
  const mo = String(now.value.getMonth() + 1).padStart(2, "0");
  const d = String(now.value.getDate()).padStart(2, "0");
  date.value = `${y}/${mo}/${d}`;

  if (ready.value && !easing) {
    const curH = hAngle(now.value);
    const curM = mAngle(now.value);
    const curS = sAngle(now.value);
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
    hDeg.value = hBase;
    mDeg.value = mBase;
    sDeg.value = sBase;
  }
}

onMounted(() => {
  tick();
  prevH = hAngle(now.value);
  prevM = mAngle(now.value);
  prevS = sAngle(now.value);

  const targetH = prevH + 360;
  const targetM = prevM + 540;
  const targetS = prevS + 720;

  easeFromH = hDeg.value;
  easeFromM = mDeg.value;
  easeFromS = sDeg.value;
  easeToH = targetH;
  easeToM = targetM;
  easeToS = targetS;
  easeStart = performance.now();
  easing = true;

  hBase = targetH;
  mBase = targetM;
  sBase = targetS;

  ready.value = true;
  raf = requestAnimationFrame(loop);
  timer = setInterval(tick, 1000);
});

onUnmounted(() => {
  clearInterval(timer);
  cancelAnimationFrame(raf);
});
</script>

<style scoped>
.clock-body {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 108px;
  overflow: hidden;
}
.clock-icon {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
}
.clock-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.clock-time {
  font-size: 2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  line-height: 1.2;
}
.clock-date {
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.45);
}
@media (min-width: 1024px) {
  .clock-time { font-size: 2.2rem; }
}
</style>