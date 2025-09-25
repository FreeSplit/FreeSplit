#!/bin/bash

# Prevent terminal clearing and preserve output
exec 2>&1  # Redirect stderr to stdout to preserve error messages

echo "Stopping FreeSplit servers..."
echo "============================="

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
