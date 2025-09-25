#!/bin/bash

# Prevent terminal clearing and preserve output
set -e  # Exit on any error
exec 2>&1  # Redirect stderr to stdout to preserve error messages

echo "Starting FreeSplit servers with PostgreSQL..."
echo "============================================="
echo "📝 All output will be preserved - scroll up to see any errors"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to setup PATH variables for Go and PostgreSQL
setup_path_variables() {
    echo "🔧 Setting up PATH variables..."
    
    # Setup Go PATH
    if command -v go &> /dev/null; then
        GO_BIN_PATH=$(go env GOROOT)/bin
        if [ -d "$GO_BIN_PATH" ] && [[ ":$PATH:" != *":$GO_BIN_PATH:"* ]]; then
            export PATH="$GO_BIN_PATH:$PATH"
            echo "✅ Added Go binaries to PATH: $GO_BIN_PATH"
        fi
        
        # Setup GOPATH
        if [ -z "$GOPATH" ]; then
            export GOPATH="$HOME/go"
            echo "✅ Set GOPATH: $GOPATH"
        fi
        
        # Add GOPATH/bin to PATH
        if [ -d "$GOPATH/bin" ] && [[ ":$PATH:" != *":$GOPATH/bin:"* ]]; then
            export PATH="$GOPATH/bin:$PATH"
            echo "✅ Added GOPATH/bin to PATH: $GOPATH/bin"
        fi
    fi
    
    # Setup PostgreSQL PATH (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Try Homebrew PostgreSQL paths
        for version in "postgresql@15" "postgresql@14" "postgresql@13" "postgresql"; do
            BREW_PREFIX=$(brew --prefix "$version" 2>/dev/null)
            if [ -n "$BREW_PREFIX" ] && [ -d "$BREW_PREFIX/bin" ]; then
                if [[ ":$PATH:" != *":$BREW_PREFIX/bin:"* ]]; then
                    export PATH="$BREW_PREFIX/bin:$PATH"
                    echo "✅ Added PostgreSQL binaries to PATH: $BREW_PREFIX/bin"
                fi
                break
            fi
        done
    fi
    
    # Setup PostgreSQL PATH (Linux)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        for candidate in /usr/lib/postgresql/*/bin; do
            if [ -d "$candidate" ] && [[ ":$PATH:" != *":$candidate:"* ]]; then
                export PATH="$candidate:$PATH"
                echo "✅ Added PostgreSQL binaries to PATH: $candidate"
                break
            fi
        done
    fi
}

# Setup PATH variables first
setup_path_variables

# Get the local IP address dynamically
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

# Fallback to localhost if IP detection fails
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
    echo "⚠️  Could not detect local IP, using localhost (not accessible from other devices)"
else
    echo "Detected local IP: $LOCAL_IP"
fi

# Function to install dependencies on macOS
install_dependencies_macos() {
    echo "📦 Installing missing dependencies via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
    # Install PostgreSQL if not installed
    if ! command -v psql &> /dev/null; then
        echo "Installing PostgreSQL..."
        brew install postgresql@15
        brew services start postgresql@15
    else
        echo "✅ PostgreSQL already installed"
        # Make sure it's running
        if ! brew services list | grep postgresql@15 | grep -q "started"; then
            echo "🔄 Starting PostgreSQL service..."
            brew services start postgresql@15
        fi
    fi
    
    # Install Go if not installed
    if ! command -v go &> /dev/null; then
        echo "Installing Go..."
        brew install go
    else
        echo "✅ Go already installed"
    fi
    
    # Install Node.js if not installed
    if ! command -v node &> /dev/null; then
        echo "Installing Node.js..."
        brew install node
    else
        echo "✅ Node.js already installed"
    fi
    
    ensure_postgres_path
}

# Function to install dependencies on Linux
install_dependencies_linux() {
    echo "📦 Installing missing dependencies via apt..."
    sudo apt update
    
    # Install PostgreSQL if not installed
    if ! command -v psql &> /dev/null; then
        echo "Installing PostgreSQL..."
        sudo apt install -y postgresql postgresql-contrib
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    else
        echo "✅ PostgreSQL already installed"
    fi
    
    # Install Go if not installed
    if ! command -v go &> /dev/null; then
        echo "Installing Go..."
        sudo apt install -y golang-go
    else
        echo "✅ Go already installed"
    fi
    
    # Install Node.js if not installed
    if ! command -v node &> /dev/null; then
        echo "Installing Node.js..."
        sudo apt install -y nodejs npm
    else
        echo "✅ Node.js already installed"
    fi
}

