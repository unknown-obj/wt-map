' start-hidden.vbs —— 静默启动 src\server.js（无控制台窗口）
' 本文件位于 scripts\ 下，项目根目录为其上一级。

Option Explicit

Dim sh, fso, root, q, node
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
q    = Chr(34)
node = FindNode()

sh.CurrentDirectory = root
sh.Run q & node & q & " src\server.js", 0, False

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
