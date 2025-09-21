#!/bin/bash
echo "Starting FreeSplit servers..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Get the local IP address dynamically
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

# Fallback to localhost if IP detection fails
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
    echo "⚠️  Could not detect local IP, using localhost (not accessible from other devices)"
else
    echo "Detected local IP: $LOCAL_IP"
fi

# Start backend
echo "Starting backend server on port 8080..."
cd backend && go run rest_server.go &
BACKEND_PID=$!

# Go back to project root and start frontend
echo "Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend" && npm install
echo "Setting up environment for network access..."
cd "$SCRIPT_DIR/frontend" && echo "REACT_APP_API_URL=http://$LOCAL_IP:8080" > .env
echo "Starting frontend server on port 3000..."
cd "$SCRIPT_DIR/frontend" && HOST=0.0.0.0 PORT=3001 npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers are starting..."
echo "🔧 Backend API: http://$LOCAL_IP:8080"
echo "🌐 Frontend App: http://$LOCAL_IP:3001"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
