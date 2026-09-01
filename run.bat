@echo off
chcp 65001 >nul
rem 이슈 창발 장치 - 화면 열기. 이 파일을 두 번 눌러 실행합니다.
setlocal
cd /d "%~dp0"
title 이슈 창발 장치

rem ---- 파이썬 찾기 ----------------------------------
set PY=python
%PY% --version >nul 2>nul || set PY=py -3
%PY% --version >nul 2>nul
if errorlevel 1 (
    echo.
    echo   파이썬이 없습니다.
    echo   https://www.python.org/downloads/ 에서 설치한 뒤 이 파일을 다시 실행하세요.
    echo   설치 화면에서 "Add Python to PATH" 를 꼭 켜 주세요.
    echo.
    pause
    exit /b 1
)

%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul
if errorlevel 1 (
    echo.
    echo   파이썬 3.11 이상이 필요합니다. 지금 깔린 판:
    %PY% --version
    echo   https://www.python.org/downloads/ 에서 최신판을 설치해 주세요.
    echo.
    pause
    exit /b 1
)

rem ---- 처음 한 번만: 필요한 꾸러미 설치 --------------
%PY% -c "import yaml, requests, dotenv" >nul 2>nul
if errorlevel 1 (
    echo.
    echo   처음 실행이라 필요한 꾸러미를 설치합니다. 1~2분 걸립니다.
    echo.
    %PY% -m pip install -q -r requirements.txt
    if errorlevel 1 (
        echo.
        echo   설치에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 실행해 주세요.
        echo.
        pause
        exit /b 1
    )
)

rem ---- .env 가 없으면 견본에서 만들어 둔다 -----------
if not exist ".env" if exist ".env.example" copy ".env.example" ".env" >nul

echo.
echo   화면을 엽니다. 브라우저가 곧 열립니다.
echo   멈추려면 이 창에서 Ctrl+C 를 누르거나 창을 닫으세요.
echo.

%PY% -u scripts\serve.py %*

echo.
pause
