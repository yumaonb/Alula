<template>
  <!-- ProjectsGrid.vue — 项目展示卡片网格 -->
  <div class="projects-grid">
    <!-- 骨架屏 -->
    <template v-if="loading">
      <div v-for="n in 6" :key="'sk-' + n" class="project-card glass">
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

    <!-- 错误 -->
    <div v-else-if="error" class="error-state glass">
      <p class="error-text">{{ error }}</p>
      <button class="retry-btn" @click="load">重试</button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="repos.length === 0" class="empty-state glass">
      <p class="empty-text">暂无公开仓库</p>
    </div>

    <!-- 卡片 -->
    <template v-else>
      <a
        v-for="repo in repos"
        :key="repo.name"
        :href="repo.html_url"
        class="project-card glass"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div class="card-header">
          <div class="card-header-left">
            <h2 class="card-name">{{ repo.name }}</h2>
          </div>
          <div class="card-header-right">
            <Icon icon="la:github" class="gh-icon" />
          </div>
        </div>
        <p class="card-desc">{{ repo.description || '暂无描述' }}</p>
        <div v-if="repo.topics.length" class="card-topics">
          <span v-for="t in repo.topics" :key="t" class="topic-tag">{{ t }}</span>
        </div>
        <div class="card-footer">
          <span v-if="repo.language" class="stat">
            <span class="lang-dot" :style="{ background: langColors[repo.language] || '#8b8b8b' }"></span>
            {{ repo.language }}
          </span>
          <span class="stat">
            <Icon icon="la:star" class="stat-icon" />
            {{ repo.stargazers_count }}
          </span>
          <span class="stat">
            <Icon icon="la:code-branch" class="stat-icon" />
            {{ repo.forks_count }}
          </span>
          <span class="stat update-time">{{ formatDate(repo.created_at) }}</span>
        </div>
      </a>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { fetchRepos } from '../../assets/js/github.js';

const langColors = {
  // 前端框架
  TypeScript: '#3178c6', JavaScript: '#f1e05a',
  Vue: '#41b883', React: '#61dafb', Svelte: '#ff3e00', Astro: '#ff5a03',
  // 标记 / 样式
  HTML: '#e34c26', CSS: '#563d7c', SCSS: '#c6538c', Sass: '#a53b70', Less: '#1d365d',
  Markdown: '#083fa1', SVG: '#ff9900',
  // 主流语言
  Python: '#3572A5', Go: '#00ADD8', Rust: '#dea584', Java: '#b07219',
  C: '#555555', 'C++': '#f34b7d', 'C#': '#178600', Swift: '#F05138',
  Kotlin: '#A97BFF', Ruby: '#701516', PHP: '#4F5D95', Dart: '#00B4AB',
  Lua: '#000080', Scala: '#c22d40', Shell: '#89e051', Zig: '#ec915c',
  Haskell: '#5e5086', R: '#198CE7', MATLAB: '#e16737',
  'Objective-C': '#438eff', Elixir: '#6e4a7e', Clojure: '#db5855',
  Perl: '#0298c3', Julia: '#a270ba', Nim: '#ffc200', OCaml: '#3be133',
  Groovy: '#4298b8', Tcl: '#e4cc98', Crystal: '#000101', Elm: '#60b5cc',
  PureScript: '#1D222D', CoffeeScript: '#244776', FSharp: '#b845fc',
  Ada: '#02f88c', Fortran: '#4d41b1', Pascal: '#E3F171',
  VHDL: '#adb2cb', Verilog: '#b2b7f8', SystemVerilog: '#DAE1C2',
  Assembly: '#6E4C13', AWK: '#c30e80',
  // JVM / .NET / 其他
  KotlinScript: '#A97BFF', V: '#4f87c4', Nix: '#7e7eff',
  // 配置 / 构建 / 数据
  Makefile: '#427819', CMake: '#DA3434', Meson: '#007800', Dockerfile: '#384d54',
  TOML: '#9c4221', JSON: '#292929', YAML: '#cb171e', XML: '#0060ac',
  PowerShell: '#012456', Batchfile: '#C1F12E', Jupyter: '#F37626',
  'Jupyter Notebook': '#F37626', NASL: '#aaca00',
};

const repos = ref([]);
const loading = ref(true);
const error = ref('');

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    repos.value = await fetchRepos();
  } catch (e) {
    error.value = e.message || '加载项目列表失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.projects-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

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
  transition: opacity 0.2s ease;
}

.project-card:hover { opacity: 0.85; }

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

.card-header-right { flex-shrink: 0; }

.gh-icon { width: 2.3rem; height: 2.3rem; color: rgba(255, 255, 255, 0.55); }

.card-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-desc {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
  padding: 10px 20px 0;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

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
}

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

.stat-icon { width: 0.85em; height: 0.85em; }

.lang-dot { width: 8px; height: 8px; border-radius: 50%; }

.update-time { margin-left: auto; font-size: 0.7rem; opacity: 0.6; }

.skeleton-title { width: 100px; height: 1.05em; border-radius: 4px; }
.skeleton-line { height: 0.85em; margin-bottom: 8px; border-radius: 4px; }
.skeleton-tag { width: 56px; height: 1.4em; border-radius: 20px; }
.skeleton-stat { width: 36px; height: 0.75em; border-radius: 3px; }

.error-state, .empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px 20px;
}
.error-text { font-size: 0.9rem; color: rgba(255, 100, 100, 0.8); margin: 0 0 12px; }
.empty-text { font-size: 0.9rem; color: rgba(255, 255, 255, 0.5); margin: 0; }
.retry-btn {
  padding: 6px 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); cursor: pointer; font-size: 0.8rem;
}

@media (max-width: 768px) {
  .projects-grid { grid-template-columns: 1fr; gap: 16px; }
}
</style>