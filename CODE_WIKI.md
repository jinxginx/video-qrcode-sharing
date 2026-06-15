# Video QRCode Sharing - Code Wiki

## 1. 项目概述

**项目名称**: video-qrcode-sharing（视频二维码分享）

**项目定位**: 一个轻量级的本地视频分享工具，用户上传视频后生成二维码，扫码即可在手机端播放视频。支持局域网和外网两种访问模式。

**技术栈**:
- 前端: Vue 3 + Vue Router 4 + Vite 6
- 后端: Express 4 + Multer
- 内网穿透: cpolar（国内节点）
- 二维码生成: qrcode

---

## 2. 项目架构

```
video-qrcode-sharing/
├── server/                    # 后端服务
│   ├── index.js              # Express 入口，路由挂载与静态服务
│   ├── routes/
│   │   ├── video.js          # 视频上传/列表/流式播放/删除 API
│   │   ├── qrcode.js         # 二维码生成 API
│   │   └── tunnel.js         # 外网隧道（cpolar）管理 API
│   └── utils/
│       └── network.js        # 获取本机局域网 IP
├── src/                       # 前端源码
│   ├── main.js               # Vue 应用入口
│   ├── App.vue               # 根组件
│   ├── router.js             # 路由配置
│   ├── style.css             # 全局样式
│   ├── views/
│   │   ├── Home.vue          # 主页（上传 + 视频列表 + 隧道开关）
│   │   └── Play.vue          # 视频播放页
│   └── components/
│       ├── VideoUpload.vue   # 视频上传组件（拖拽 + 进度条 + 自动截帧）
│       ├── VideoList.vue     # 视频列表组件（缩略图/重命名/删除）
│       └── QrCodeDialog.vue  # 二维码弹窗组件
├── uploads/                   # 视频文件存储目录（运行时生成）
│   └── thumbs/               # 缩略图存储目录
├── index.html                # HTML 入口
├── vite.config.js            # Vite 配置（开发代理）
├── package.json              # 项目依赖与脚本
└── .gitignore
```

### 架构模式

项目采用 **前后端同仓** 的单体架构：

- **开发模式**: Express (port 3000) 作为主服务，反向代理前端请求到 Vite Dev Server (port 5173)
- **生产模式**: Express 直接服务 `dist/` 目录下的构建产物，无需 Vite 参与

```
浏览器 → Express(:3000) ──┬── /api/*      → 路由处理
                           ├── /uploads/*  → 静态文件服务
                           └── /*          → Vite(:5173) 或 dist/
```

---

## 3. 后端模块详解

### 3.1 入口 - `server/index.js`

| 功能 | 说明 |
|------|------|
| Express 应用初始化 | 端口 3000，监听 `0.0.0.0` |
| CORS | 全局启用 |
| API 路由挂载 | `/api/videos`、`/api/qrcode`、`/api/tunnel` |
| 视频静态服务 | `/uploads` 映射到 `uploads/` 目录 |
| 前端服务 | 生产模式服务 `dist/`，开发模式代理到 Vite |

**关键逻辑**:
- 通过 `fs.existsSync(distPath)` 判断运行模式
- 开发模式使用 `http-proxy-middleware` 代理到 `http://localhost:5173`，超时设为 5 分钟以适应大视频传输

### 3.2 视频路由 - `server/routes/video.js`

**数据存储**: 使用 JSON 文件 `uploads/videos.json` 存储视频元数据（无数据库）

**核心函数**:

| 函数 | 说明 |
|------|------|
| `loadVideos()` | 从 `videos.json` 读取视频列表，文件不存在返回空数组 |
| `saveVideos(videos)` | 将视频列表写回 `videos.json` |

