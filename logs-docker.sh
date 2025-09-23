#!/bin/bash
echo "📊 Viewing FreeSplit Docker logs..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Get the local IP address dynamically
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

# Fallback to localhost if IP detection fails
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
fi

echo ""
echo "🌐 Access URLs:"
echo "   📱 Frontend App: http://$LOCAL_IP:3001"
echo "   🔧 Backend API:  http://$LOCAL_IP:8080"
echo "   🗄️  PostgreSQL:   localhost:5432"
echo ""
echo "👀 Showing logs (Ctrl+C to exit logs, services will continue running)..."
echo ""

# Show logs for all services
docker-compose logs -f
