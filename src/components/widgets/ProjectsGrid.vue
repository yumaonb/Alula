<template>
  <!-- ProjectsGrid.vue — 项目展示卡片网格 -->
  <!-- 从 GitHub API 拉取公开仓库数据 -->

  <div class="projects-grid">
    <!-- 骨架屏 -->
    <template v-if="loading">
      <div
        v-for="n in 6"
        :key="'sk-' + n"
        class="project-card glass"
      >
        <div class="card-header">
          <div class="card-header-left">
            <div class="skeleton skeleton-title"></div>
          </div>
        </div>
        <div class="card-desc">
          <div class="skeleton skeleton-line" style="width: 90%"></div>
          <div class="skeleton skeleton-line" style="width: 65%"></div>
        </div>
        <div class="card-topics">
          <div class="skeleton skeleton-tag"></div>
          <div class="skeleton skeleton-tag" style="width: 50px"></div>
          <div class="skeleton skeleton-tag" style="width: 40px"></div>
        </div>
        <div class="card-footer">
          <div class="skeleton skeleton-stat"></div>
          <div class="skeleton skeleton-stat" style="width: 28px"></div>
          <div class="skeleton skeleton-stat" style="width: 28px"></div>
          <div class="skeleton skeleton-stat" style="margin-left:auto;width:60px"></div>
        </div>
      </div>
    </template>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error-state glass">
      <p class="error-text">{{ error }}</p>
      <button class="retry-btn" @click="fetchRepos">重试</button>
    </div>

    <!-- 空仓库 -->
    <div v-else-if="repos.length === 0" class="empty-state glass">
      <p class="empty-text">暂无公开仓库</p>
    </div>

    <!-- 正常内容 -->
    <template v-else>
      <a
        v-for="repo in repos"
        :key="repo.name"
        :href="repo.html_url"
        class="project-card glass"
        target="_blank"
        rel="noopener noreferrer"
      >
        <!-- 卡片头部 -->
        <div class="card-header">
          <div class="card-header-left">
            <h2 class="card-name">{{ repo.name }}</h2>
          </div>
          <div class="card-header-right">
            <span class="gh-icon">&#xe906;</span>
          </div>
        </div>

        <!-- 简介 -->
        <p class="card-desc">{{ repo.description || '暂无描述' }}</p>

        <!-- 标签 -->
        <div v-if="repo.topics.length" class="card-topics">
          <span v-for="t in repo.topics" :key="t" class="topic-tag">{{ t }}</span>
        </div>

        <!-- 底部统计 -->
        <div class="card-footer">
          <span v-if="repo.language" class="stat">
            <span
              class="lang-dot"
              :style="{ background: langColors[repo.language] || '#8b8b8b' }"
            ></span>
            {{ repo.language }}
          </span>
          <span class="stat">
            <span class="stat-icon">&#xe818;</span>
            {{ repo.stargazers_count }}
          </span>
          <span class="stat">
            <span class="stat-icon">&#xe908;</span>
            {{ repo.forks_count }}
          </span>
          <span class="stat update-time">{{ formatDate(repo.pushed_at) }}</span>
        </div>
      </a>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const GITHUB_USERNAME = 'yumaonb';
const CACHE_KEY = 'gh_repos_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 小时

// 语言颜色
const langColors = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Vue: '#41b883',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Markdown: '#083fa1',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
};

const repos = ref([]);
const loading = ref(true);
const error = ref('');

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

function mapRepos(data) {
  return data
    .map((r) => ({
      name: r.name,
      description: r.description,
      html_url: r.html_url,
      language: r.language,
      stargazers_count: r.stargazers_count,
      forks_count: r.forks_count,
      topics: r.topics || [],
      pushed_at: r.pushed_at,
    }))
    .sort((a, b) => b.stargazers_count - a.stargazers_count);
}

async function fetchRepos() {
  loading.value = true;
  error.value = '';

  // 尝试读缓存
  const cached = loadCache();
  if (cached) {
    repos.value = mapRepos(cached);
    loading.value = false;
    return;
  }

  try {
    const url = `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=updated`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`GitHub API 请求失败 (${res.status})`);
    }
    const data = await res.json();
    saveCache(data);
    repos.value = mapRepos(data);
  } catch (e) {
    error.value = e.message || '加载项目列表失败';
  } finally {
    loading.value = false;
  }
}

onMounted(fetchRepos);
</script>

<style scoped>
/* ===== 卡片网格：最大 2 列 ===== */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

/* ===== 单张卡片 ===== */
.project-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  padding: 0;
  border-radius: var(--radius);
  text-decoration: none;
  cursor: pointer;
  overflow: hidden;
  position: relative;
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 0.3s ease;
}

.project-card:hover {
  transform: translateY(-6px) scale(1.01);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45),
              inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

/* ===== 卡片头部 ===== */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 0;
  gap: 8px;
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.card-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.gh-icon {
  font-size: 1.6rem;
  color: rgba(255, 255, 255, 0.55);
  flex-shrink: 0;
  font-family: 'laboralgebra-regular';
  font-style: normal;
}

.card-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

/* ===== 简介 ===== */
.card-desc {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
  padding: 10px 20px 0;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

/* ===== 标签 ===== */
.card-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 20px 0;
}

.topic-tag {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 2px 10px;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

/* ===== 底部统计 ===== */
.card-footer {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px 16px;
  margin-top: auto;
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.stat-icon {
  font-family: 'laboralgebra-regular';
  font-style: normal;
  font-size: 0.85em;
  color: inherit;
}

.lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.update-time {
  margin-left: auto;
  font-size: 0.7rem;
  opacity: 0.6;
}

/* ===== 骨架屏样式 ===== */
.skeleton-title {
  width: 100px;
  height: 1.05em;
  border-radius: 4px;
}

.skeleton-line {
  height: 0.85em;
  margin-bottom: 8px;
  border-radius: 4px;
}

.skeleton-tag {
  width: 56px;
  height: 1.4em;
  border-radius: 20px;
}

.skeleton-stat {
  width: 36px;
  height: 0.75em;
  border-radius: 3px;
}

/* ===== 错误状态 ===== */
.error-state,
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px 20px;
  border-radius: var(--radius);
}

.error-text {
  font-size: 0.9rem;
  color: rgba(255, 100, 100, 0.8);
  margin: 0 0 12px;
}

.empty-text {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.retry-btn {
  padding: 6px 20px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.2s, color 0.2s;
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

/* ===== 手机端适配 ===== */
@media (max-width: 768px) {
  .projects-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>