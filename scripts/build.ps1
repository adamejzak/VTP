# VTP Application Build Script for PowerShell
# Usage: .\scripts\build.ps1 [dev|prod]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "prod")]
    [string]$Environment
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

Write-Status "Starting VTP application build for $Environment environment..."

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Status "Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js first."
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Status "npm version: $npmVersion"
} catch {
    Write-Error "npm is not installed. Please install npm first."
    exit 1
}

# Create environment-specific .env files if they don't exist
if ($Environment -eq "dev") {
    if (-not (Test-Path "backend\.env.development")) {
        Write-Warning "Creating backend\.env.development from template..."
        if (Test-Path "backend\env.example") {
            Copy-Item "backend\env.example" "backend\.env.development"
        } else {
            Write-Warning "No env.example found in backend"
        }
    }
    
    if (-not (Test-Path "frontend\.env.local")) {
        Write-Warning "Creating frontend\.env.local from template..."
        if (Test-Path "frontend\env.example") {
            Copy-Item "frontend\env.example" "frontend\.env.local"
        } else {
            Write-Warning "No env.example found in frontend"
        }
    }
} else {
    if (-not (Test-Path "backend\.env.production")) {
        Write-Warning "Creating backend\.env.production from template..."
        if (Test-Path "backend\env.example") {
            Copy-Item "backend\env.example" "backend\.env.production"
        } else {
            Write-Warning "No env.example found in backend"
        }
    }
    
    if (-not (Test-Path "frontend\.env.production.local")) {
        Write-Warning "Creating frontend\.env.production.local from template..."
        if (Test-Path "frontend\env.example") {
            Copy-Item "frontend\env.example" "frontend\.env.production.local"
        } else {
            Write-Warning "No env.example found in frontend"
        }
    }
    
    # Check if Clerk keys are configured for production
    if (Test-Path "frontend\.env.production.local") {
        $frontendEnv = Get-Content "frontend\.env.production.local" -Raw
        if ($frontendEnv -match "your_clerk_publishable_key_here") {
            Write-Warning "Clerk keys are not configured in frontend\.env.production.local"
            Write-Warning "Please update the Clerk keys before building for production"
            Write-Warning "You can get your keys at: https://dashboard.clerk.com/last-active?path=api-keys"
        }
    }
}

# Install root dependencies
Write-Status "Installing root dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install root dependencies"
    exit 1
}

# Build backend
Write-Status "Building backend..."
Set-Location backend

if ($Environment -eq "dev") {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install backend dependencies"
        exit 1
    }
    Write-Success "Backend dependencies installed for development"
} else {
    # For production, just install all dependencies and run build
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install backend dependencies"
        exit 1
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build backend"
        exit 1
    }
    Write-Success "Backend built for production"
}

Set-Location ..

# Build frontend
Write-Status "Building frontend..."
Set-Location frontend

if ($Environment -eq "dev") {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install frontend dependencies"
        exit 1
    }
    Write-Success "Frontend dependencies installed for development"
} else {
    # For production, install all dependencies and build
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install frontend dependencies"
        exit 1
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build frontend"
        exit 1
    }
    Write-Success "Frontend built for production"
}

Set-Location ..

# Create build info
$buildTime = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
$buildCommit = try { git rev-parse --short HEAD } catch { "unknown" }

$buildInfo = @{
    environment = $Environment
    buildTime = $buildTime
    commit = $buildCommit
    nodeVersion = $nodeVersion
    npmVersion = $npmVersion
} | ConvertTo-Json

$buildInfo | Out-File -FilePath "build-info.json" -Encoding UTF8

Write-Success "Build completed successfully!"
Write-Status "Environment: $Environment"
Write-Status "Build time: $buildTime"
Write-Status "Commit: $buildCommit"

if ($Environment -eq "prod") {
    Write-Status "Production build ready for deployment"
    Write-Status "You can now run:"
    Write-Status "  - npm run start (to start both services)"
    Write-Status "  - docker-compose up -d (to start with Docker)"
} else {
    Write-Status "Development build ready"
    Write-Status "You can now run:"
    Write-Status "  - npm run dev (to start both services in development mode)"
}
