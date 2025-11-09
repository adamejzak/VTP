#!/bin/bash

# VTP Application VPS Setup Script
# This script sets up a fresh VPS for VTP application deployment

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

print_status "Starting VPS setup for VTP application..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. This is not recommended for production."
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Node.js 18
print_status "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker
print_status "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
rm get-docker.sh

# Install Docker Compose
print_status "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx (optional)
print_status "Installing Nginx..."
sudo apt install -y nginx

# Install UFW firewall
print_status "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000
sudo ufw allow 8080
sudo ufw --force enable

# Create application directory
print_status "Creating application directory..."
sudo mkdir -p /opt/vtp
sudo chown $USER:$USER /opt/vtp

# Install PM2 for process management (optional)
print_status "Installing PM2..."
sudo npm install -g pm2

# Create systemd service for VTP (optional)
print_status "Creating systemd service..."
sudo tee /etc/systemd/system/vtp.service > /dev/null <<EOF
[Unit]
Description=VTP Application
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/vtp
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=$USER
Group=$USER

[Install]
WantedBy=multi-user.target
EOF

# Create nginx configuration for VTP
print_status "Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/vtp > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable nginx site
sudo ln -sf /etc/nginx/sites-available/vtp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Create deployment script
print_status "Creating deployment script..."
sudo tee /opt/vtp/deploy.sh > /dev/null <<'EOF'
#!/bin/bash
cd /opt/vtp
git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "No git repository found"
npm run deploy:prod
docker-compose --profile production up -d --build
EOF

sudo chmod +x /opt/vtp/deploy.sh

# Create backup script
print_status "Creating backup script..."
sudo tee /opt/vtp/backup.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/vtp/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
if [ -f "/opt/vtp/backend/prisma/database.sqlite" ]; then
    cp /opt/vtp/backend/prisma/database.sqlite $BACKUP_DIR/database_$DATE.sqlite
fi

# Backup environment files
if [ -f "/opt/vtp/backend/.env.production" ]; then
    cp /opt/vtp/backend/.env.production $BACKUP_DIR/backend_env_$DATE
fi

if [ -f "/opt/vtp/frontend/.env.production.local" ]; then
    cp /opt/vtp/frontend/.env.production.local $BACKUP_DIR/frontend_env_$DATE
fi

# Keep only last 7 backups
find $BACKUP_DIR -name "*.sqlite" -mtime +7 -delete
find $BACKUP_DIR -name "*_env_*" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

sudo chmod +x /opt/vtp/backup.sh

# Create cron job for backups
print_status "Setting up automatic backups..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/vtp/backup.sh") | crontab -

# Create monitoring script
print_status "Creating monitoring script..."
sudo tee /opt/vtp/monitor.sh > /dev/null <<'EOF'
#!/bin/bash
# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    echo "Services are down, restarting..."
    docker-compose restart
fi

# Check disk space
DISK_USAGE=$(df /opt/vtp | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Warning: Disk usage is ${DISK_USAGE}%"
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEMORY_USAGE -gt 80 ]; then
    echo "Warning: Memory usage is ${MEMORY_USAGE}%"
fi
EOF

sudo chmod +x /opt/vtp/monitor.sh

# Create cron job for monitoring
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/vtp/monitor.sh") | crontab -

print_success "VPS setup completed!"
print_status "Next steps:"
print_status "1. Clone your VTP repository to /opt/vtp"
print_status "2. Configure environment variables"
print_status "3. Run: npm run deploy:prod"
print_status "4. Access your application at http://your-server-ip"

print_status "Useful commands:"
print_status "  - Deploy: /opt/vtp/deploy.sh"
print_status "  - Backup: /opt/vtp/backup.sh"
print_status "  - Monitor: /opt/vtp/monitor.sh"
print_status "  - View logs: docker-compose logs -f"
print_status "  - Restart: docker-compose restart"

print_warning "Please log out and log back in for Docker group changes to take effect."




