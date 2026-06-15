import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createProxyMiddleware } from 'http-proxy-middleware'
import videoRouter from './routes/video.js'
import qrcodeRouter from './routes/qrcode.js'
import tunnelRouter from './routes/tunnel.js'
import { getLocalIP } from './utils/network.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3000

app.set('port', PORT)

app.use(cors())
app.use(express.json())

// API 路由
app.use('/api/videos', videoRouter)
app.use('/api/qrcode', qrcodeRouter)
app.use('/api/tunnel', tunnelRouter)

// 视频文件静态服务
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// 前端服务
const distPath = path.join(__dirname, '..', 'dist')
const distExists = fs.existsSync(distPath)

if (distExists) {
  // 生产模式：直接服务构建产物
  app.use(express.static(distPath))

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API not found' })
    }
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  // 开发模式：代理到 Vite 开发服务器
  app.use('/', createProxyMiddleware({
    target: 'http://localhost:5173',
    changeOrigin: true,
    ws: true,
    proxyTimeout: 300000, // 5分钟超时，适应大视频传输
    timeout: 300000
  }))
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP()
  console.log('')
  console.log('  视频二维码分享服务已启动！')
  console.log('')
  console.log(`  本地访问:   http://localhost:${PORT}`)
  console.log(`  局域网访问: http://${ip}:${PORT}`)
  console.log('')
  console.log('  请在浏览器中打开以上地址上传视频并生成二维码')
  console.log('')
})
