@echo off
rem Double-click to set up (first run) and start Ankobia Wizard.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-wizard.ps1" %*
if errorlevel 1 pause
