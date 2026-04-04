@ECHO off
SET PATH=%PATH%;C:\Program Files\nodejs
"C:\Program Files\nodejs\node.exe" "%~dp0node_modules\next\dist\bin\next" dev --port 3002
