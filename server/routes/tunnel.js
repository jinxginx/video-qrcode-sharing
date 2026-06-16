import express from 'express'
import { spawn, execSync } from 'child_process'

const router = express.Router()

// 自动查找 cpolar 路径：优先环境变量，其次常见安装位置
function findCpolarPath() {
  // 1. 直接用 cpolar（依赖 PATH 环境变量）
  try {
    const cmd = process.platform === 'win32' ? 'where cpolar' : 'which cpolar'
    const result = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    if (result) return result.split('\n')[0].trim()
  } catch { /* 未在 PATH 中找到 */ }

  // 2. Windows 常见安装路径
  if (process.platform === 'win32') {
    const commonPaths = [
      'C:\\Program Files\\cpolar\\cpolar.exe',
      'C:\\cpolar\\cpolar.exe',
      process.env.USERPROFILE + '\\cpolar\\cpolar.exe',
      'D:\\cpolar\\cpolar.exe'
    ]
    for (const p of commonPaths) {
      try { execSync(`"${p}" version`, { stdio: 'pipe' }); return p } catch { /* 不存在 */ }
    }
  }

  // 3. 降级为 cpolar，让系统自己找
  return 'cpolar'
}

const CPOLAR_PATH = findCpolarPath()

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
    // Windows 上需要 -log=stdout 才会输出日志，-log-level=INFO 控制日志级别
    const args = ['http', String(port), '-log=stdout', '-log-level=INFO']
    cpolarProcess = spawn(CPOLAR_PATH, args, { shell: true })

    let urlFound = false
    let errorMsg = ''

    const handleOutput = (data) => {
      const output = data.toString()
      // 匹配 cpolar 的实际输出格式：Tunnel established at https://xxx.cpolar.top
      const match = output.match(/Tunnel established at (https:\/\/[^\s"']+)/)
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
        errorMsg = 'cpolar 未安装，请先安装 cpolar'
      } else {
        errorMsg = err.message
      }
      cpolarProcess = null
      tunnelUrl = null
    })

    // 等待 URL 出现（最多 30 秒）
    const startTime = Date.now()
    while (!urlFound && cpolarProcess && Date.now() - startTime < 30000) {
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
