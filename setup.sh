#!/bin/bash

echo "🚀 Setting up FreeSplit - Expense Splitting Application"
echo "======================================================="

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

# Check if we want Docker or local setup
if [ "$1" = "--local" ] || [ "$1" = "-l" ]; then
    echo "🔧 Setting up for local development..."
    SETUP_MODE="local"
else
    echo "🐳 Setting up with Docker..."
    SETUP_MODE="docker"
fi

if [ "$SETUP_MODE" = "docker" ]; then
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    echo "✅ Docker and Docker Compose are installed"
fi

if [ "$SETUP_MODE" = "local" ]; then
    # Setup PATH variables first
    setup_path_variables
    
    # Check if Go is installed
    if ! command -v go &> /dev/null; then
        echo "❌ Go is not installed. Please install Go first."
        echo ""
        echo "📦 Installation instructions:"
        echo "   macOS: brew install go"
        echo "   Windows: choco install golang (or download from https://golang.org/dl/)"
        echo "   Linux: sudo apt install golang-go (or download from https://golang.org/dl/)"
        echo ""
        echo "   After installation, restart your terminal and run this script again."
        exit 1
    fi

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js first."
        echo ""
        echo "📦 Installation instructions:"
        echo "   macOS: brew install node"
        echo "   Windows: choco install nodejs (or download from https://nodejs.org/)"
        echo "   Linux: sudo apt install nodejs npm (or download from https://nodejs.org/)"
        echo ""
        echo "   After installation, restart your terminal and run this script again."
        exit 1
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed. Please install npm first."
        echo ""
        echo "📦 npm usually comes with Node.js, but if not:"
        echo "   macOS: brew install npm"
        echo "   Windows: choco install npm"
        echo "   Linux: sudo apt install npm"
        echo ""
        echo "   After installation, restart your terminal and run this script again."
        exit 1
    fi

    # Check Go version
    GO_VERSION=$(go version | cut -d' ' -f3 | cut -d'o' -f2)
    echo "✅ Go version: $GO_VERSION"
    
    # Ensure Go is in PATH and set GOPATH if needed
    if ! command -v go &> /dev/null; then
        echo "❌ Go not found in PATH after installation"
        echo "Please add Go to your PATH:"
        echo "  export PATH=\$PATH:/usr/local/go/bin"
        echo "  export GOPATH=\$HOME/go"
        echo "  export PATH=\$PATH:\$GOPATH/bin"
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version)
    echo "✅ Node.js version: $NODE_VERSION"
    
    # Check npm version
    NPM_VERSION=$(npm --version)
    echo "✅ npm version: $NPM_VERSION"
fi

# Create data directory for database persistence
mkdir -p data

echo "📁 Created data directory for database persistence"

if [ "$SETUP_MODE" = "local" ]; then
    # Local development setup
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install frontend dependencies"
        exit 1
    fi
    cd ..
    
    echo "📦 Installing backend dependencies..."
    cd backend
    go mod tidy
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install backend dependencies"
        exit 1
    fi
    cd ..
    
    echo "✅ Local development setup complete!"
    echo ""
    echo "🚀 To start the application:"
    echo "   ./start.sh"
    echo ""
    echo "🛑 To stop the application:"
    echo "   ./stop.sh"
    echo ""
    echo "🌐 Access the application:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend API: http://localhost:8080"
    echo ""
    echo "🎉 FreeSplit is ready for local development!"
else
    # Docker setup
    echo "🔨 Building and starting the application..."
    docker-compose up -d --build

    # Wait for services to be ready
    echo "⏳ Waiting for services to start..."
    sleep 10

    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        echo "✅ Application started successfully!"
        echo ""
        echo "🌐 Access the application:"
        echo "   Frontend: http://localhost:3000"
        echo "   Backend API: http://localhost:8081"
        echo ""
        echo "📊 View logs:"
        echo "   docker-compose logs -f"
        echo ""
        echo "🛑 Stop the application:"
        echo "   docker-compose down"
        echo ""
        echo "🎉 FreeSplit is ready to use!"
    else
        echo "❌ Failed to start the application. Check logs with: docker-compose logs"
        exit 1
    fi
fi
