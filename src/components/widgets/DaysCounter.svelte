<!-- DaysCounter.svelte — 数据统计卡片 -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { fetchRepoCount } from '../../assets/js/github';
  import { daysCounterConfig } from '../../data/dayscounter';

  const { label, startDate } = daysCounterConfig;

  let ready = $state(false);
  let days = $state(0);
  let projectsCount = $state(0);
  let projectsLoaded = $state(false);
  let midnightTimer;

  function computeDays() {
    const start = new Date(startDate);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  let yearsLabel = $derived(() => {
    const y = Math.floor(days / 365);
    return days % 365 > 0 ? `${y}年+` : `${y}年`;
  });

  function scheduleMidnightRefresh() {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    midnightTimer = setTimeout(() => {
      days = computeDays();
      scheduleMidnightRefresh();
    }, nextMidnight.getTime() - now.getTime());
  }

  onMount(async () => {
    days = computeDays();
    ready = true;
    scheduleMidnightRefresh();
    try {
      projectsCount = await fetchRepoCount();
    } catch {
      projectsCount = 0;
    } finally {
      projectsLoaded = true;
    }

    return () => {
      clearTimeout(midnightTimer);
    };
  });
</script>

<div class="stats-row">
  <div class="stat-card glass">
    <span class="stat-label">{label}</span>
    {#if ready}
      <span class="stat-value">{days}天</span>
    {:else}
      <span class="stat-value">
        <span class="skeleton" style="display:inline-block;width:60px;height:1em;vertical-align:middle"></span>
      </span>
    {/if}
  </div>
  <div class="stat-card glass">
    <span class="stat-label">经验积累</span>
    {#if ready}
      <span class="stat-value">{yearsLabel()}</span>
    {:else}
      <span class="stat-value">
        <span class="skeleton" style="display:inline-block;width:48px;height:1em;vertical-align:middle"></span>
      </span>
    {/if}
  </div>
  <div class="stat-card glass">
    <span class="stat-label">项目数量</span>
    {#if projectsLoaded}
      <span class="stat-value">{projectsCount}个</span>
    {:else}
      <span class="stat-value">
        <span class="skeleton" style="display:inline-block;width:36px;height:1em;vertical-align:middle"></span>
      </span>
    {/if}
  </div>
</div>

<style>
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
