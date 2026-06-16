@echo off
chcp 936 >nul 2>&1
title Video QR Code Sharing

echo ============================================
echo    Video QR Code Sharing - Start
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)

echo [OK] Node.js:
node -v

echo.
echo [2/3] Checking dependencies...
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
) else (
    echo [OK] Dependencies ready
)

echo.
echo [3/3] Starting services...
echo.

start "Backend" cmd /k node server/index.js

echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

start "Frontend" /min cmd /c npx vite --host 0.0.0.0

timeout /t 3 /nobreak >nul

start http://localhost:5173

echo.
echo ============================================
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:3000
echo ============================================
echo.
pause
