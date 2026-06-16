@echo off
chcp 65001 >nul 2>&1
title 停止视频分享服务

echo ============================================
echo    停止视频二维码分享服务
echo ============================================
echo.

:: 停止后端 (node server/index.js)
echo 正在停止后端服务...
taskkill /fi "WINDOWTITLE eq 视频分享-后端*" /f >nul 2>&1

:: 停止前端 (vite)
echo 正在停止前端服务...
taskkill /fi "WINDOWTITLE eq 视频分享-前端*" /f >nul 2>&1

:: 兜底：按进程名停止
taskkill /im node.exe /f >nul 2>&1

echo.
echo 服务已停止
timeout /t 2 /nobreak >nul
