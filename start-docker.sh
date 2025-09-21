#!/bin/bash

# Check for foreground flag
FOREGROUND=false
if [ "$1" = "--foreground" ] || [ "$1" = "-f" ]; then
    FOREGROUND=true
fi

echo "🐳 Starting FreeSplit with Docker..."

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

# Set environment variables for Docker Compose
export LOCAL_IP=$LOCAL_IP

echo "🚀 Starting all services with Docker Compose..."
echo ""
echo "🌐 Access URLs:"
echo "   📱 Frontend App: http://$LOCAL_IP:3001"
echo "   🔧 Backend API:  http://$LOCAL_IP:8080"
echo "   🗄️  PostgreSQL:   localhost:5432"
echo ""

if [ "$FOREGROUND" = true ]; then
    echo "🖥️  Running in foreground mode (logs will be shown)"
    echo "   Use Ctrl+C to stop all services"
    echo ""
    # Start all services with Docker Compose in foreground
    docker-compose up --build
    echo ""
    echo "🛑 All services stopped"
else
    echo "🔄 Running in background mode"
    echo "   Use './stop-docker.sh' to stop all services"
    echo "   Use './start-docker.sh --foreground' to see logs"
    echo ""
    # Start all services with Docker Compose in background
    docker-compose up --build -d
    
    echo "✅ Services started in background"
    echo "📊 To view logs: docker-compose logs -f"
    echo "🛑 To stop: ./stop-docker.sh"
fi