#!/bin/bash
echo "Stopping FreeSplit servers..."

# Stop backend
echo "Stopping backend server..."
lsof -ti:8080 | xargs kill -9 2>/dev/null

# Stop frontend
echo "Stopping frontend server..."
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Stop any remaining processes
pkill -f "rest_server" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null

echo "✅ All servers stopped!"
