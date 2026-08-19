<template>
  <!-- 这是个被遗弃掉的音乐播放器，还算是比较完善，ui也做了好长时间，但因为版权问题一直不敢用，删了又太可惜，所以就扔这了 -->
  <div :class="['music-player', { playing }]">
    <!-- 上方：封面 + 歌曲信息 -->
    <div class="player-top">
      <div class="cover-disc">
        <img v-if="coverUrl" :src="coverUrl" class="cover-img" alt="封面" />
        <div v-else class="cover-placeholder">♫</div>
      </div>
      <div class="song-meta">
        <p class="song-name">{{ currentSong.name || '加载中...' }}</p>
        <p class="song-artist">{{ currentSong.artist }}</p>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-row">
      <span class="time-text">{{ formatTime(displayTime) }}</span>
      <div
        class="progress-bar"
        :class="{ dragging }"
        ref="barRef"
        @mousedown.prevent="onDragStart"
        @touchstart.prevent="onDragStart"
      >
        <div class="progress-fill" :style="{ width: (dragging ? dragRatio * 100 : progress) + '%' }"></div>
        <div
          class="progress-handle"
          :style="{ left: (dragging ? dragRatio * 100 : progress) + '%' }"
          @mousedown.prevent.stop="onDragStart"
          @touchstart.prevent.stop="onDragStart"
        ></div>
      </div>
      <span class="time-text">{{ formatTime(duration) }}</span>
    </div>

    <!-- 控制按钮 -->
    <div class="controls-row">
      <button v-if="playlist.length > 0" class="ctrl-btn mode-btn" @click="cycleMode" :title="modeLabel">
        <Icon v-if="playMode === 'shuffle'" icon="la:random" />
        <Icon v-else-if="playMode === 'single'" icon="mdi:repeat-once" />
        <Icon v-else icon="la:sync" />
      </button>
      <button class="ctrl-btn" @click="prevSong" title="上一首">
        <Icon icon="la:step-backward" />
      </button>
      <button class="ctrl-btn play-btn" @click="togglePlay" :title="playing ? '暂停' : '播放'">
        <Icon v-if="!playing" icon="la:play" />
        <Icon v-else icon="la:pause" />
      </button>
      <button class="ctrl-btn" @click="nextSong" title="下一首">
        <Icon icon="la:step-forward" />
      </button>
      <button v-if="playlist.length > 0" class="ctrl-btn list-btn" @click="showList = !showList" :title="showList ? '收起列表' : '展开列表'">
        <Icon icon="la:bars" />
      </button>
    </div>

    <!-- 歌曲列表（可展开/收起） -->
    <div v-if="playlist.length > 0 && showList" class="playlist">
      <div
        v-for="(song, i) in playlist"
        :key="song.name"
        class="playlist-item"
        :class="{ active: i === currentIndex }"
        @click="playAt(i)"
      >
        <span class="pl-index">{{ i + 1 }}</span>
        <span class="pl-name">{{ song.name }}</span>
      </div>
    </div>

    <audio
      ref="audioRef"
      :src="currentSong.src"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoaded"
      @ended="onEnded"
      @error="onAudioError"
      preload="none"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'

// 在这里填入歌曲列表
const playlist = reactive([
  { name: '歌曲名', artist: '作者', cover: '/cover.jpg', src: '/song.mp3' },
  // { name: '第二首', artist: '作者2', cover: '/cover2.jpg', src: '/song2.mp3' },
])


const audioRef = ref(null)
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const currentIndex = ref(0)
const showList = ref(false)
const barRef = ref(null)
const dragging = ref(false)
const dragRatio = ref(0)
const suppressTimeUpdate = ref(false)
const playMode = ref('list') // 'list' | 'single' | 'shuffle'

const MODE_ORDER = ['list', 'single', 'shuffle']
const MODE_LABEL = { list: '列表循环', single: '单曲循环', shuffle: '随机播放' }
const modeLabel = computed(() => MODE_LABEL[playMode.value])

function cycleMode() {
  const i = MODE_ORDER.indexOf(playMode.value)
  playMode.value = MODE_ORDER[(i + 1) % MODE_ORDER.length]
}

const currentSong = computed(() => playlist[currentIndex.value] || {})
const coverUrl = computed(() => currentSong.value.cover || '')
const progress = computed(() =>
  duration.value ? (currentTime.value / duration.value) * 100 : 0
)
const displayTime = computed(() =>
  dragging.value ? dragRatio.value * duration.value : currentTime.value
)

function togglePlay() {
  if (!audioRef.value) return
  if (playing.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play().catch(() => {})
  }
  playing.value = !playing.value
}

function prevSong() {
  if (playlist.length === 0) return
  currentIndex.value = (currentIndex.value - 1 + playlist.length) % playlist.length
  resetAndPlay()
}

function nextSong() {
  if (playlist.length === 0) return
  if (playMode.value === 'shuffle') {
    if (playlist.length === 1) {
      currentIndex.value = 0
    } else {
      let next
      do { next = Math.floor(Math.random() * playlist.length) } while (next === currentIndex.value)
      currentIndex.value = next
    }
  } else {
    currentIndex.value = (currentIndex.value + 1) % playlist.length
  }
  resetAndPlay()
}

