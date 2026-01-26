#!/bin/zsh
# Development startup script for OLKD_Svelte
# Starts both Flask backend and SvelteKit frontend

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${GREEN}Starting OLKD_Svelte Development Environment${NC}"
echo "=============================================="

# Check if Python virtual environment exists, create if not
if [ ! -d "backend/.venv" ]; then
    echo "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv backend/.venv
fi

# Activate virtual environment and install dependencies
echo "${YELLOW}Installing Python dependencies...${NC}"
source backend/.venv/bin/activate
pip install -q -r backend/requirements.txt

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "${YELLOW}Installing npm dependencies...${NC}"
    npm install
fi

# Function to cleanup on exit
cleanup() {
    echo "\n${YELLOW}Shutting down...${NC}"
    # Kill all background jobs
    jobs -p | xargs -r kill 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Flask backend
echo "${GREEN}Starting Flask backend on port 8080...${NC}"
cd backend
FLASK_APP=munimap.app:create_app FLASK_ENV=development python -m flask run --host=0.0.0.0 --port=8080 &
FLASK_PID=$!
cd ..

# Wait for Flask to start
sleep 2

# Start SvelteKit frontend
echo "${GREEN}Starting SvelteKit frontend on port 5173...${NC}"
npm run dev &
SVELTE_PID=$!

echo ""
echo "${GREEN}=============================================="
echo "Development servers running:"
echo "  - Flask API:    http://localhost:8080"
echo "  - SvelteKit:    http://localhost:5173"
echo "  - App:          http://localhost:5173/app/default/"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "==============================================${NC}"

# Wait for both processes
wait
