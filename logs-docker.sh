#!/bin/bash
echo "📊 Viewing FreeSplit Docker logs..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Show logs for all services
docker-compose logs -f
