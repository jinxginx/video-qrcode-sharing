import express from 'express'
import localtunnel from 'localtunnel'

const router = express.Router()

let tunnel = null
let tunnelUrl = null

// 获取隧道状态
router.get('/status', (req, res) => {
  res.json({
    active: tunnel !== null,
    url: tunnelUrl
  })
})

// 启动隧道
router.post('/start', async (req, res) => {
  if (tunnel) {
    return res.json({ url: tunnelUrl })
  }

  const port = req.app.get('port') || 3000

  try {
    tunnel = await localtunnel({ port })

    tunnelUrl = tunnel.url

    tunnel.on('close', () => {
      tunnel = null
      tunnelUrl = null
    })

    tunnel.on('error', (err) => {
      console.error('隧道错误:', err.message)
      tunnel = null
      tunnelUrl = null
    })

    console.log(`  外网隧道已建立: ${tunnelUrl}`)
    res.json({ url: tunnelUrl })
  } catch (err) {
    res.status(500).json({ error: '隧道启动失败: ' + err.message })
  }
})

// 停止隧道
router.post('/stop', (req, res) => {
  if (tunnel) {
    tunnel.close()
    tunnel = null
    tunnelUrl = null
    console.log('  外网隧道已关闭')
  }
  res.json({ active: false })
})

// 导出获取隧道 URL 的函数
export function getTunnelUrl() {
  return tunnelUrl
}

export default router
