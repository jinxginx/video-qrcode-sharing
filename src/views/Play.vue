<template>
  <div class="play-page">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>
    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button class="btn-retry" @click="fetchVideo">重试</button>
    </div>
    <div v-else class="player-wrapper">
      <div class="video-header">
        <h1 class="video-title">{{ video.displayName || video.originalName }}</h1>
        <p class="video-meta">{{ formatSize(video.size) }}</p>
      </div>
      <div class="video-container">
        <video
          ref="videoEl"
          class="video-player"
          controls
          playsinline
          webkit-playsinline
          x5-playsinline
          preload="metadata"
          :src="`/api/videos/${video.id}/stream`"
          @waiting="buffering = true"
          @playing="buffering = false"
          @canplay="buffering = false"
          @error="onVideoError"
          @loadstart="buffering = true"
        >
          您的浏览器不支持视频播放
        </video>
        <div v-if="buffering" class="buffer-overlay">
          <div class="spinner"></div>
          <p>缓冲中...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const videoEl = ref(null)
const video = ref({})
const loading = ref(true)
const error = ref('')
const buffering = ref(false)

async function fetchVideo() {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get(`/api/videos/${route.params.id}`)
    video.value = res.data
  } catch (err) {
    error.value = err.response?.status === 404 ? '视频不存在' : '加载失败'
  } finally {
    loading.value = false
  }
}

function onVideoError() {
  buffering.value = false
  error.value = '视频播放失败，请检查视频格式是否受支持'
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

onMounted(fetchVideo)
</script>

<style scoped>
.play-page {
  min-height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
}
.loading,
.error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  gap: 16px;
}
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.btn-retry {
  padding: 8px 24px;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.player-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.video-header {
  padding: 12px 16px;
  background: #111;
}
.video-title {
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  margin: 0 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.video-meta {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}
.video-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  position: relative;
}
.video-player {
  width: 100%;
  max-height: 100%;
  outline: none;
}
.buffer-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.6);
  color: #9ca3af;
  gap: 12px;
  pointer-events: none;
}
.buffer-overlay p {
  font-size: 14px;
}
</style>
