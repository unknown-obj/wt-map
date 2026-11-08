@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
title WT Tactical Map

if not defined PORT set PORT=8112
if not defined WT_API_BASE set WT_API_BASE=http://127.0.0.1:8111

where node >nul 2>nul
if errorlevel 1 (
    echo [X] 未找到 Node.js。请先安装 Node.js 18+ 并确保 node 在 PATH 中。
    echo     https://nodejs.org/
    pause
    exit /b 1
)

echo.
echo   WT 战术地图（开源版）
echo   -------------------------------------
echo   本机访问:   http://127.0.0.1:%PORT%/
echo   平板访问:   见下方"平板可访问的地址"
echo   关闭本窗口即停止服务
echo.
node src\server.js
pause