# Ensure PostgreSQL binaries are available on PATH
ensure_postgres_path() {
    if command -v pg_isready >/dev/null 2>&1 && command -v psql >/dev/null 2>&1; then
        return
    fi

    if [[ "$OSTYPE" == "darwin"* ]]; then
        local default_prefix="/opt/homebrew/opt/postgresql@15"
        if [ -d "$default_prefix/bin" ]; then
            case ":$PATH:" in
                *":$default_prefix/bin:"*) ;;
                *)
                    export PATH="$default_prefix/bin:$PATH"
                    echo "✅ Added PostgreSQL binaries to PATH: $default_prefix/bin"
                ;;
            esac
        fi

        local brew_prefix
        brew_prefix=$(brew --prefix postgresql@15 2>/dev/null)
        if [ -z "$brew_prefix" ]; then
            brew_prefix=$(brew --prefix postgresql 2>/dev/null)
        fi
        if [ -n "$brew_prefix" ]; then
            case ":$PATH:" in
                *":$brew_prefix/bin:"*) ;;
                *)
                    export PATH="$brew_prefix/bin:$PATH"
                    echo "✅ Added PostgreSQL binaries to PATH: $brew_prefix/bin"
                ;;
            esac
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        for candidate in /usr/lib/postgresql/*/bin; do
            if [ -d "$candidate" ]; then
                case ":$PATH:" in
                    *":$candidate:"*) ;;
                    *)
                        export PATH="$candidate:$PATH"
                        echo "✅ Added PostgreSQL binaries to PATH: $candidate"
                    ;;
                esac
                break
            fi
        done
    fi
}

# Function to create database and user
setup_postgresql() {
    echo "🔧 Setting up PostgreSQL database..."
    
    # Create database if it doesn't exist
    createdb freesplit 2>/dev/null || echo "Database 'freesplit' already exists or will be created"
    
    # Set password for postgres user (if not already set)
    sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || echo "Password already set or user doesn't exist"
}

# Check if any dependencies are missing
MISSING_DEPS=()

# Try to locate PostgreSQL binaries if they aren't already available
ensure_postgres_path

if ! command -v psql &> /dev/null; then
    MISSING_DEPS+=("PostgreSQL")
fi

if ! command -v go &> /dev/null; then
    MISSING_DEPS+=("Go")
fi

if ! command -v node &> /dev/null; then
    MISSING_DEPS+=("Node.js")
fi

# Install missing dependencies
if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo "❌ Missing dependencies: ${MISSING_DEPS[*]}"
    echo "🔄 Installing missing dependencies..."
    
    # Detect OS and install accordingly
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        install_dependencies_macos
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        install_dependencies_linux
    else
        echo "❌ Unsupported operating system: $OSTYPE"
        echo "Please install dependencies manually or use: ./start-docker.sh"
        exit 1
    fi
fi

# Make sure newly installed binaries are on PATH
ensure_postgres_path

# Function to check if PostgreSQL is running
check_postgresql() {
    if ! command -v pg_isready >/dev/null 2>&1; then
        echo "⚠️  pg_isready not found; skipping readiness probe"
        return 0
    fi

    # Try multiple ways to check if PostgreSQL is running
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo "✅ PostgreSQL found on localhost:5432"
        return 0
    elif pg_isready -h 127.0.0.1 -p 5432 > /dev/null 2>&1; then
        echo "✅ PostgreSQL found on 127.0.0.1:5432"
        return 0
    elif pg_isready -h localhost -p 5433 > /dev/null 2>&1; then
        echo "✅ PostgreSQL found on localhost:5433"
        return 0
    else
        # Debug: show what pg_isready is actually doing
        echo "🔍 Debug: Checking PostgreSQL status..."
        pg_isready -h localhost -p 5432 2>&1 || echo "  - localhost:5432 failed"
        pg_isready -h 127.0.0.1 -p 5432 2>&1 || echo "  - 127.0.0.1:5432 failed"
        pg_isready -h localhost -p 5433 2>&1 || echo "  - localhost:5433 failed"
        return 1
    fi
}

# Check if PostgreSQL is running
if ! check_postgresql; then
    echo "❌ PostgreSQL is not running"
    echo "🔄 Attempting to start PostgreSQL..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - try different service names
        if brew services list | grep -q "postgresql@15"; then
            brew services start postgresql@15
        elif brew services list | grep -q "postgresql"; then
            brew services start postgresql
        else
            echo "❌ No PostgreSQL service found. Installing..."
            brew install postgresql@15
            brew services start postgresql@15
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo systemctl start postgresql
    fi
    
    # Wait a moment for PostgreSQL to start
    echo "⏳ Waiting for PostgreSQL to start..."
    sleep 5
    
    # Check again with multiple attempts
    for i in {1..3}; do
        if check_postgresql; then
            break
        fi
        echo "⏳ Attempt $i/3: Waiting for PostgreSQL..."
        sleep 2
    done
    
    if ! check_postgresql; then
        echo "❌ Failed to start PostgreSQL automatically"
        echo "PostgreSQL might be running on a different port or configuration."
        echo "Please check manually:"
        echo "  brew services list | grep postgresql  # macOS"
        echo "  sudo systemctl status postgresql      # Linux"
        echo "  Or use: ./start-docker.sh"
        exit 1
    fi
fi

echo "✅ PostgreSQL is running"

# Set up database
setup_postgresql

# Create logs directory if it doesn't exist
mkdir -p logs

# Start backend
echo "Installing backend dependencies..."
cd backend
if ! go mod download; then
    echo "❌ Failed to download Go dependencies"
    echo "Please check your Go installation and internet connection"
    echo "Try running: go clean -modcache && go mod download"
    exit 1
fi
echo "✅ Backend dependencies installed successfully"

echo "Starting backend server on port 8080..."
export DATABASE_URL="host=localhost user=postgres password=postgres dbname=freesplit port=5432 sslmode=disable"

# Start backend with error logging
echo "🔧 Backend starting... (check for errors above)"
go run rest_server.go > ../logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start and check if it's running
echo "⏳ Waiting for backend to start..."
sleep 3

# Check if backend is actually running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start. Check logs:"
    echo "📄 Backend logs:"
    cat ../logs/backend.log 2>/dev/null || echo "No log file found"
    exit 1
fi

# Check if backend is responding
if ! curl -s http://localhost:8080/health >/dev/null 2>&1; then
    echo "⚠️  Backend started but not responding on port 8080"
    echo "📄 Backend logs:"
    cat ../logs/backend.log 2>/dev/null || echo "No log file found"
    echo "⏳ Waiting a bit more for backend to fully start..."
    sleep 5
fi

# Go back to project root and start frontend
echo "Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
if ! npm install; then
    echo "❌ Failed to install frontend dependencies"
    echo "Try running: npm cache clean --force && npm install"
    exit 1
fi
echo "✅ Frontend dependencies installed successfully"

echo "Setting up environment for network access..."
echo "REACT_APP_API_URL=http://$LOCAL_IP:8080" > .env

echo "Starting frontend server on port 3001..."

# Start frontend with error logging
echo "🌐 Frontend starting... (check for errors above)"
HOST=0.0.0.0 PORT=3001 npm start > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!

# Wait a moment for frontend to start and check if it's running
echo "⏳ Waiting for frontend to start..."
sleep 5

# Check if frontend is actually running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend failed to start. Check logs:"
    echo "📄 Frontend logs:"
    cat "$SCRIPT_DIR/logs/frontend.log" 2>/dev/null || echo "No log file found"
    exit 1
fi 

echo ""
echo "✅ Both servers are starting..."
echo "🔧 Backend API: http://$LOCAL_IP:8080"
echo "🌐 Frontend App: http://$LOCAL_IP:3001"
echo "🗄️  PostgreSQL: localhost:5432"
echo ""
echo "📄 Log files (scroll up to see any errors):"
echo "   Backend logs: logs/backend.log"
echo "   Frontend logs: logs/frontend.log"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "💡 If you see errors, check the log files above or scroll up in this terminal"
