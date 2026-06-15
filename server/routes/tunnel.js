import express from 'express'
import { spawn } from 'child_process'

const router = express.Router()

let cpolarProcess = null
let tunnelUrl = null

// 获取隧道状态
router.get('/status', (req, res) => {
  res.json({
    active: cpolarProcess !== null && !cpolarProcess.killed,
    url: tunnelUrl
  })
})

// 启动隧道
router.post('/start', async (req, res) => {
  if (cpolarProcess && !cpolarProcess.killed) {
    return res.json({ url: tunnelUrl })
  }

  const port = req.app.get('port') || 3000

  try {
    // 启动 cpolar 进程，创建 HTTP 隧道
    cpolarProcess = spawn('cpolar', ['http', String(port)])

    let urlFound = false
    let errorMsg = ''

    const handleOutput = (data) => {
      const output = data.toString()
      // 匹配 Forwarding 行中的 https 地址
      const match = output.match(/Forwarding\s+(https:\/\/\S+)/)
      if (match && !urlFound) {
        urlFound = true
        tunnelUrl = match[1]
      }
      // 捕获错误信息
      if (/error|failed|ERR/i.test(output) && !urlFound) {
        errorMsg += output + ' '
      }
    }

    cpolarProcess.stdout.on('data', handleOutput)
    cpolarProcess.stderr.on('data', handleOutput)

    cpolarProcess.on('close', () => {
      cpolarProcess = null
      tunnelUrl = null
    })

    cpolarProcess.on('error', (err) => {
      if (err.code === 'ENOENT') {
        errorMsg = 'cpolar 未安装，请先安装: curl -L https://www.cpolar.com/static/downloads/install-release-cpolar.sh | sudo bash'
      } else {
        errorMsg = err.message
      }
      cpolarProcess = null
      tunnelUrl = null
    })

    // 等待 URL 出现（最多 15 秒）
    const startTime = Date.now()
    while (!urlFound && cpolarProcess && Date.now() - startTime < 15000) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    if (!urlFound) {
      if (cpolarProcess) {
        cpolarProcess.kill()
        cpolarProcess = null
      }
      if (errorMsg) {
        return res.status(500).json({ error: '隧道启动失败: ' + errorMsg.trim() })
      }
      return res.status(500).json({ error: '隧道启动超时，请确认 cpolar 已安装并配置 authtoken（cpolar authtoken <你的令牌>）' })
    }

    console.log(`  外网隧道已建立(cpolar): ${tunnelUrl}`)
    res.json({ url: tunnelUrl })
  } catch (err) {
    cpolarProcess = null
    tunnelUrl = null
    res.status(500).json({ error: '隧道启动失败: ' + err.message })
  }
})

// 停止隧道
router.post('/stop', (req, res) => {
  if (cpolarProcess) {
    cpolarProcess.kill()
    cpolarProcess = null
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
