@echo off
chcp 65001 >nul
cd /d "%~dp0"
call npm run build
call "%~dp0node_modules\.bin\electron.cmd" .
