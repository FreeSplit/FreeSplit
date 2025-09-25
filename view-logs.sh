#!/bin/bash

echo "📄 FreeSplit Log Viewer"
echo "======================"
echo ""

# Check if logs directory exists
if [ ! -d "logs" ]; then
    echo "❌ No logs directory found. Run ./start.sh first to generate logs."
    exit 1
fi

# Function to show log content
show_log() {
    local log_file=$1
    local service_name=$2
    
    if [ -f "$log_file" ]; then
        echo "📄 $service_name logs ($log_file):"
        echo "----------------------------------------"
        cat "$log_file"
        echo ""
    else
        echo "❌ $service_name log file not found: $log_file"
        echo ""
    fi
}

# Show available logs
echo "Available log files:"
ls -la logs/ 2>/dev/null || echo "No log files found"
echo ""

# Show specific log if requested
if [ "$1" = "backend" ]; then
    show_log "logs/backend.log" "Backend"
elif [ "$1" = "frontend" ]; then
    show_log "logs/frontend.log" "Frontend"
elif [ "$1" = "all" ]; then
    show_log "logs/backend.log" "Backend"
    show_log "logs/frontend.log" "Frontend"
else
    echo "Usage: $0 [backend|frontend|all]"
    echo ""
    echo "Examples:"
    echo "  $0 backend   - Show backend logs"
    echo "  $0 frontend  - Show frontend logs"
    echo "  $0 all       - Show all logs"
    echo ""
    echo "Or run without arguments to see this help."
fi
