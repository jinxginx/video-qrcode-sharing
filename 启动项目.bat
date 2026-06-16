@echo off
chcp 65001 >nul 2>&1
title 视频二维码分享服务

echo ============================================
echo    视频二维码分享服务 - 启动脚本
echo ============================================
echo.

:: 切换到脚本所在目录
cd /d "%~dp0"

:: 检查 Node.js 版本
echo [1/3] 检查 Node.js 环境...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18+ 版本
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do (
    set NODE_VER=%%v
)
set NODE_VER=%NODE_VER:v=%

if %NODE_VER% LSS 18 (
    echo [警告] 当前 Node.js 版本过低 (v%NODE_VER%)，尝试切换到 v20...
    :: 尝试通过 nvm 切换版本
    nvm use 20.18.0 >nul 2>&1
    if %errorlevel% neq 0 (
        nvm use 24.13.0 >nul 2>&1
    )
    if %errorlevel% neq 0 (
        echo [错误] Node.js 版本需要 18+，当前版本过低且无法自动切换
        echo 请手动执行: nvm use 20
        pause
        exit /b 1
    )
)

echo [OK] Node.js 版本:
node -v

:: 检查并安装依赖
echo.
echo [2/3] 检查项目依赖...
if not exist "node_modules\" (
    echo 首次运行，正在安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [OK] 依赖已就绪
)

:: 启动服务
echo.
echo [3/3] 启动服务...
echo.
echo ============================================
echo    前端地址: http://localhost:5173
echo    后端地址: http://localhost:3000
echo ============================================
echo.
echo 按 Ctrl+C 停止服务，关闭此窗口也将停止服务
echo.

:: 启动后端
start "视频分享-后端" /min cmd /c "node server/index.js"

:: 等待后端启动
timeout /t 2 /nobreak >nul

:: 启动前端
start "视频分享-前端" /min cmd /c "npx vite"

:: 等待前端启动
timeout /t 3 /nobreak >nul

:: 自动打开浏览器
start http://localhost:5173

echo 服务已启动，浏览器即将打开...
echo 关闭此窗口将同时停止前后端服务
echo.
pause
