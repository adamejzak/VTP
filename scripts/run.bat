@echo off
REM VTP Application Run Script for Windows
REM Usage: scripts\run.bat [dev|prod]

setlocal enabledelayedexpansion

REM Check if environment is provided
if "%~1"=="" (
    echo [ERROR] Please specify environment: dev or prod
    echo Usage: %0 [dev|prod]
    exit /b 1
)

set ENVIRONMENT=%~1

REM Load versions from root .env if present
set APP_VERSION=
set BACKEND_VERSION=
set FRONTEND_VERSION=
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if /I "%%A"=="APP_VERSION" set APP_VERSION=%%B
        if /I "%%A"=="BACKEND_VERSION" set BACKEND_VERSION=%%B
        if /I "%%A"=="FRONTEND_VERSION" set FRONTEND_VERSION=%%B
    )
)
if "%APP_VERSION%"=="" (
    echo [WARN] APP_VERSION not set. Using default 0.0.0
) else (
    echo [INFO] Using APP_VERSION=%APP_VERSION%
)
if not "%BACKEND_VERSION%"=="" echo [INFO] Using BACKEND_VERSION=%BACKEND_VERSION%
if not "%FRONTEND_VERSION%"=="" echo [INFO] Using FRONTEND_VERSION=%FRONTEND_VERSION%

REM Validate environment
if not "%ENVIRONMENT%"=="dev" if not "%ENVIRONMENT%"=="prod" (
    echo [ERROR] Invalid environment. Use 'dev' or 'prod'
    exit /b 1
)

echo [INFO] Starting VTP application in %ENVIRONMENT% mode...

if "%ENVIRONMENT%"=="dev" (
    echo [INFO] Starting development servers...
    start "VTP Backend Dev" cmd /k "set \"APP_VERSION=%APP_VERSION%\" && set \"BACKEND_VERSION=%BACKEND_VERSION%\" && cd backend && npm run dev"
    ping 127.0.0.1 -n 4 >nul
    start "VTP Frontend Dev" cmd /k "set \"APP_VERSION=%APP_VERSION%\" && set \"FRONTEND_VERSION=%FRONTEND_VERSION%\" && cd frontend && npm run dev"
    echo [SUCCESS] Development servers started in separate windows
    echo [INFO] Backend: http://localhost:8080
    echo [INFO] Frontend: http://localhost:3000
) else (
    echo [INFO] Starting production servers...
    start "VTP Backend Prod" cmd /k "set \"APP_VERSION=%APP_VERSION%\" && set \"BACKEND_VERSION=%BACKEND_VERSION%\" && cd backend && npm start"
    ping 127.0.0.1 -n 4 >nul
    start "VTP Frontend Prod" cmd /k "set \"APP_VERSION=%APP_VERSION%\" && set \"FRONTEND_VERSION=%FRONTEND_VERSION%\" && cd frontend && npm start"
    echo [SUCCESS] Production servers started in separate windows
    echo [INFO] Backend: http://localhost:8080
    echo [INFO] Frontend: http://localhost:3000
)

echo [INFO] Press any key to close this window...
pause >nul
