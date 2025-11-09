#!/bin/bash

# VTP Application VPS Deployment Script
# Usage: ./scripts/deploy-vps.sh [dev|prod]

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

print_status "Starting VPS deployment for $ENVIRONMENT environment..."

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_warning "This script is designed for Linux VPS. Proceeding anyway..."
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    print_status "Run: curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Docker version: $(docker --version)"
print_status "Docker Compose version: $(docker-compose --version)"

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Pull latest changes if git repository
if [ -d ".git" ]; then
    print_status "Pulling latest changes from git..."
    git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || print_warning "Could not pull from git"
fi

# Build the application
print_status "Building application for $ENVIRONMENT..."
if [ "$ENVIRONMENT" = "dev" ]; then
    ./scripts/build.sh dev
    COMPOSE_FILE="docker-compose.dev.yml"
else
    ./scripts/build.sh prod
    COMPOSE_FILE="docker-compose.yml"
fi

# Build and start Docker containers
print_status "Building and starting Docker containers..."
if [ "$ENVIRONMENT" = "prod" ]; then
    # For production, use the production profile
    docker-compose --profile production up -d --build
else
    # For development
    docker-compose -f docker-compose.dev.yml up -d --build
fi

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 10

# Check service health
print_status "Checking service health..."

# Check backend
if curl -f http://localhost:8080/health >/dev/null 2>&1; then
    print_success "Backend is healthy"
else
    print_warning "Backend health check failed"
fi

# Check frontend
if curl -f http://localhost:3000 >/dev/null 2>&1; then
    print_success "Frontend is healthy"
else
    print_warning "Frontend health check failed"
fi

# Show running containers
print_status "Running containers:"
docker-compose ps

# Show logs
print_status "Recent logs:"
docker-compose logs --tail=20

print_success "Deployment completed!"
print_status "Environment: $ENVIRONMENT"
print_status "Services available at:"
print_status "  - Frontend: http://localhost:3000"
print_status "  - Backend: http://localhost:8080"

if [ "$ENVIRONMENT" = "prod" ]; then
    print_status "Production deployment ready!"
    print_status "To view logs: docker-compose logs -f"
    print_status "To restart: docker-compose restart"
    print_status "To stop: docker-compose down"
else
    print_status "Development deployment ready!"
    print_status "To view logs: docker-compose -f docker-compose.dev.yml logs -f"
    print_status "To restart: docker-compose -f docker-compose.dev.yml restart"
    print_status "To stop: docker-compose -f docker-compose.dev.yml down"
fi




