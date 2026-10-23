' Kindprozesse der PID im ersten Argument, je Zeile "PID CreationDate" (WMI über cscript; aufgerufen von einzel-sperre.mjs).
Set w = GetObject("winmgmts:")
For Each p In w.ExecQuery("SELECT ProcessId,CreationDate FROM Win32_Process WHERE ParentProcessId = " & CLng(WScript.Arguments(0)))
 WScript.Echo p.ProcessId & " " & p.CreationDate
Next
