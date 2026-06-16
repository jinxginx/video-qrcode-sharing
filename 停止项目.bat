@echo off
chcp 936 >nul 2>&1
title Stop Services

echo ============================================
echo    Stop Video QR Code Sharing
echo ============================================
echo.

echo Stopping backend...
taskkill /fi "WINDOWTITLE eq Backend*" /f >nul 2>&1

echo Stopping frontend...
taskkill /fi "WINDOWTITLE eq Frontend*" /f >nul 2>&1

echo Stopping node processes...
taskkill /im node.exe /f >nul 2>&1

echo.
echo Services stopped.
timeout /t 2 /nobreak >nul
