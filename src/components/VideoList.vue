<template>
  <div class="video-list">
    <div v-if="videos.length === 0" class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <polygon points="10 8 16 12 10 16" fill="#d1d5db" stroke="none" />
      </svg>
      <p>还没有上传视频</p>
    </div>
    <div v-else class="video-grid">
      <div v-for="video in videos" :key="video.id" class="video-card">
        <!-- 缩略图 -->
        <div class="video-thumb" @click="triggerThumbUpload(video.id)">
          <img v-if="video.thumbnail" :src="video.thumbnail" alt="缩略图" class="thumb-img" />
          <svg v-else width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none" />
          </svg>
          <span class="thumb-hint">点击更换</span>
          <input
            :ref="el => thumbInputs[video.id] = el"
            type="file"
            accept="image/*"
            style="display: none"
            @change="(e) => handleThumbSelect(e, video.id)"
          />
        </div>
        <!-- 视频信息 -->
        <div class="video-info">
          <div class="name-row">
            <h3 v-if="editingId !== video.id" class="video-name" :title="video.displayName || video.originalName">
              {{ video.displayName || video.originalName }}
            </h3>
            <input
              v-else
              class="name-input"
              v-model="editName"
              @keyup.enter="saveName(video.id)"
              @keyup.escape="cancelEdit"
              @blur="saveName(video.id)"
              ref="nameInputRef"
            />
            <button v-if="editingId !== video.id" class="btn-icon" @click="startEdit(video)" title="重命名">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
          <p class="video-meta">{{ formatSize(video.size) }} · {{ formatDate(video.uploadTime) }}</p>
        </div>
        <!-- 操作按钮 -->
        <div class="video-actions">
          <button class="btn btn-primary" @click="$emit('showQr', video)">{{ wanMode ? '外网二维码' : '二维码' }}</button>
          <button class="btn btn-danger" @click="handleDelete(video.id)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import axios from 'axios'

const props = defineProps({
  videos: { type: Array, default: () => [] },
  wanMode: { type: Boolean, default: false }
})
const emit = defineEmits(['showQr', 'deleted', 'updated'])

const editingId = ref(null)
const editName = ref('')
const thumbInputs = ref({})

function startEdit(video) {
  editingId.value = video.id
  editName.value = video.displayName || video.originalName
  nextTick(() => {
    const input = document.querySelector('.name-input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

async function saveName(id) {
  const name = editName.value.trim()
  if (!name) {
    cancelEdit()
    return
  }
  try {
    const res = await axios.put(`/api/videos/${id}/rename`, { displayName: name })
    emit('updated', res.data)
  } catch {
    // ignore
  }
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function triggerThumbUpload(id) {
  thumbInputs.value[id]?.click()
}

async function handleThumbSelect(e, id) {
  const file = e.target.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('thumbnail', file)

  try {
    const res = await axios.post(`/api/videos/${id}/thumbnail`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    emit('updated', res.data)
  } catch {
    alert('缩略图上传失败')
  }
  // 清空 input 以便重复选择同一文件
  if (thumbInputs.value[id]) thumbInputs.value[id].value = ''
}

async function handleDelete(id) {
  if (!confirm('确定要删除这个视频吗？')) return
  try {
    await axios.delete(`/api/videos/${id}`)
    emit('deleted', id)
  } catch (err) {
    alert('删除失败')
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('zh-CN')
}
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
}
.empty-state p {
  margin-top: 12px;
  font-size: 15px;
}
.video-grid {
  display: grid;
  gap: 12px;
}
.video-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  transition: box-shadow 0.2s;
}
.video-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.video-thumb {
  width: 100px;
  height: 60px;
  background: #f3f4f6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  flex-shrink: 0;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: opacity 0.2s;
}
.video-thumb:hover {
  opacity: 0.8;
}
.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}
.thumb-hint {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 10px;
  text-align: center;
  padding: 2px 0;
  opacity: 0;
  transition: opacity 0.2s;
}
.video-thumb:hover .thumb-hint {
  opacity: 1;
}
.video-info {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.video-name {
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.name-input {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
  border: 1px solid #4f46e5;
  border-radius: 4px;
  padding: 2px 8px;
  outline: none;
  background: #fff;
}
.btn-icon {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 2px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}
.btn-icon:hover {
  color: #4f46e5;
}
.video-meta {
  font-size: 13px;
  color: #9ca3af;
  margin: 4px 0 0;
}
.video-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn:hover {
  opacity: 0.85;
}
.btn-primary {
  background: #4f46e5;
  color: #fff;
}
.btn-danger {
  background: #fee2e2;
  color: #dc2626;
}

@media (max-width: 600px) {
  .video-card {
    flex-wrap: wrap;
    gap: 10px;
  }
  .video-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
