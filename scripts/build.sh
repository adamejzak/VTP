#!/bin/bash

# VTP Application Build Script
# Usage: ./scripts/build.sh [dev|prod]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment is provided
if [ $# -eq 0 ]; then
    print_error "Please specify environment: dev or prod"
    echo "Usage: $0 [dev|prod]"
    exit 1
fi

ENVIRONMENT=$1

# Validate environment
if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
    print_error "Invalid environment. Use 'dev' or 'prod'"
    exit 1
fi

print_status "Starting VTP application build for $ENVIRONMENT environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Create environment-specific .env files if they don't exist
if [ "$ENVIRONMENT" = "dev" ]; then
    if [ ! -f "backend/.env.development" ]; then
        print_warning "Creating backend/.env.development from template..."
        cp backend/env.example backend/.env.development 2>/dev/null || print_warning "No env.example found in backend"
    fi
    
    if [ ! -f "frontend/.env.local" ]; then
        print_warning "Creating frontend/.env.local from template..."
        cp frontend/env.example frontend/.env.local 2>/dev/null || print_warning "No env.example found in frontend"
    fi
else
    if [ ! -f "backend/.env.production" ]; then
        print_warning "Creating backend/.env.production from template..."
        cp backend/env.example backend/.env.production 2>/dev/null || print_warning "No env.example found in backend"
    fi
    
    if [ ! -f "frontend/.env.production.local" ]; then
        print_warning "Creating frontend/.env.production.local from template..."
        cp frontend/env.example frontend/.env.production.local 2>/dev/null || print_warning "No env.example found in frontend"
    fi
fi

# Install root dependencies
print_status "Installing root dependencies..."
npm install

# Build backend
print_status "Building backend..."
cd backend

if [ "$ENVIRONMENT" = "dev" ]; then
    npm install
    print_success "Backend dependencies installed for development"
else
    npm install
    npm run build
    print_success "Backend built for production"
fi

cd ..

# Build frontend
print_status "Building frontend..."
cd frontend

if [ "$ENVIRONMENT" = "dev" ]; then
    npm install
    print_success "Frontend dependencies installed for development"
else
    npm install
    npm run build
    print_success "Frontend built for production"
fi

cd ..

# Create build info
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUILD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

cat > build-info.json << EOF
{
  "environment": "$ENVIRONMENT",
  "buildTime": "$BUILD_TIME",
  "commit": "$BUILD_COMMIT",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)"
}
EOF

print_success "Build completed successfully!"
print_status "Environment: $ENVIRONMENT"
print_status "Build time: $BUILD_TIME"
print_status "Commit: $BUILD_COMMIT"

if [ "$ENVIRONMENT" = "prod" ]; then
    print_status "Production build ready for deployment"
    print_status "You can now run:"
    print_status "  - npm run start (to start both services)"
    print_status "  - docker-compose up -d (to start with Docker)"
else
    print_status "Development build ready"
    print_status "You can now run:"
    print_status "  - npm run dev (to start both services in development mode)"
fi