**API 端点**:

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST /` | 上传视频 | multer 处理，文件名用时间戳+随机字符串生成 ID |
| `POST /:id/thumbnail` | 上传缩略图 | 存储为 `thumbs/{id}.jpg` |
| `PUT /:id/rename` | 重命名视频 | 修改 `displayName` 字段 |
| `GET /` | 获取视频列表 | 返回所有视频元数据 |
| `GET /:id` | 获取单个视频信息 | 按 ID 查找 |
| `GET /:id/stream` | 视频流式传输 | **支持 HTTP Range 请求**，实现视频拖动播放 |
| `DELETE /:id` | 删除视频 | 同时删除视频文件和缩略图 |

**视频上传配置**:
- 允许格式: `.mp4`, `.webm`, `.ogg`, `.mov`, `.avi`, `.mkv`
- 文件大小限制: 2GB
- ID 生成: `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`

**流式传输实现**:
- 解析 `Range` 请求头，返回 `206 Partial Content`
- 使用 `fs.createReadStream` 的 `start/end` 参数实现分段读取
- 无 Range 头时返回完整文件（200）

### 3.3 二维码路由 - `server/routes/qrcode.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET /:videoId` | 生成二维码 | 查询参数 `mode=lan\|wan` |

**二维码 URL 生成逻辑**:
- **局域网模式** (`mode=lan`): `http://{本机IP}:{port}/play/{videoId}`
- **外网模式** (`mode=wan`): `{tunnelUrl}/play/{videoId}`（依赖隧道模块）

二维码参数: 宽度 300px，边距 2，输出为 Data URL。

### 3.4 隧道路由 - `server/routes/tunnel.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET /status` | 获取隧道状态 | 返回 `{ active, url }` |
| `POST /start` | 启动隧道 | 调用 `localtunnel({ port })` |
| `POST /stop` | 停止隧道 | 关闭隧道连接 |

**模块级状态**: `tunnel` 和 `tunnelUrl` 为模块内全局变量，维护当前隧道实例。

**导出函数**: `getTunnelUrl()` — 供 `qrcode.js` 获取当前隧道 URL。

### 3.5 网络工具 - `server/utils/network.js`

| 函数 | 说明 |
|------|------|
| `getLocalIP()` | 遍历 `os.networkInterfaces()`，返回第一个非内部 IPv4 地址，兜底 `127.0.0.1` |

---

## 4. 前端模块详解

### 4.1 路由 - `src/router.js`

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `Home.vue` | 主页（上传、列表、二维码） |
| `/play/:id` | `Play.vue` | 视频播放页 |

使用 `createWebHistory`（HTML5 History 模式）。

### 4.2 主页 - `src/views/Home.vue`

**核心状态**:

| 变量 | 类型 | 说明 |
|------|------|------|
| `videos` | `ref([])` | 视频列表 |
| `tunnelActive` | `ref(false)` | 隧道是否开启 |
| `tunnelUrl` | `ref('')` | 隧道外网地址 |
| `dialogVisible` | `ref(false)` | 二维码弹窗是否显示 |
| `currentVideo` | `ref(null)` | 当前选中视频 |

**核心方法**:

| 方法 | 说明 |
|------|------|
| `fetchVideos()` | GET `/api/videos` 获取视频列表 |
| `checkTunnelStatus()` | GET `/api/tunnel/status` 检查隧道状态 |
| `toggleTunnel()` | 开启/关闭外网隧道 |
| `copyTunnelUrl()` | 复制隧道 URL 到剪贴板 |

**组件组合**: `VideoUpload` + `VideoList` + `QrCodeDialog`，通过 props 和 emit 通信。

### 4.3 播放页 - `src/views/Play.vue`

**核心功能**:
- 通过 `route.params.id` 获取视频 ID
- 调用 `/api/videos/{id}` 获取视频信息
- 使用 HTML5 `<video>` 标签播放，源地址为 `/api/videos/{id}/stream`
- 支持 `playsinline`、`webkit-playsinline`、`x5-playsinline`（移动端内联播放）
- 缓冲状态显示（`buffering` + overlay）
- 错误处理与重试

### 4.4 视频上传组件 - `src/components/VideoUpload.vue`

**功能特性**:
- 拖拽上传 + 点击选择文件
- 上传进度条（基于 axios `onUploadProgress`）
- **自动截帧生成缩略图**: 使用 `<video>` + `<canvas>` 截取视频第 1 秒帧，上传到服务端

**核心方法**:

