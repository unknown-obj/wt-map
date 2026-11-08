' supervisor.vbs —— 进程守护
' 每 2 秒检查一次 node.exe 是否存在；不存在就静默启动 src\server.js。
' 与 watchdog.ps1 配合：watchdog 保证本脚本活着，本脚本保证 node 活着。

Option Explicit

Dim sh, fso, root, q, node
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
q    = Chr(34)
node = FindNode()

Function FindNode()
    Dim arr, i
    arr = Array("C:\Program Files\nodejs\node.exe", _
                "C:\Program Files (x86)\nodejs\node.exe", _
                "C:\Program Files\nodejs\node64.exe")
    For i = 0 To UBound(arr)
        If fso.FileExists(arr(i)) Then
            FindNode = arr(i)
            Exit Function
        End If
    Next
    FindNode = "node"
End Function

Function NodeRunning()
    Dim col, p
    NodeRunning = False
    On Error Resume Next
    Set col = GetObject("winmgmts:\\.\root\cimv2").ExecQuery("SELECT ProcessId FROM Win32_Process WHERE Name='node.exe'")
    If Err.Number = 0 Then
        For Each p In col
            NodeRunning = True
        Next
    End If
    Err.Clear
    On Error GoTo 0
End Function

Do
    If NodeRunning() Then
        WScript.Sleep 2000
    Else
        sh.CurrentDirectory = root
        sh.Run q & node & q & " src\server.js", 0, False
        WScript.Sleep 3000
    End If
Loop
