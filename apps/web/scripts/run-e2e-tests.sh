#!/bin/bash

# E2E Test Execution Script
# This script automates the process of running E2E tests with proper setup

set -e  # Exit on error

echo "=========================================="
echo "E2E Test Execution Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if backend API is running
echo -e "${YELLOW}Checking if backend API is running...${NC}"
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API is running${NC}"
else
    echo -e "${RED}✗ Backend API is not running on http://localhost:5000${NC}"
    echo -e "${YELLOW}Please start the backend API before running E2E tests${NC}"
    echo ""
    echo "To start the backend:"
    echo "  cd ../.."
    echo "  dotnet run --project ClinicsManagementService"
    exit 1
fi

# Check if frontend is already running
echo ""
echo -e "${YELLOW}Checking if frontend is already running...${NC}"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is already running${NC}"
    FRONTEND_RUNNING=true
else
    echo -e "${YELLOW}Frontend is not running, Playwright will start it automatically${NC}"
    FRONTEND_RUNNING=false
fi

# Run tests
echo ""
echo -e "${YELLOW}Running E2E tests...${NC}"
echo ""

# Check for command line arguments
if [ "$1" == "--headed" ]; then
    echo "Running in headed mode (visible browser)"
    npm run test:e2e:headed
elif [ "$1" == "--debug" ]; then
    echo "Running in debug mode"
    npm run test:e2e:debug
elif [ "$1" == "--report" ]; then
    echo "Opening test report"
    npm run test:e2e:report
else
    echo "Running in headless mode"
    npm run test:e2e
fi

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "✓ All E2E tests passed!"
    echo "==========================================${NC}"
else
    echo -e "${RED}=========================================="
    echo "✗ Some E2E tests failed"
    echo "==========================================${NC}"
    echo ""
    echo "To view the test report:"
    echo "  npm run test:e2e:report"
fi

exit $EXIT_CODE

