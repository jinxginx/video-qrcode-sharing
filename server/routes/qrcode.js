import express from 'express'
import QRCode from 'qrcode'
import { getLocalIP } from '../utils/network.js'
import { getTunnelUrl } from './tunnel.js'

const router = express.Router()

// 生成二维码
router.get('/:videoId', async (req, res) => {
  const { videoId } = req.params
  const mode = req.query.mode || 'lan' // lan 或 wan

  let url
  if (mode === 'wan') {
    // 外网模式：使用隧道 URL
    const tunnelUrl = getTunnelUrl()
    if (!tunnelUrl) {
      return res.status(400).json({ error: '外网隧道未启动，请先开启外网访问' })
    }
    url = `${tunnelUrl}/play/${videoId}`
  } else {
    // 局域网模式：统一使用后端端口（后端已代理前端）
    const ip = getLocalIP()
    const port = req.app.get('port') || 3000
    url = `http://${ip}:${port}/play/${videoId}`
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
    res.json({ qrCode: qrDataUrl, url, mode })
  } catch (err) {
    res.status(500).json({ error: '二维码生成失败' })
  }
})

export default router
