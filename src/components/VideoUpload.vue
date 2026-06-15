<template>
  <div
    class="upload-area"
    :class="{ dragging: isDragging, uploading: uploading }"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="handleDrop"
    @click="triggerFileInput"
  >
    <input
      ref="fileInput"
      type="file"
      accept="video/*"
      style="display: none"
      @change="handleFileSelect"
    />
    <div v-if="!uploading" class="upload-content">
      <div class="upload-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <p class="upload-text">拖拽视频文件到此处，或点击选择文件</p>
      <p class="upload-hint">支持 MP4、WebM、MOV、AVI 等格式，最大 2GB</p>
    </div>
    <div v-else class="upload-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <p class="progress-text">{{ statusText }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const emit = defineEmits(['uploaded'])

const fileInput = ref(null)
const isDragging = ref(false)
const uploading = ref(false)
const progress = ref(0)
const statusText = ref('')

function triggerFileInput() {
  if (!uploading.value) {
    fileInput.value.click()
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (file) uploadFile(file)
}

function handleDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer.files[0]
  if (file) uploadFile(file)
}

// 从视频中截取第一帧作为缩略图
function captureThumbnail(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const url = URL.createObjectURL(file)
    video.src = url

    video.onloadeddata = () => {
      // 跳到第1秒（或视频较短则跳到0.5秒）
      video.currentTime = Math.min(1, video.duration * 0.1)
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 180
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url)
          resolve(blob)
        }, 'image/jpeg', 0.8)
      } catch {
        URL.revokeObjectURL(url)
        resolve(null)
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
  })
}

async function uploadFile(file) {
  uploading.value = true
  progress.value = 0
  statusText.value = '上传中... 0%'

  const formData = new FormData()
  formData.append('video', file)

  try {
    const res = await axios.post('/api/videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        progress.value = Math.round((e.loaded / e.total) * 100)
        statusText.value = `上传中... ${progress.value}%`
      }
    })

    const videoData = res.data

    // 上传成功后自动截取缩略图
    statusText.value = '生成缩略图...'
    const thumbBlob = await captureThumbnail(file)
    if (thumbBlob) {
      statusText.value = '上传缩略图...'
      const thumbForm = new FormData()
      thumbForm.append('thumbnail', thumbBlob, 'thumbnail.jpg')
      try {
        const thumbRes = await axios.post(`/api/videos/${videoData.id}/thumbnail`, thumbForm, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        emit('uploaded', thumbRes.data)
      } catch {
        // 缩略图上传失败不影响主流程
        emit('uploaded', videoData)
      }
    } else {
      emit('uploaded', videoData)
    }
  } catch (err) {
    alert(err.response?.data?.error || '上传失败')
  } finally {
    uploading.value = false
    progress.value = 0
    statusText.value = ''
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<style scoped>
.upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafbfc;
}
.upload-area:hover,
.upload-area.dragging {
  border-color: #4f46e5;
  background: #eef2ff;
}
.upload-area.uploading {
  cursor: default;
  border-color: #4f46e5;
}
.upload-icon {
  color: #9ca3af;
  margin-bottom: 12px;
}
.upload-area:hover .upload-icon,
.upload-area.dragging .upload-icon {
  color: #4f46e5;
}
.upload-text {
  font-size: 16px;
  color: #374151;
  margin: 0 0 8px;
}
.upload-hint {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}
.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  max-width: 300px;
  margin: 0 auto 12px;
}
.progress-fill {
  height: 100%;
  background: #4f46e5;
  border-radius: 4px;
  transition: width 0.3s;
}
.progress-text {
  font-size: 14px;
  color: #4f46e5;
  margin: 0;
}
</style>
