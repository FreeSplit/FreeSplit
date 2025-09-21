#!/bin/bash
echo "🛑 Stopping FreeSplit Docker services..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Stop all services
docker-compose down

echo "✅ All Docker services stopped"
