@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "data\weekly" mkdir "data\weekly"
set "PY=python"
where python >nul 2>&1 || set "PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
echo ===== %date% %time% collect start ===== >> "data\weekly\collect.log"
"%PY%" collect.py --email >> "data\weekly\collect.log" 2>&1
echo ===== %date% %time% collect end (exit %errorlevel%) ===== >> "data\weekly\collect.log"
