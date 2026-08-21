<template>
  <!-- DaysCounter.vue — 数据统计卡片 -->
  <!-- 数据已内聚到组件内，外部直接 <DaysCounter client:visible /> 即可 -->
  <div class="stats-row">
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
    <div class="stat-card glass">
      <span class="stat-label">项目数量</span>
      <span class="stat-value">{{ projectsCount }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";

// ========== 在此修改数据 ==========
const startDate = "2024-03-23"; // 开始全栈学习日期
const projectsCount = "12个";   // 项目个数
// ===================================

const ready = ref(false);
const days = ref(0);
let midnightTimer;

function computeDays(dateStr) {
  const start = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

const yearsLabel = computed(() => {
  const y = Math.floor(days.value / 365);
  return days.value % 365 > 0 ? `${y}年+` : `${y}年`;
});

function scheduleMidnightRefresh() {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(), now.getMonth(), now.getDate() + 1,
    0, 0, 0, 0,
  );
  midnightTimer = setTimeout(() => {
    days.value = computeDays(startDate);
    scheduleMidnightRefresh();
  }, nextMidnight.getTime() - now.getTime());
}

onMounted(() => {
  days.value = computeDays(startDate);
  ready.value = true;
  scheduleMidnightRefresh();
});

onUnmounted(() => {
  clearTimeout(midnightTimer);
});
</script>

<style scoped>
.stats-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.stat-card {
  flex: 1;
  padding: 16px 8px;
  text-align: center;
  border-radius: var(--radius);
}

.stat-label {
  display: block;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 6px;
  white-space: nowrap;
}

.stat-value {
  display: block;
  font-size: 1.35rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
}
</style>