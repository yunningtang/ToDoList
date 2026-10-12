@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 首次运行，正在安装依赖...
  call npm install
)
if not exist dist (
  echo 正在构建...
  call npm run build
)
start "" /b "%~dp0node_modules\.bin\electron.cmd" .
