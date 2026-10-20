@echo off
rem Starts the Stellaris Empire Dashboard and opens it in the browser. Close this window to stop it.
rem Options: --lan  also serve other devices on your network (e.g. a tablet as the second screen)
cd /d "%~dp0"
"%~dp0node\node.exe" "%~dp0launcher.mjs" %*
if errorlevel 1 pause
