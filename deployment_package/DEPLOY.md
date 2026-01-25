# 🏥 Clinics Management System - Deployment Guide

## Prerequisites

The following must be installed on the VPS:
- Docker Engine
- Docker Compose

### Install Docker (Ubuntu/Debian)

```bash
# Update packages
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Logout and login again, then verify
docker --version
```

---

## Deployment Steps

### 1. Load Docker Images

```bash
# Load the pre-built images
docker load -i docker-images/clinics-api.tar
docker load -i docker-images/clinics-web.tar

# Verify images are loaded
docker images
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your production values
nano .env
```

**Required values to set:**
- `DB_PASSWORD` - Strong database password
- `JWT_SECRET_KEY` - At least 32 characters
- `API_URL` - Your domain (e.g., https://clinics.example.com)
- `DOMAIN` - Your domain name

### 3. Start Services

```bash
# Start all services in background
docker compose -f docker-compose.deploy.yml up -d

# Check status
docker compose -f docker-compose.deploy.yml ps

# View logs
docker compose -f docker-compose.deploy.yml logs -f
```

### 4. Setup SSL (Recommended)

```bash
# Install certbot
sudo apt install certbot

# Get SSL certificate
sudo certbot certonly --webroot -w /var/www/certbot -d yourdomain.com

# Update nginx.conf with SSL configuration
# Restart nginx
docker compose -f docker-compose.deploy.yml restart nginx
```

---

## Management Commands

```bash
# Stop all services
docker compose -f docker-compose.deploy.yml down

# Restart a specific service
docker compose -f docker-compose.deploy.yml restart api

# View API logs
docker logs clinics-api -f

# View web logs
docker logs clinics-web -f

# Access database
docker exec -it clinics-db psql -U clinics_user -d ClinicsDb
```

---

## Backup Database

```bash
# Backup
docker exec clinics-db pg_dump -U clinics_user ClinicsDb > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20240125.sql | docker exec -i clinics-db psql -U clinics_user -d ClinicsDb
```

---

## Troubleshooting

### API not starting
```bash
docker logs clinics-api
```

### Database connection issues
```bash
# Check if database is healthy
docker compose -f docker-compose.deploy.yml ps db

# Test connection
docker exec clinics-db pg_isready -U clinics_user
```

### Port 80 already in use
```bash
# Find what's using port 80
sudo lsof -i :80

# Stop the service or change the port in docker-compose.deploy.yml
```

---

## Support

For technical support, contact: [Your contact info]
