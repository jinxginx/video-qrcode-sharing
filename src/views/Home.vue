<template>
  <div class="home">
    <header class="header">
      <h1 class="title">视频二维码分享</h1>
      <p class="subtitle">上传视频，生成二维码，扫码即可播放</p>
    </header>

    <!-- 外网访问开关 -->
    <div class="tunnel-card">
      <div class="tunnel-info">
        <span class="tunnel-label">外网访问</span>
        <span v-if="tunnelActive" class="tunnel-status active">已开启</span>
        <span v-else class="tunnel-status">未开启</span>
      </div>
      <button
        class="tunnel-btn"
        :class="{ active: tunnelActive }"
        @click="toggleTunnel"
        :disabled="tunnelLoading"
      >
        {{ tunnelLoading ? '连接中...' : (tunnelActive ? '关闭' : '开启') }}
      </button>
    </div>
    <div v-if="tunnelActive && tunnelUrl" class="tunnel-url">
      <span>外网地址：{{ tunnelUrl }}</span>
      <button class="btn-copy-small" @click="copyTunnelUrl">{{ tunnelCopied ? '已复制' : '复制' }}</button>
    </div>

    <VideoUpload @uploaded="onUploaded" />
    <VideoList :videos="videos" :wanMode="tunnelActive" @showQr="showQr" @deleted="onDeleted" @updated="onUpdated" />
    <QrCodeDialog :visible="dialogVisible" :video="currentVideo" :wanMode="tunnelActive" @close="dialogVisible = false" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import VideoUpload from '../components/VideoUpload.vue'
import VideoList from '../components/VideoList.vue'
import QrCodeDialog from '../components/QrCodeDialog.vue'

const videos = ref([])
const dialogVisible = ref(false)
const currentVideo = ref(null)
const tunnelActive = ref(false)
const tunnelUrl = ref('')
const tunnelLoading = ref(false)
const tunnelCopied = ref(false)

async function fetchVideos() {
  try {
    const res = await axios.get('/api/videos')
    videos.value = res.data
  } catch {
    // ignore
  }
}

async function checkTunnelStatus() {
  try {
    const res = await axios.get('/api/tunnel/status')
    tunnelActive.value = res.data.active
    tunnelUrl.value = res.data.url || ''
  } catch {
    // ignore
  }
}

async function toggleTunnel() {
  tunnelLoading.value = true
  try {
    if (tunnelActive.value) {
      await axios.post('/api/tunnel/stop')
      tunnelActive.value = false
      tunnelUrl.value = ''
    } else {
      const res = await axios.post('/api/tunnel/start')
      tunnelActive.value = true
      tunnelUrl.value = res.data.url
    }
  } catch (err) {
    alert(err.response?.data?.error || '操作失败')
  } finally {
    tunnelLoading.value = false
  }
}

async function copyTunnelUrl() {
  try {
    await navigator.clipboard.writeText(tunnelUrl.value)
    tunnelCopied.value = true
    setTimeout(() => { tunnelCopied.value = false }, 2000)
  } catch {
    // ignore
  }
}

function onUploaded(video) {
  videos.value.push(video)
}

function onUpdated(updatedVideo) {
  const idx = videos.value.findIndex(v => v.id === updatedVideo.id)
  if (idx !== -1) {
    videos.value[idx] = updatedVideo
  }
}

function onDeleted(id) {
  videos.value = videos.value.filter(v => v.id !== id)
}

function showQr(video) {
  currentVideo.value = video
  dialogVisible.value = true
}

onMounted(() => {
  fetchVideos()
  checkTunnelStatus()
})
</script>

<style scoped>
.home {
  max-width: 680px;
  margin: 0 auto;
  padding: 40px 20px;
}
.header {
  text-align: center;
  margin-bottom: 24px;
}
.title {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px;
}
.subtitle {
  font-size: 15px;
  color: #9ca3af;
  margin: 0;
}
.tunnel-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  margin-bottom: 8px;
}
.tunnel-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tunnel-label {
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
}
.tunnel-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #f3f4f6;
  color: #9ca3af;
}
.tunnel-status.active {
  background: #dcfce7;
  color: #16a34a;
}
.tunnel-btn {
  padding: 6px 18px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.tunnel-btn:hover {
  border-color: #4f46e5;
  color: #4f46e5;
}
.tunnel-btn.active {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}
.tunnel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.tunnel-url {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 13px;
  color: #166534;
  word-break: break-all;
}
.btn-copy-small {
  padding: 2px 10px;
  border: 1px solid #bbf7d0;
  border-radius: 4px;
  background: #fff;
  color: #166534;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.btn-copy-small:hover {
  background: #dcfce7;
}
</style>
