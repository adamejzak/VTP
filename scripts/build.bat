@echo off
REM VTP Application Build Script for Windows
REM Usage: scripts\build.bat [dev|prod]

setlocal enabledelayedexpansion

REM Check if environment is provided
if "%~1"=="" (
    echo [ERROR] Please specify environment: dev or prod
    echo Usage: %0 [dev|prod]
    exit /b 1
)

set ENVIRONMENT=%~1

REM Validate environment
if not "%ENVIRONMENT%"=="dev" if not "%ENVIRONMENT%"=="prod" (
    echo [ERROR] Invalid environment. Use 'dev' or 'prod'
    exit /b 1
)

echo [INFO] Starting VTP application build for %ENVIRONMENT% environment...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js first.
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed. Please install npm first.
    exit /b 1
)

echo [INFO] Node.js version: 
node --version
echo [INFO] npm version: 
npm --version

REM Create environment-specific .env files if they don't exist
if "%ENVIRONMENT%"=="dev" (
    if not exist "backend\.env.development" (
        echo [WARNING] Creating backend\.env.development from template...
        if exist "backend\env.example" (
            copy "backend\env.example" "backend\.env.development" >nul
        ) else (
            echo [WARNING] No env.example found in backend
        )
    )
    
    if not exist "frontend\.env.local" (
        echo [WARNING] Creating frontend\.env.local from template...
        if exist "frontend\env.example" (
            copy "frontend\env.example" "frontend\.env.local" >nul
        ) else (
            echo [WARNING] No env.example found in frontend
        )
    )
) else (
    if not exist "backend\.env.production" (
        echo [WARNING] Creating backend\.env.production from template...
        if exist "backend\env.example" (
            copy "backend\env.example" "backend\.env.production" >nul
        ) else (
            echo [WARNING] No env.example found in backend
        )
    )
    
    if not exist "frontend\.env.production.local" (
        echo [WARNING] Creating frontend\.env.production.local from template...
        if exist "frontend\env.example" (
            copy "frontend\env.example" "frontend\.env.production.local" >nul
        ) else (
            echo [WARNING] No env.example found in frontend
        )
    )
)

REM Install root dependencies
echo [INFO] Installing root dependencies...
npm install
if errorlevel 1 (
    echo [ERROR] Failed to install root dependencies
    exit /b 1
)

REM Build backend
echo [INFO] Building backend...
cd backend

if "%ENVIRONMENT%"=="dev" (
    npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install backend dependencies
        exit /b 1
    )
    echo [SUCCESS] Backend dependencies installed for development
) else (
    REM For production, just install all dependencies and run build
    npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install backend dependencies
        exit /b 1
    )
    npm run build
    if errorlevel 1 (
        echo [ERROR] Failed to build backend
        exit /b 1
    )
    echo [SUCCESS] Backend built for production
)

cd ..

REM Build frontend
echo [INFO] Building frontend...
cd frontend

if "%ENVIRONMENT%"=="dev" (
    npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies
        exit /b 1
    )
    echo [SUCCESS] Frontend dependencies installed for development
) else (
    REM For production, install all dependencies and build
    npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies
        exit /b 1
    )
    npm run build
    if errorlevel 1 (
        echo [ERROR] Failed to build frontend
        exit /b 1
    )
    echo [SUCCESS] Frontend built for production
)

cd ..

REM Create build info
for /f "tokens=*" %%i in ('powershell -command "Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'"') do set BUILD_TIME=%%i
for /f "tokens=*" %%i in ('git rev-parse --short HEAD 2^>nul') do set BUILD_COMMIT=%%i
if "%BUILD_COMMIT%"=="" set BUILD_COMMIT=unknown

echo {> build-info.json
echo   "environment": "%ENVIRONMENT%",>> build-info.json
echo   "buildTime": "%BUILD_TIME%",>> build-info.json
echo   "commit": "%BUILD_COMMIT%",>> build-info.json
echo   "nodeVersion": ">> build-info.json
node --version >> build-info.json
echo ",>> build-info.json
echo   "npmVersion": ">> build-info.json
npm --version >> build-info.json
echo >> build-info.json
echo }>> build-info.json

echo [SUCCESS] Build completed successfully!
echo [INFO] Environment: %ENVIRONMENT%
echo [INFO] Build time: %BUILD_TIME%
echo [INFO] Commit: %BUILD_COMMIT%

if "%ENVIRONMENT%"=="prod" (
    echo [INFO] Production build ready for deployment
    echo [INFO] You can now run:
    echo [INFO]   - npm run start (to start both services)
    echo [INFO]   - docker-compose up -d (to start with Docker)
) else (
    echo [INFO] Development build ready
    echo [INFO] You can now run:
    echo [INFO]   - npm run dev (to start both services in development mode)
)
