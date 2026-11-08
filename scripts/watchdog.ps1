# watchdog.ps1 —— 守护脚本
# 用法：任务计划程序每分钟运行一次（用 wscript 包一层以避免黑窗）。
#   1) 确保 supervisor.vbs 在跑（它负责 node 挂了 3 秒内重启）
#   2) 若检测到已授权的安卓设备，确保 adb reverse 隧道存在

$ErrorActionPreference = 'SilentlyContinue'
$here = $PSScriptRoot
$root = Split-Path $here -Parent
$log  = Join-Path $here 'watchdog.log'
$port = 8112
$adb  = Get-Command adb -ErrorAction SilentlyContinue
if ($adb) { $adb = $adb.Source }

function Note($m) {
    $line = (Get-Date -Format 'MM-dd HH:mm:ss') + '  ' + $m
    Add-Content -Path $log -Value $line -Encoding UTF8
    $c = @(Get-Content $log -ErrorAction SilentlyContinue)
    if ($c.Count -gt 200) { $c[-200..-1] | Set-Content $log -Encoding UTF8 }
}

# 1) supervisor 必须在跑
$sup = Get-CimInstance Win32_Process -Filter "Name='wscript.exe'" -ErrorAction SilentlyContinue |
       Where-Object { $_.CommandLine -like '*supervisor.vbs*' }
if (-not $sup) {
    Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine      = 'wscript.exe "' + (Join-Path $here 'supervisor.vbs') + '"'
        CurrentDirectory = $here
    } | Out-Null
    Note 'started supervisor'
    Start-Sleep -Seconds 2
}

# 2) USB 隧道（只在设备存在时）
if (-not $adb) { exit 0 }
$scratch = Join-Path $env:TEMP 'wt-map-adb'
New-Item -ItemType Directory -Force -Path $scratch | Out-Null
$env:TMP = $scratch; $env:TEMP = $scratch

$devs = @()
for ($i = 0; $i -lt 3; $i++) {
    $devs = @(& $adb devices 2>$null | Select-Object -Skip 1 |
              Where-Object { $_ -match '\sdevice' -and $_ -notmatch '^emulator-' })
    if ($devs.Count -gt 0) { break }
    Start-Sleep -Milliseconds 600
}
if ($devs.Count -eq 0) { exit 0 }

$serial = ($devs[0].Trim() -split '\s+')[0]
$rev = (& $adb -s $serial reverse --list 2>$null) -join ' '
if ($rev -notmatch "tcp:$port") {
    & $adb -s $serial reverse "tcp:$port" "tcp:$port" 2>$null | Out-Null
    Note "rebuilt tunnel for $serial"
}
exit 0