function playAt(i) {
  currentIndex.value = i
  resetAndPlay()
}

function resetAndPlay() {
  currentTime.value = 0
  playing.value = false
  if (!audioRef.value) return
  const audio = audioRef.value
  audio.currentTime = 0
  if (audio.readyState >= 2) {
    audio.play().then(() => { playing.value = true }).catch(() => {})
  } else {
    const onReady = () => {
      audio.removeEventListener('canplay', onReady)
      audio.play().then(() => { playing.value = true }).catch(() => {})
    }
    audio.addEventListener('canplay', onReady)
  }
}

function getBarRatio(e) {
  if (!barRef.value) return 0
  const rect = barRef.value.getBoundingClientRect()
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

function onDragStart(e) {
  if (!duration.value) return
  dragging.value = true
  dragRatio.value = getBarRatio(e)
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  document.addEventListener('touchmove', onDragMove, { passive: false })
  document.addEventListener('touchend', onDragEnd)
}

function onDragMove(e) {
  if (!dragging.value) return
  e.preventDefault()
  dragRatio.value = getBarRatio(e)
}

function onDragEnd() {
  if (!dragging.value) return
  dragging.value = false
  const targetTime = dragRatio.value * duration.value
  currentTime.value = targetTime
  suppressTimeUpdate.value = true
  setTimeout(() => { suppressTimeUpdate.value = false }, 300)
  if (audioRef.value && duration.value) {
    audioRef.value.currentTime = targetTime
  }
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.removeEventListener('touchmove', onDragMove)
  document.removeEventListener('touchend', onDragEnd)
}

function onTimeUpdate() {
  if (!audioRef.value || suppressTimeUpdate.value) return
  currentTime.value = audioRef.value.currentTime
  const d = audioRef.value.duration
  if (d && isFinite(d) && d !== duration.value) duration.value = d
}

function onLoaded() {
  if (audioRef.value) {
    const d = audioRef.value.duration
    if (d && isFinite(d)) duration.value = d
  }
}

function onAudioError() {
  duration.value = 0
  currentTime.value = 0
  playing.value = false
}

function onEnded() {
  if (playMode.value === 'single') {
    resetAndPlay()
  } else {
    nextSong()
  }
}

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.removeEventListener('touchmove', onDragMove)
  document.removeEventListener('touchend', onDragEnd)
})
</script>

<style scoped>
.music-player {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 上方：封面 + 歌曲信息 */
.player-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 封面圆盘 */
.cover-disc {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  animation: spin 12s linear infinite;
  animation-play-state: paused;
}

.music-player.playing .cover-disc {
  animation-play-state: running;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  font-size: 1.3rem;
  color: rgba(255, 255, 255, 0.25);
}

/* 歌曲信息 */
.song-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.song-name {
  font-size: 0.92rem;
  color: rgba(255, 255, 255, 0.88);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Noto Sans SC', sans-serif;
  font-weight: 600;
}

.song-artist {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Noto Sans SC', sans-serif;
}

/* 播放进度条 */
.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  position: relative;
  flex: 1;
  height: 3px;
  cursor: pointer;
  padding: 10px 0;
  margin: -10px 0;
  touch-action: none;
}

.progress-bar::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  pointer-events: none;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 3px;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 2px;
  pointer-events: none;
  z-index: 1;
}

.progress-handle {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.15s ease;
  pointer-events: none;
  z-index: 2;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}

.progress-bar:hover .progress-handle,
.progress-bar.dragging .progress-handle {
  transform: translate(-50%, -50%) scale(1);
}

.progress-bar:hover .progress-fill {
  background: rgba(255, 255, 255, 0.75);
}

.progress-bar.dragging .progress-fill {
  background: rgba(255, 255, 255, 0.85);
  transition: none;
}

.progress-bar.dragging .progress-handle {
  transform: translate(-50%, -50%) scale(1.3);
  transition: none;
}

@media (hover: none) and (pointer: coarse) {
  .progress-handle {
    transform: translate(-50%, -50%) scale(1);
  }
  .progress-fill {
    height: 4px;
  }
}

.time-text {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.28);
  flex-shrink: 0;
  min-width: 28px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* 控制按钮 */
.controls-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.ctrl-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, background 0.2s;
  padding: 0;
  line-height: 1;
}

.ctrl-btn svg {
  width: 16px;
  height: 16px;
}

.ctrl-btn:hover {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.08);
}

.play-btn {
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
}

.play-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.5);
}

.list-btn {
  margin-left: 8px;
}

.mode-btn {
  margin-right: 8px;
}

/* 歌曲列表 */
.playlist {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 120px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.playlist::-webkit-scrollbar {
  width: 3px;
}
.playlist::-webkit-scrollbar-track {
  background: transparent;
}
.playlist::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.2s;
}

.playlist-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.playlist-item.active {
  background: rgba(255, 255, 255, 0.1);
}

.pl-index {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.25);
  min-width: 14px;
  text-align: center;
}

.playlist-item.active .pl-index {
  color: rgba(255, 255, 255, 0.6);
}

.pl-name {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Noto Sans SC', sans-serif;
}

.playlist-item.active .pl-name {
  color: rgba(255, 255, 255, 0.85);
}

audio {
  display: none;
}
</style>