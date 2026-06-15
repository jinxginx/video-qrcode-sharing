<template>
  <div v-if="visible" class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h2>{{ wanMode ? '外网' : '局域网' }}扫码播放视频</h2>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="dialog-body">
        <div class="qr-wrapper">
          <img v-if="qrData" :src="qrData" alt="二维码" class="qr-image" />
          <div v-else class="qr-loading">生成中...</div>
        </div>
        <p class="qr-tip">{{ wanMode ? '任何网络均可扫码播放' : '请用手机扫描二维码播放视频（需同一局域网）' }}</p>
        <div class="url-row">
          <input class="url-input" :value="url" readonly />
          <button class="btn btn-copy" @click="copyUrl">{{ copied ? '已复制' : '复制' }}</button>
        </div>
        <div class="dialog-footer">
          <a v-if="qrData" :href="qrData" download="qrcode.png" class="btn btn-download">下载二维码</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import axios from 'axios'

const props = defineProps({
  visible: { type: Boolean, default: false },
  video: { type: Object, default: null },
  wanMode: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

const qrData = ref('')
const url = ref('')
const copied = ref(false)

watch(() => props.visible, async (val) => {
  if (val && props.video) {
    qrData.value = ''
    url.value = ''
    copied.value = false
    try {
      const mode = props.wanMode ? 'wan' : 'lan'
      const res = await axios.get(`/api/qrcode/${props.video.id}?mode=${mode}`)
      qrData.value = res.data.qrCode
      url.value = res.data.url
    } catch (err) {
      alert(err.response?.data?.error || '二维码生成失败')
    }
  }
})

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(url.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    const input = document.querySelector('.url-input')
    input.select()
    document.execCommand('copy')
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.dialog {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}
.dialog-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}
.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.close-btn:hover {
  color: #374151;
}
.dialog-body {
  padding: 24px;
  text-align: center;
}
.qr-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}
.qr-image {
  width: 240px;
  height: 240px;
  border-radius: 8px;
}
.qr-loading {
  width: 240px;
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  background: #f3f4f6;
  border-radius: 8px;
}
.qr-tip {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 16px;
}
.url-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.url-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  color: #374151;
  background: #f9fafb;
  outline: none;
  min-width: 0;
}
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}
.btn-copy {
  background: #4f46e5;
  color: #fff;
  flex-shrink: 0;
}
.btn-download {
  background: #f3f4f6;
  color: #374151;
}
.dialog-footer {
  text-align: center;
}
</style>
