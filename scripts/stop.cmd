@echo off
chcp 65001 >nul
set PORT=8112
echo 正在停止占用 %PORT% 的进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>nul && echo   已停止 PID %%a
)
echo 完成。
timeout /t 2 >nul
