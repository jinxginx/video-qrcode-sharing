import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
const thumbsDir = path.join(uploadsDir, 'thumbs')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true })

// 视频元数据存储
const metaFile = path.join(uploadsDir, 'videos.json')
function loadVideos() {
  if (!fs.existsSync(metaFile)) return []
  try {
    return JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
  } catch {
    return []
  }
}
function saveVideos(videos) {
  fs.writeFileSync(metaFile, JSON.stringify(videos, null, 2))
}

// multer 配置 - 视频
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    cb(null, `${id}${ext}`)
  }
})
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的视频格式'))
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }
})

// multer 配置 - 缩略图
const thumbStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, thumbsDir),
  filename: (req, file, cb) => {
    cb(null, `${req.params.id}.jpg`)
  }
})
const thumbUpload = multer({
  storage: thumbStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的图片格式'))
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

// 上传视频
router.post('/', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择视频文件' })
  }
  const videos = loadVideos()
  const video = {
    id: path.basename(req.file.filename, path.extname(req.file.filename)),
    filename: req.file.filename,
    originalName: req.file.originalname,
    displayName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    uploadTime: new Date().toISOString(),
    thumbnail: null
  }
  videos.push(video)
  saveVideos(videos)
  res.json(video)
})

// 上传/更新缩略图
router.post('/:id/thumbnail', thumbUpload.single('thumbnail'), (req, res) => {
  const videos = loadVideos()
  const video = videos.find(v => v.id === req.params.id)
  if (!video) {
    return res.status(404).json({ error: '视频不存在' })
  }
  video.thumbnail = `/uploads/thumbs/${req.params.id}.jpg`
  saveVideos(videos)
  res.json(video)
})

// 重命名视频
router.put('/:id/rename', (req, res) => {
  const { displayName } = req.body
  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: '名称不能为空' })
  }
  const videos = loadVideos()
  const video = videos.find(v => v.id === req.params.id)
  if (!video) {
    return res.status(404).json({ error: '视频不存在' })
  }
  video.displayName = displayName.trim()
  saveVideos(videos)
  res.json(video)
})

// 获取视频列表
router.get('/', (req, res) => {
  const videos = loadVideos()
  res.json(videos)
})

// 获取单个视频信息
router.get('/:id', (req, res) => {
  const videos = loadVideos()
  const video = videos.find(v => v.id === req.params.id)
  if (!video) {
    return res.status(404).json({ error: '视频不存在' })
  }
  res.json(video)
})

// 视频流式传输（支持 Range 请求）
router.get('/:id/stream', (req, res) => {
  const videos = loadVideos()
  const video = videos.find(v => v.id === req.params.id)
  if (!video) {
    return res.status(404).json({ error: '视频不存在' })
  }

  const filePath = path.join(uploadsDir, video.filename)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '视频文件不存在' })
  }

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const range = req.headers.range

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunkSize = end - start + 1

    const file = fs.createReadStream(filePath, { start, end })
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': video.mimetype || 'video/mp4'
    }

    res.writeHead(206, head)
    file.pipe(res)
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': video.mimetype || 'video/mp4'
    }
    res.writeHead(200, head)
    fs.createReadStream(filePath).pipe(res)
  }
})

// 删除视频
router.delete('/:id', (req, res) => {
  let videos = loadVideos()
  const index = videos.findIndex(v => v.id === req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: '视频不存在' })
  }

  const video = videos[index]
  const filePath = path.join(uploadsDir, video.filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
  // 删除缩略图
  const thumbPath = path.join(thumbsDir, `${video.id}.jpg`)
  if (fs.existsSync(thumbPath)) {
    fs.unlinkSync(thumbPath)
  }

  videos.splice(index, 1)
  saveVideos(videos)
  res.json({ message: '删除成功' })
})

export default router
