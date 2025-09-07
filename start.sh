#!/bin/bash
echo "Starting FreeSplit servers..."

# Start backend
echo "Starting backend server on port 8080..."
cd backend && go run rest_server.go &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend server on port 3000..."
cd ../frontend && npm start &
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