| 方法 | 说明 |
|------|------|
| `uploadFile(file)` | 上传视频 → 截帧 → 上传缩略图 |
| `captureThumbnail(file)` | 创建 video 元素加载文件，seek 到第 1 秒，canvas 截图输出 JPEG blob |

### 4.5 视频列表组件 - `src/components/VideoList.vue`

**功能特性**:
- 视频卡片展示（缩略图 + 名称 + 大小 + 时间）
- 点击缩略图可更换
- 行内重命名（点击编辑图标）
- 删除确认

### 4.6 二维码弹窗组件 - `src/components/QrCodeDialog.vue`

**功能特性**:
- 根据 `wanMode` 生成局域网/外网二维码
- 显示二维码图片 + URL 文本
- 复制 URL + 下载二维码图片

---

## 5. 依赖关系

### 5.1 生产依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `express` | ^4.21.0 | HTTP 服务框架 |
| `multer` | ^1.4.5-lts.2 | 文件上传中间件 |
| `cors` | ^2.8.5 | 跨域支持 |
| `qrcode` | ^1.5.4 | 二维码生成 |
| `localtunnel` | ^2.0.2 | 内网穿透（将本地服务暴露到公网）— **已替换为 cpolar** |
| `http-proxy-middleware` | ^4.1.1 | 开发模式反向代理到 Vite |
| `vue` | ^3.5.0 | 前端框架 |
| `vue-router` | ^4.5.0 | 前端路由 |
| `axios` | ^1.9.0 | HTTP 客户端 |

### 5.2 开发依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `vite` | ^6.3.0 | 前端构建工具 |
| `@vitejs/plugin-vue` | ^5.2.0 | Vite Vue 插件 |
| `concurrently` | ^9.1.0 | 并行运行多个 npm 脚本 |

### 5.3 模块依赖关系

```
server/index.js
  ├── server/routes/video.js
  ├── server/routes/qrcode.js
  │     ├── server/utils/network.js
  │     └── server/routes/tunnel.js (getTunnelUrl)
  ├── server/routes/tunnel.js
│     └── cpolar CLI (child_process)
  └── server/utils/network.js

src/views/Home.vue
  ├── src/components/VideoUpload.vue
  ├── src/components/VideoList.vue
  └── src/components/QrCodeDialog.vue
```

---

## 6. 项目运行方式

### 6.1 安装依赖

```bash
npm install
```

### 6.2 开发模式

```bash
npm run dev
```

等效于并行启动:
- `npm run dev:server` — 启动 Express 后端 (port 3000)
- `npm run dev:client` — 启动 Vite 开发服务器 (port 5173)

开发模式下，Express 作为主入口，前端请求被代理到 Vite。

### 6.3 生产构建与运行

```bash
npm run build    # Vite 构建前端到 dist/
npm run start    # 启动 Express 服务（直接服务 dist/）
```

### 6.4 访问地址

- 本地: `http://localhost:3000`
- 局域网: `http://{本机IP}:3000`

---

## 7. API 接口汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/videos` | 获取视频列表 |
| POST | `/api/videos` | 上传视频 (multipart/form-data, field: `video`) |
| GET | `/api/videos/:id` | 获取视频信息 |
| GET | `/api/videos/:id/stream` | 视频流式播放（支持 Range） |
| POST | `/api/videos/:id/thumbnail` | 上传缩略图 (multipart/form-data, field: `thumbnail`) |
| PUT | `/api/videos/:id/rename` | 重命名视频 (body: `{ displayName }`) |
| DELETE | `/api/videos/:id` | 删除视频 |
| GET | `/api/qrcode/:videoId?mode=lan\|wan` | 生成二维码 |
| GET | `/api/tunnel/status` | 获取隧道状态 |
| POST | `/api/tunnel/start` | 启动外网隧道 |
| POST | `/api/tunnel/stop` | 停止外网隧道 |

---

## 8. 数据模型

### Video 对象

```json
{
  "id": "m1abc2def3",           // 唯一ID（时间戳+随机字符串的36进制）
  "filename": "m1abc2def3.mp4", // 存储文件名
  "originalName": "demo.mp4",   // 原始文件名
  "displayName": "演示视频",     // 显示名称（可修改）
  "size": 104857600,            // 文件大小（字节）
  "mimetype": "video/mp4",      // MIME 类型
  "uploadTime": "2025-01-01T00:00:00.000Z",  // 上传时间（ISO 8601）
  "thumbnail": "/uploads/thumbs/m1abc2def3.jpg"  // 缩略图路径（可为 null）
}
```

