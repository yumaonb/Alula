<template>
  <!-- 天数统计组件 -->
  <div class="stats-group">
    <div class="stat-card glass">
      <span class="stat-label">入坑全栈</span>
      <span v-if="ready" class="stat-value">{{ days }}天</span>
      <span v-else class="stat-value"><span class="skeleton" style="display:inline-block;width:60px;height:1em;vertical-align:middle"></span></span>
    </div>
    <div class="stat-card glass">
      <span class="stat-label">经验积累</span>
      <span v-if="ready" class="stat-value">{{ yearsLabel }}</span>
      <span v-else class="stat-value"><span class="skeleton" style="display:inline-block;width:48px;height:1em;vertical-align:middle"></span></span>
    </div>
  </div>
</template>

<script setup>
// 天数统计组件，按客户端时间计算
import { ref, computed, onMounted, onUnmounted } from "vue";

const props = defineProps({
  startDate: { type: String, required: true },
});

const ready = ref(false);
const days = ref(0);
let midnightTimer;

function computeDays(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

const yearsLabel = computed(() => {
  const y = Math.floor(days.value / 365);
  return days.value % 365 > 0 ? `${y}年+` : `${y}年`;
});

// 每天零点重新计算，保证不刷新界面也可以更新天数
function scheduleMidnightRefresh() {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0,
  );
  midnightTimer = setTimeout(() => {
    days.value = computeDays(props.startDate);
    scheduleMidnightRefresh();
  }, nextMidnight.getTime() - now.getTime());
}

onMounted(() => {
  days.value = computeDays(props.startDate);
  ready.value = true;
  scheduleMidnightRefresh();
});

onUnmounted(() => {
  clearTimeout(midnightTimer);
});
</script>

<style scoped>
.stats-group {
  display: contents;
}
</style>