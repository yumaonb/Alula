<template>
  <!-- 音乐播放器组件，暂时用不了（主要是太难看了），这玩意先仍这，后续大改 -->
  <div class="music-body">
    <div class="music-header">
      <span class="icon-muted" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
      </span>
      <span class="music-title">Music</span>
    </div>
    <p class="music-hint">{{ hint }}</p>
    <div class="music-controls">
      <button class="glass-btn glass-btn--sm" @click="toggle" aria-label="播放/暂停">
        <svg v-if="!playing" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
// 音乐播放器组件：控制音频播放/暂停
import { ref } from "vue";

const playing = ref(false);
const hint = ref("点击播放");
let audio = null;

function toggle() {
  if (!audio) {
    audio = new Audio();
    // TODO: 替换为实际音乐文件路径
    // audio.src = "/music.mp3";
  }
  if (!audio.src) {
    hint.value = "未配置音乐文件";
    return;
  }
  if (audio.paused) {
    audio.play().then(() => {
      playing.value = true;
      hint.value = "播放中";
    }).catch(() => {
      hint.value = "播放失败";
    });
  } else {
    audio.pause();
    playing.value = false;
    hint.value = "已暂停";
  }
}
</script>

<style scoped>
.music-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.music-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.music-title {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.45);
}
.music-hint {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}
</style>