---

## 9. 外网访问（内网穿透）机制分析

### 9.1 当前实现

项目使用 **localtunnel** 作为内网穿透方案：

1. 用户在主页点击"开启"外网访问
2. 前端调用 `POST /api/tunnel/start`
3. 后端调用 `localtunnel({ port: 3000 })` 创建隧道
4. localtunnel 返回一个 `https://xxx-xx-xx-xx-xx.loca.lt` 格式的公网 URL
5. 二维码生成时，外网模式使用该 URL 拼接播放路径

### 9.2 中国访问视频失败的原因分析

**核心问题**: localtunnel 的服务器部署在海外，中国网络环境下存在以下障碍：

1. **DNS 污染/解析失败**: `loca.lt` 域名在中国可能被 DNS 污染或无法解析
2. **连接不稳定**: 即使 DNS 解析成功，到 localtunnel 服务器的网络延迟极高，容易超时
3. **视频流传输带宽不足**: 视频播放需要持续稳定的带宽，localtunnel 的海外服务器无法提供足够的带宽
4. **HTTPS 证书问题**: localtunnel 使用自签名证书，某些浏览器会阻止访问
5. **隧道不稳定**: localtunnel 免费版隧道容易断连，每次重启 URL 会变化

### 9.3 可行的替代方案

| 方案 | 说明 | 优势 | 劣势 |
|------|------|------|------|
| **cpolar** | 国内内网穿透服务 | 国内节点，速度快稳定 | 免费版带宽有限 |
| **ngrok (中国版)** | ngrok 中国镜像 | 国内可访问 | 需注册账号 |
| **frp** | 自建内网穿透 | 完全可控，需有公网服务器 | 需要额外服务器 |
| **Cloudflare Tunnel** | Cloudflare 提供的隧道 | 免费、稳定 | 中国部分地区访问不稳定 |
| **花生壳** | 老牌国内内网穿透 | 国内服务稳定 | 免费版限制较多 |
| **替换为直连公网IP** | 服务器有公网 IP 时直接暴露 | 无第三方依赖 | 需要公网 IP |

**推荐方案**: 将 localtunnel 替换为 **cpolar** 或 **frp**，修改 `server/routes/tunnel.js` 中的隧道实现即可，API 接口保持不变。

---

## 10. 关键流程时序

### 10.1 视频上传流程

```
用户拖拽/选择文件
  → VideoUpload.uploadFile()
    → POST /api/videos (multipart, 进度回调)
    → 服务端 multer 保存文件 + 写入 videos.json
    → 返回 video 对象
    → captureThumbnail() 截取视频帧
    → POST /api/videos/{id}/thumbnail
    → emit('uploaded', videoData)
  → Home.onUploaded() 更新视频列表
```

### 10.2 扫码播放流程

```
用户点击"二维码"按钮
  → Home.showQr(video) → 打开 QrCodeDialog
    → QrCodeDialog watch(visible)
      → GET /api/qrcode/{videoId}?mode=lan|wan
        → qrcode.js: 根据 mode 拼接 URL
          → lan: http://{IP}:3000/play/{id}
          → wan: {tunnelUrl}/play/{id}
        → QRCode.toDataURL(url) 生成二维码
      → 返回 { qrCode, url, mode }
  → 手机扫码打开 URL
    → 路由到 Play.vue
      → GET /api/videos/{id} 获取视频信息
      → <video src="/api/videos/{id}/stream"> 播放
```

### 10.3 外网隧道流程

```
用户点击"开启"外网访问
  → Home.toggleTunnel()
    → POST /api/tunnel/start
      → tunnel.js: localtunnel({ port: 3000 })
      → 返回 { url: "https://xxx.loca.lt" }
    → tunnelActive = true
  → 手机扫码时 mode=wan
    → 二维码 URL 使用 tunnelUrl
```
