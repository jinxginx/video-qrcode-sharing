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
| `POST /start` | 启动隧道 | 通过 `child_process.spawn` 启动 `cpolar http {port} -log=stdout -log-level=INFO` |
| `POST /stop` | 停止隧道 | 终止 cpolar 子进程 |

**实现方式**: 通过 `child_process.spawn` 启动 cpolar CLI 进程，解析其 stdout 输出中的 `Tunnel established at https://...` 行提取 https 公网地址。

**cpolar 路径自动查找**: 代码会按以下顺序自动查找 cpolar：
1. 系统 PATH 环境变量（`where cpolar` / `which cpolar`）
2. Windows 常见安装路径（`C:\Program Files\cpolar\cpolar.exe` 等）
3. 降级为 `cpolar`，由系统自行解析

**模块级状态**: `cpolarProcess` 和 `tunnelUrl` 为模块内全局变量，维护当前 cpolar 进程和隧道 URL。

**导出函数**: `getTunnelUrl()` — 供 `qrcode.js` 获取当前隧道 URL。

**前置条件**:
1. 系统需安装 cpolar 并配置 authtoken（详见第 9 节）

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

## 9. 外网访问（内网穿透）机制

### 9.1 当前实现

项目使用 **cpolar**（国内节点）作为内网穿透方案：

1. 用户在主页点击"开启"外网访问
2. 前端调用 `POST /api/tunnel/start`
3. 后端通过 `child_process.spawn` 启动 `cpolar http {port} -log=stdout -log-level=INFO` 进程
4. 解析 cpolar 输出中的 `Tunnel established at https://xxx.cpolar.top` 行，提取公网 URL
5. 二维码生成时，外网模式使用该 URL 拼接播放路径

> **注意**: cpolar 是独立的外部软件，不包含在本项目中。需要用户自行安装和配置。

### 9.2 cpolar 安装

#### Windows

1. 在 [cpolar 官网下载页](https://www.cpolar.com/download) 下载 Windows 64-bit 安装包
2. 解压后双击 `.msi` 安装包，一路默认安装即可
3. 安装完成后，建议将 cpolar 安装目录加入系统 PATH 环境变量，这样项目代码可以自动找到它

#### Linux

```bash
# 一键自动安装
curl -L https://www.cpolar.com/static/downloads/install-release-cpolar.sh | sudo bash
```

#### macOS

```bash
# 通过 Homebrew 安装
brew install cpolar
```

### 9.3 cpolar 配置 authtoken

安装完成后，必须配置认证令牌才能使用：

1. 在 [cpolar 官网](https://www.cpolar.com) 注册账号
2. 登录后进入后台，复制你的 authtoken
3. 在命令行执行：

```bash
cpolar authtoken <你的令牌>
```

配置成功后会提示：`Authtoken saved to configuration file`

> **注意**: authtoken 配置只需执行一次，会保存在本地配置文件中。Windows 默认路径为 `C:\Users\<用户名>\.cpolar\cpolar.yml`

### 9.4 cpolar 使用方式

#### 方式一：项目自动管理（推荐）

直接在项目页面点击"开启外网访问"按钮，后端会自动启动 cpolar 隧道。无需手动操作。

前提：cpolar 已安装且在 PATH 中，或安装在代码能自动查找到的路径。

#### 方式二：Web UI 手动管理

1. 启动 cpolar 客户端服务：
   ```bash
   # 方式 A：安装为系统服务（需管理员权限，开机自启）
   cpolar service install
   cpolar service start

   # 方式 B：前台启动（关闭终端即停止）
   cpolar http 3000 -log=stdout -log-level=INFO
   ```

2. 打开 Web 管理界面：http://localhost:9200
3. 在"隧道管理"中创建、启动、停止隧道
4. 查看分配的公网地址

#### 方式三：命令行手动启动

```bash
# 启动 HTTP 隧道，映射本地 3000 端口
cpolar http 3000 -log=stdout -log-level=INFO

# 启动时指定固定子域名（需付费预留）
cpolar http 3000 -subdomain=your-name -log=stdout -log-level=INFO
```

> **Windows 注意事项**: 在 Windows 上 cpolar 默认不输出日志到控制台，必须添加 `-log=stdout -log-level=INFO` 参数才能捕获输出。项目代码已自动添加此参数。

### 9.5 cpolar vs localtunnel 对比

| 特性 | localtunnel（旧） | cpolar（新） |
|------|-------------------|-------------|
| 服务器位置 | 海外 | 国内（China Top 节点） |
| 中国访问 | DNS 污染、连接不稳定 | 稳定可达 |
| 视频流带宽 | 不足 | 国内节点带宽充足 |
| HTTPS | 自签名证书，浏览器警告 | 正规证书，无警告 |
| 集成方式 | npm 包（Node.js API） | CLI 工具（child_process） |
| 隧道稳定性 | 免费版易断连 | 较稳定 |
| 固定域名 | 不支持 | 支持二级子域名（付费） |
| 是否包含在项目中 | 是（npm 依赖） | 否（需独立安装） |

### 9.6 进阶配置

**固定二级子域名**（避免每次重启 URL 变化）:
1. 登录 [cpolar 官网后台](https://dashboard.cpolar.com)，在"预留"中保留二级子域名
2. 修改 cpolar 配置文件：
   - Windows: `C:\Users\<用户名>\.cpolar\cpolar.yml`
   - Linux/macOS: `/usr/local/etc/cpolar/cpolar.yml` 或 `~/.cpolar/cpolar.yml`
   ```yaml
   authtoken: <你的令牌>
   tunnels:
     video-share:
       proto: http
       addr: "3000"
       subdomain: your-name
       region: cn
   ```
3. 使用 `cpolar start video-share` 启动指定隧道，或 `cpolar start-all` 启动所有配置隧道

### 9.7 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 页面提示"cpolar 未安装" | cpolar 不在 PATH 中 | 将 cpolar 安装目录加入系统环境变量 PATH |
| 隧道启动超时 | 未配置 authtoken | 执行 `cpolar authtoken <令牌>` |
| 手机访问提示无法打开 | URL 末尾有多余字符或使用了 http | 确保使用 https 开头的地址 |
| 浏览器提示证书警告 | cpolar 免费版随机域名 | 点击"继续访问"即可，或使用固定子域名 |
| 每次重启 URL 变化 | 免费版使用随机子域名 | 付费预留固定二级子域名 |

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
      → tunnel.js: 自动查找 cpolar 路径
      → spawn(cpolarPath, ['http', port, '-log=stdout', '-log-level=INFO'])
      → 解析 cpolar 输出中的 "Tunnel established at https://..." 行
      → 返回 { url: "https://xxx.cpolar.top" }
    → tunnelActive = true
  → 手机扫码时 mode=wan
    → 二维码 URL 使用 tunnelUrl
```
