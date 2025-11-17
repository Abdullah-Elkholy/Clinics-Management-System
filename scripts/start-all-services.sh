#!/bin/bash

# Start All Services Script (Unix/Linux/Mac)
# Starts Backend API, Frontend, and optionally WhatsApp Service

set -e

INCLUDE_WHATSAPP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --whatsapp)
      INCLUDE_WHATSAPP=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "=========================================="
echo "Starting All Services"
echo "=========================================="
echo ""

# Function to check if a port is in use
check_port() {
  local port=$1
  if command -v nc &> /dev/null; then
    nc -z localhost $port 2>/dev/null
  elif command -v netcat &> /dev/null; then
    netcat -z localhost $port 2>/dev/null
  else
    # Fallback: try to connect
    timeout 1 bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null
  fi
}

# Check if Backend API is already running
echo "Checking Backend API (port 5000)..."
if check_port 5000; then
  echo "✓ Backend API is already running on port 5000"
else
  echo "Starting Backend API..."
  cd "$(dirname "$0")/../src/Api"
  USE_LOCAL_SQL=true SEED_ADMIN=true ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5000 dotnet run &
  BACKEND_PID=$!
  echo "Backend API starting (PID: $BACKEND_PID)..."
  sleep 5
  
  # Wait for backend to be ready
  max_attempts=30
  attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if check_port 5000; then
      echo "✓ Backend API is ready on http://localhost:5000"
      break
    fi
    attempt=$((attempt + 1))
    echo "Waiting for Backend API... ($attempt/$max_attempts)"
    sleep 2
  done
  
  if [ $attempt -eq $max_attempts ]; then
    echo "⚠ Backend API did not start within timeout"
  fi
fi

echo ""

# Check if Frontend is already running
echo "Checking Frontend (port 3000)..."
if check_port 3000; then
  echo "✓ Frontend is already running on port 3000"
else
  echo "Starting Frontend..."
  cd "$(dirname "$0")/../apps/web"
  npm run dev &
  FRONTEND_PID=$!
  echo "Frontend starting (PID: $FRONTEND_PID)..."
  sleep 3
  
  # Wait for frontend to be ready
  max_attempts=20
  attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
      echo "✓ Frontend is ready on http://localhost:3000"
      break
    fi
    attempt=$((attempt + 1))
    echo "Waiting for Frontend... ($attempt/$max_attempts)"
    sleep 2
  done
  
  if [ $attempt -eq $max_attempts ]; then
    echo "⚠ Frontend did not start within timeout"
  fi
fi

echo ""

# Optionally start WhatsApp Service
if [ "$INCLUDE_WHATSAPP" = true ]; then
  echo "Checking WhatsApp Service (port 5100)..."
  if check_port 5100; then
    echo "✓ WhatsApp Service is already running on port 5100"
  else
    echo "Starting WhatsApp Service..."
    cd "$(dirname "$0")/../ClinicsManagementService"
    ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5100 dotnet run --project WhatsAppMessagingService &
    WHATSAPP_PID=$!
    echo "WhatsApp Service starting (PID: $WHATSAPP_PID)..."
  fi
fi

echo ""
echo "=========================================="
echo "Services Status:"
echo "=========================================="
if check_port 5000; then
  echo -e "Backend API:  \033[32mhttp://localhost:5000\033[0m"
else
  echo -e "Backend API:  \033[31mhttp://localhost:5000\033[0m"
fi

if check_port 3000; then
  echo -e "Frontend:     \033[32mhttp://localhost:3000\033[0m"
else
  echo -e "Frontend:     \033[31mhttp://localhost:3000\033[0m"
fi

if [ "$INCLUDE_WHATSAPP" = true ]; then
  if check_port 5100; then
    echo -e "WhatsApp:     \033[32mhttp://localhost:5100\033[0m"
  else
    echo -e "WhatsApp:     \033[31mhttp://localhost:5100\033[0m"
  fi
fi

echo ""
echo "Test Credentials:"
echo "  Admin:      admin / admin123"
echo "  Admin2:     admin2 / admin123"
echo "  Moderator:  mod1 / mod123"
echo "  User:       user1 / user123"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
wait

