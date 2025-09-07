#!/bin/bash
echo "Starting FreeSplit servers..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Start backend
echo "Starting backend server on port 8080..."
cd backend && go run rest_server.go &
BACKEND_PID=$!

# Go back to project root and start frontend
echo "Starting frontend server on port 3000..."
cd "$SCRIPT_DIR/frontend" && npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers are starting..."
echo "🔧 Backend API: http://localhost:8080"
echo "🌐 Frontend App: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Wait for user to stop
wait
