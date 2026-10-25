' SmallTV-Ultra Invisible Background Runner
' Launches companion.py without showing a console window
Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
cmd = "py -3 """ & scriptDir & "\companion.py"""
WshShell.Run cmd, 0, False

