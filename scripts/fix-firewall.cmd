@echo off
chcp 65001 >nul
title 放行 8112 端口

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 需要管理员权限，正在请求提升...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo 正在放行 TCP 8112（域/专用/公用 全部网络）...
netsh advfirewall firewall delete rule name="WT Tactical Map 8112" >nul 2>&1
netsh advfirewall firewall add rule name="WT Tactical Map 8112" dir=in action=allow protocol=TCP localport=8112 profile=any

echo.
echo 完成。换到新 Wi-Fi / 新路由器后如果平板打不开，再运行一次本脚本。
timeout /t 5 >nul
