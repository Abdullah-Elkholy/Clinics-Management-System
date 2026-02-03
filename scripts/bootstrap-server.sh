#!/bin/bash
# ===========================================
# Zero-Touch Server Bootstrap Script
# For fresh Ubuntu 22.04+ servers
# ===========================================
set -e

echo "=== Server Bootstrap Script ==="
echo "Starting at: $(date)"

# ===========================================
# 1. SYSTEM UPDATE
# ===========================================
echo "=== Updating system packages ==="
apt update && apt upgrade -y

# ===========================================
# 2. FIREWALL CONFIGURATION
# ===========================================
echo "=== Configuring UFW Firewall ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
echo "y" | ufw enable
ufw status

# ===========================================
# 3. SSH HARDENING
# ===========================================
echo "=== Hardening SSH configuration ==="
# Disable password authentication (key-only access)
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
# Disable root login with password, allow only key-based
sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart ssh

# ===========================================
# 4. INSTALL DOCKER (v2 with compose)
# ===========================================
echo "=== Installing Docker ==="
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  echo "Docker installed successfully"
else
  echo "Docker already installed: $(docker --version)"
fi

# ===========================================
# 5. INSTALL FAIL2BAN
# ===========================================
echo "=== Installing Fail2Ban ==="
apt install -y fail2ban

# Configure Fail2Ban for SSH protection
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
EOF

# ===========================================
# 6. ENABLE SERVICES
# ===========================================
echo "=== Enabling services ==="
systemctl enable docker
systemctl enable fail2ban
systemctl start docker
systemctl start fail2ban

# ===========================================
# 7. CREATE DEPLOY DIRECTORY
# ===========================================
DEPLOY_PATH="${DEPLOY_PATH:-/opt/clinics}"
echo "=== Creating deploy directory: ${DEPLOY_PATH} ==="
mkdir -p "${DEPLOY_PATH}"

# ===========================================
# 8. SYSTEM CLEANUP
# ===========================================
echo "=== Cleaning up ==="
apt autoremove -y
apt autoclean -y

# ===========================================
# 9. VERIFICATION
# ===========================================
echo ""
echo "=== BOOTSTRAP COMPLETE ==="
echo "Timestamp: $(date)"
echo ""
echo "Security Status:"
echo "  - UFW: $(ufw status | grep Status)"
echo "  - Fail2Ban: $(systemctl is-active fail2ban)"
echo "  - Docker: $(docker --version)"
echo "  - SSH Password Auth: $(grep -E '^PasswordAuthentication' /etc/ssh/sshd_config || echo 'not set')"
echo ""
echo "=== SERVER SECURED! ==="
