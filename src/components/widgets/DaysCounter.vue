<template>
  <!-- DaysCounter.vue — 数据统计卡片 -->
  <!-- 入坑天数和经验为本地计算，项目数量从 GitHub API 动态获取 -->
  <div class="stats-row">
    <div class="stat-card glass">
      <span class="stat-label">入坑全栈</span>
      <span v-if="ready" class="stat-value">{{ days }}天</span>
      <span v-else class="stat-value">
        <span class="skeleton" style="display:inline-block;width:60px;height:1em;vertical-align:middle"></span>
      </span>
    </div>
    <div class="stat-card glass">
      <span class="stat-label">经验积累</span>
      <span v-if="ready" class="stat-value">{{ yearsLabel }}</span>
      <span v-else class="stat-value">
        <span class="skeleton" style="display:inline-block;width:48px;height:1em;vertical-align:middle"></span>
      </span>
    </div>
    <div class="stat-card glass">
      <span class="stat-label">项目数量</span>
      <span v-if="projectsLoaded" class="stat-value">{{ projectsCount }}个</span>
      <span v-else class="stat-value">
        <span class="skeleton" style="display:inline-block;width:36px;height:1em;vertical-align:middle"></span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";

// ========== 配置 ==========
const startDate = "2024-03-23"; // 开始全栈学习日期
const githubUsername = "yumaonb";
// ===========================

const ready = ref(false);
const days = ref(0);
const projectsCount = ref(0);
const projectsLoaded = ref(false);
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

async function fetchProjectsCount() {
  try {
    const res = await fetch(
      `https://api.github.com/users/${githubUsername}/repos?per_page=1&type=public`
    );
    if (!res.ok) throw new Error();
    // 用 Link header 或直接取 public_repos 字段
    const userRes = await fetch(`https://api.github.com/users/${githubUsername}`);
    if (userRes.ok) {
      const userData = await userRes.json();
      projectsCount.value = userData.public_repos || 0;
    }
  } catch {
    projectsCount.value = 0;
  } finally {
    projectsLoaded.value = true;
  }
}

onMounted(() => {
  days.value = computeDays(startDate);
  ready.value = true;
  scheduleMidnightRefresh();
  fetchProjectsCount();
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