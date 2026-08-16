<template>
  <!-- 时钟组件 -->
  <div class="clock-body">
    <span class="icon-muted" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
    </span>
    <div class="clock-info">
      <span class="clock-time" aria-live="polite">{{ time }}</span>
      <span class="clock-date">{{ date }}</span>
    </div>
  </div>
</template>

<script setup>
// 每秒更新当前时间
import { ref, onMounted, onUnmounted } from "vue";

const time = ref("--:--:--");
const date = ref("----/--/--");
let timer;

function tick() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  time.value = `${h}:${m}:${s}`;

  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  date.value = `${y}/${mo}/${d}`;
}

onMounted(() => {
  tick();
  timer = setInterval(tick, 1000);
});

onUnmounted(() => {
  clearInterval(timer);
});
</script>

<style scoped>
.clock-body {
  display: flex;
  align-items: center;
  gap: 12px;
}
.clock-info {
  display: flex;
  flex-direction: column;
}
.clock-time {
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  line-height: 1.2;
}
.clock-date {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
}
@media (min-width: 1024px) {
  .clock-time { font-size: 1.5rem; }
}
</style>