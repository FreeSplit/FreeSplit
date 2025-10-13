# FreeSplit Development Guide

This guide covers everything you need to know for developing, building, and contributing to FreeSplit.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Setup Instructions](#️-setup-instructions)
- [Development Workflow](#-development-workflow)
- [Architecture Overview](#-architecture-overview)
- [Helper Scripts](#-helper-scripts)
- [Testing](#-testing)
- [Contributing](#-contributing)

## 🚀 Quick Start

### Prerequisites

**For Docker Setup:**
- Docker Desktop (macOS/Windows) or Docker Engine (Linux)
- Docker Compose

**For Local Setup:**
- Go 1.21 or higher
- Node.js 16+ and npm 8+
- PostgreSQL 13+ (local database server)

### Choose Your Setup Method

FreeSplit supports two development setups:

1. **Docker** - Containerized, consistent environment (recommended for quick start)
2. **Local** - Direct development on your machine (recommended for active development)

## 🗂️ Project Structure

```
freesplit/
├── backend/                    # Go REST API backend
│   ├── internal/              # Private application code
│   │   ├── database/         # Database models and migrations
│   │   │   └── models.go     # GORM models for all entities
│   │   ├── services/         # Business logic layer
│   │   │   ├── interfaces.go        # Service interfaces
│   │   │   ├── types.go              # Data types and structs
│   │   │   ├── group_service.go      # Group management logic
│   │   │   ├── participant_service.go # Member management logic
│   │   │   ├── expense_service.go    # Expense tracking logic
│   │   │   ├── debt_service.go       # Debt calculation logic
│   │   │   └── debt_calculation.go   # Debt simplification algorithm
│   │   └── tests/            # Unit and integration tests
│   │       └── debt_service_test.go
│   ├── rest_server.go         # REST API server and routes
│   ├── go.mod                 # Go dependencies
│   ├── go.sum                 # Go dependency checksums
│   ├── Dockerfile             # Backend Docker configuration
│   └── README.md              # Backend-specific documentation
│
├── frontend/                   # React PWA frontend
│   ├── public/                # Static assets
│   │   ├── index.html        # HTML template
│   │   ├── manifest.json     # PWA manifest
│   │   └── *.png             # PWA icons and favicons
│   ├── src/                   # Source code
│   │   ├── pages/            # Page components
│   │   │   ├── _index.tsx           # Landing page
│   │   │   ├── CreateGroup.tsx      # Group creation
│   │   │   ├── GroupDashboard.tsx   # Main group view
│   │   │   ├── Groups.tsx           # My Groups list
│   │   │   ├── Members.tsx          # Member management
│   │   │   ├── AddExpense.tsx       # Add new expense
│   │   │   ├── EditExpense.tsx      # Edit existing expense
│   │   │   └── Debts.tsx            # Debt settlement view
│   │   ├── modals/           # Modal components
│   │   │   ├── welcome.tsx          # Welcome modal
│   │   │   ├── add-member.tsx       # Add member modal
│   │   │   ├── edit-member.tsx      # Edit member modal
│   │   │   ├── share-link.tsx       # Share group link modal
│   │   │   ├── split-types.tsx      # Split type info modal
│   │   │   └── simplification.tsx   # Debt simplification modal
│   │   ├── nav/              # Navigation components
│   │   │   ├── header.tsx           # Page header
│   │   │   ├── logo-header.tsx      # Logo header
│   │   │   ├── nav-bar.tsx          # Navigation bar
│   │   │   └── sig-footer.tsx       # Signature footer
│   │   ├── animations/       # Animation components
│   │   │   └── simplify-animation.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useGroupTracking.ts      # Track group visits
│   │   │   ├── useProtocolHandler.ts    # Handle freesplit:// protocol
│   │   │   └── useRobotsMeta.ts         # SEO meta tags
│   │   ├── services/         # API and utilities
│   │   │   ├── api.ts               # Backend API client
│   │   │   └── localStorage.ts      # Local storage wrapper
│   │   ├── utils/            # Utility functions
│   │   │   └── format.ts            # Formatting helpers
│   │   ├── styles/           # CSS stylesheets
│   │   │   ├── global.css           # Global styles
│   │   │   ├── components.css       # Component styles
│   │   │   ├── tokens.css           # Design tokens
│   │   │   └── *.css                # Feature-specific styles
│   │   ├── images/           # Image assets
│   │   │   └── FreeSplit*.svg       # Logo variants
│   │   ├── App.tsx           # Main app component
│   │   ├── index.tsx         # Application entry point
│   │   └── serviceWorkerRegistration.ts  # PWA service worker
│   ├── package.json           # npm dependencies
│   ├── tsconfig.json         # TypeScript configuration
│   ├── tailwind.config.js    # Tailwind CSS configuration
│   ├── Dockerfile            # Frontend Docker configuration
│   └── README.md             # Frontend-specific documentation
│
├── data/                      # Database persistence (generated)
├── logs/                      # Application logs (generated)
├── docker-compose.yml         # Docker Compose configuration
├── setup.sh                   # Setup script
├── start.sh                   # Start script (local)
├── stop.sh                    # Stop script (local)
├── start-docker.sh            # Start script (Docker)
├── stop-docker.sh             # Stop script (Docker)
├── view-logs.sh               # View local logs
├── logs-docker.sh             # View Docker logs
├── README.md                  # Main project README
├── DEVELOPMENT.md             # This file
├── DEPLOYMENT.md              # Deployment guide
└── LICENSE                    # MIT License
```

## ⚙️ Setup Instructions

### Option 1: Docker Setup (Recommended for Quick Start)

Docker provides a consistent, isolated environment and is the easiest way to get started.

**1. Install Docker**

- **macOS**: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- **Windows**: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
- **Linux**: [Docker Engine](https://docs.docker.com/engine/install/)

**2. Clone and Start**

```bash
# Clone the repository
git clone https://github.com/tmfrsyth/freesplit.git
cd freesplit

# Start with Docker (builds and runs everything)
./start-docker.sh

# Or run in foreground to see logs
./start-docker.sh --foreground
```

**3. Access the Application**

- Frontend: http://localhost:3001
- Backend API: http://localhost:8080
- Database: Persisted in Docker volume

**4. Stop the Application**

```bash
./stop-docker.sh
```

**Docker Commands Reference:**

```bash
# View logs
./logs-docker.sh
# or
docker-compose logs -f

# Rebuild after code changes
docker-compose up --build -d

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (deletes database)
docker-compose down -v

# View running containers
docker-compose ps

# Access backend shell
docker-compose exec backend sh

# Access frontend shell
docker-compose exec frontend sh
```

### Option 2: Local Setup (Recommended for Active Development)

Local setup gives you faster iteration times and direct access to logs and debugging.

**1. Install Prerequisites**

**Go Installation:**
```bash
# macOS
brew install go

# Windows (with Chocolatey)
choco install golang

# Linux
sudo apt install golang-go
# or download from https://golang.org/dl/

# Verify installation
go version  # Should show Go 1.21 or higher
```

**Node.js Installation:**
```bash
# macOS
brew install node

# Windows (with Chocolatey)
choco install nodejs

# Linux
sudo apt install nodejs npm
# or download from https://nodejs.org/

# Verify installation
node --version  # Should show v16 or higher
npm --version   # Should show v8 or higher
```

**2. Clone and Setup**

```bash
# Clone the repository
git clone https://github.com/tmfrsyth/freesplit.git
cd freesplit

# Run setup script (installs dependencies)
./setup.sh
```

The setup script will:
- Check for required dependencies (Go, Node.js, npm, PostgreSQL)
- Install frontend npm packages
- Install backend Go modules
- Create PostgreSQL database and user
- Set up proper PATH variables

**3. Start the Application**

```bash
# Start both frontend and backend
./start.sh
```

This will:
- Start the backend Go server on port 8080
- Start the frontend React dev server on port 3001
- Create log files in `logs/` directory

**4. Access the Application**

- Frontend: http://localhost:3001
- Backend API: http://localhost:8080
- Database: `freesplit` database in PostgreSQL (localhost:5432)

**5. Stop the Application**

```bash
./stop.sh
```

**Manual Start (Alternative):**

If you prefer to run services individually:

```bash
# Terminal 1 - Backend
cd backend
go run rest_server.go

# Terminal 2 - Frontend
cd frontend
npm start
```

## 💻 Development Workflow

### Backend Development

**File Structure:**
- `rest_server.go` - Main server, routes, and HTTP handlers
- `internal/database/models.go` - Database schema (GORM models)
- `internal/services/` - Business logic implementations

**Adding a New Feature:**

1. **Define the data type** in `internal/services/types.go`:
```go
type NewFeature struct {
    ID        uint      `json:"id"`
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at"`
}
```

2. **Add interface method** in `internal/services/interfaces.go`:
```go
type NewFeatureService interface {
    CreateNewFeature(data NewFeature) (*NewFeature, error)
    GetNewFeature(id uint) (*NewFeature, error)
}
```

3. **Implement the service** in `internal/services/new_feature_service.go`:
```go
func (s *service) CreateNewFeature(data NewFeature) (*NewFeature, error) {
    // Implementation
}
```

4. **Add REST endpoint** in `rest_server.go`:
```go
http.HandleFunc("/api/new-feature", handleNewFeature)
```

5. **Update API documentation** in `backend/README.md`

**Database Migrations:**

The database schema is automatically migrated on server start. To modify:

1. Update models in `internal/database/models.go`
2. Restart the server - GORM will auto-migrate
3. For complex migrations, add migration logic in the `Migrate()` function

**Running Tests:**

```bash
cd backend/internal/tests
go test -v
```

### Frontend Development

**File Structure:**
- `src/pages/` - Page-level components
- `src/modals/` - Modal components
- `src/services/api.ts` - API client
- `src/hooks/` - Custom React hooks

**Adding a New Page:**

1. **Create page component** in `src/pages/NewPage.tsx`:
```typescript
import React from 'react';

const NewPage: React.FC = () => {
  return (
    <div>
      <h1>New Page</h1>
    </div>
  );
};

export default NewPage;
```

2. **Add route** in `src/App.tsx`:
```typescript
<Route path="/new-page" element={<NewPage />} />
```

3. **Add API method** in `src/services/api.ts` if needed:
```typescript
export const getNewData = async (): Promise<NewData> => {
  const response = await api.get('/api/new-endpoint');
  return response.data;
};
```

**Styling:**

FreeSplit uses Tailwind CSS for styling:

```typescript
// Use Tailwind utility classes
<button className="btn btn-primary">
  Click Me
</button>

// Custom styles in src/styles/
import '../styles/custom-component.css';
```

**State Management:**

Uses React hooks for state:

```typescript
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchData();
}, []);
```

**Testing Frontend:**

```bash
cd frontend
npm test
```

### Code Style Guidelines

**Backend (Go):**
- Follow standard Go formatting (`gofmt`)
- Use meaningful variable names
- Add comments for exported functions
- Keep functions focused and small
- Handle errors explicitly

**Frontend (TypeScript/React):**
- Use functional components with hooks
- TypeScript interfaces for all props
- Meaningful component and variable names
- Keep components focused (single responsibility)
- Use custom hooks for reusable logic

**Commit Messages:**
```
feat: Add new feature
fix: Fix bug in component
docs: Update documentation
refactor: Refactor code structure
test: Add tests for feature
style: Fix formatting
```

## 🔧 Helper Scripts

### Local Development Scripts

#### `./setup.sh`

Initial setup script that prepares your development environment.

**Usage:**
```bash
./setup.sh
```

**What it does:**
- Checks for required dependencies (Go, Node.js, npm)
- Installs frontend npm packages (`npm install`)
- Installs backend Go modules (`go mod tidy`)
- Creates `data/` directory for database persistence
- Sets up PATH variables for Go and PostgreSQL (if applicable)

**Flags:**
- `--local` or `-l` - Explicitly use local setup mode
- No flags - Default to Docker setup mode

#### `./start.sh`

Starts both backend and frontend servers for local development.

**Usage:**
```bash
./start.sh
```

**What it does:**
- Sets up PATH variables for Go and PostgreSQL
- Detects local IP address for network access
- Installs missing dependencies automatically (on macOS/Linux)
- Starts Go backend server on port 8080
- Starts React frontend dev server on port 3001
- Creates logs in `logs/backend.log` and `logs/frontend.log`

**Access URLs:**
- Frontend: http://localhost:3001
- Backend: http://localhost:8080

**Notes:**
- Processes run in background
- Logs are written to `logs/` directory
- Use `./view-logs.sh` to view logs
- Use `./stop.sh` to stop servers

#### `./stop.sh`

Stops all locally running FreeSplit servers.

**Usage:**
```bash
./stop.sh
```

**What it does:**
- Kills processes on port 8080 (backend)
- Kills processes on port 3000 (frontend)
- Kills any remaining `rest_server` processes
- Kills any remaining `react-scripts` processes

#### `./view-logs.sh`

View logs from locally running servers.

**Usage:**
```bash
# Show help
./view-logs.sh

# View backend logs
./view-logs.sh backend

# View frontend logs
./view-logs.sh frontend

# View all logs
./view-logs.sh all
```

**What it does:**
- Displays contents of log files
- Shows available log files
- Provides usage instructions

**Log locations:**
- `logs/backend.log` - Backend server logs
- `logs/frontend.log` - Frontend dev server logs

### Docker Scripts

#### `./start-docker.sh`

Starts FreeSplit using Docker Compose.

**Usage:**
```bash
# Start in background
./start-docker.sh

# Start in foreground (see logs)
./start-docker.sh --foreground
./start-docker.sh -f
```

**What it does:**
- Detects local IP address
- Builds Docker images (if needed)
- Starts all containers in detached mode (default)
- Shows logs in real-time (with `--foreground`)

**Access URLs:**
- Frontend: http://localhost:3001
- Backend: http://localhost:8080

**Flags:**
- `--foreground` or `-f` - Run in foreground with live logs

#### `./stop-docker.sh`

Stops all Docker containers.

**Usage:**
```bash
./stop-docker.sh
```

**What it does:**
- Stops all Docker Compose services
- Containers are stopped but not removed
- Data is preserved in Docker volumes

#### `./logs-docker.sh`

View logs from Docker containers.

**Usage:**
```bash
./logs-docker.sh
```

**What it does:**
- Shows access URLs
- Streams logs from all containers
- Use Ctrl+C to exit (containers keep running)

## 🧪 Testing

### Backend Tests

```bash
# Run all tests
cd backend/internal/tests
go test -v

# Run specific test
go test -v -run TestDebtSimplification

# Run with coverage
go test -v -cover

# Run with coverage report
go test -v -coverprofile=coverage.out
go tool cover -html=coverage.out
```

**Test Files:**
- `backend/internal/tests/debt_service_test.go` - Debt calculation and simplification tests

### Frontend Tests

```bash
# Run all tests
cd frontend
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- AddExpense.test.tsx
```

**Writing Tests:**

**Backend:**
```go
func TestNewFeature(t *testing.T) {
    // Setup
    service := NewService(db)
    
    // Test
    result, err := service.NewFeature()
    
    // Assert
    if err != nil {
        t.Errorf("Expected no error, got %v", err)
    }
    if result == nil {
        t.Error("Expected result, got nil")
    }
}
```

**Frontend:**
```typescript
import { render, screen } from '@testing-library/react';
import NewComponent from './NewComponent';

test('renders component', () => {
  render(<NewComponent />);
  const element = screen.getByText(/expected text/i);
  expect(element).toBeInTheDocument();
});
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Getting Started

1. **Fork the repository**
2. **Clone your fork**:
```bash
git clone https://github.com/YOUR_USERNAME/freesplit.git
cd freesplit
```

3. **Create a feature branch**:
```bash
git checkout -b feature/your-feature-name
```

4. **Make your changes**

5. **Test your changes**:
```bash
# Backend tests
cd backend/internal/tests && go test -v

# Frontend tests
cd frontend && npm test
```

6. **Commit your changes**:
```bash
git add .
git commit -m "feat: Add your feature description"
```

7. **Push to your fork**:
```bash
git push origin feature/your-feature-name
```

8. **Create a Pull Request**

### Pull Request Guidelines

- **Clear description** - Explain what your PR does and why
- **Tests** - Add tests for new features
- **Documentation** - Update relevant docs
- **Code style** - Follow existing patterns
- **Small PRs** - Keep changes focused
- **Commit messages** - Use conventional commit format

### Areas for Contribution

**Good First Issues:**
- Add new emoji options
- Improve error messages
- Add loading states
- Enhance mobile responsiveness
- Add keyboard shortcuts

**Feature Contributions:**
- Export/import functionality
- Receipt photo uploads
- Expense categories
- Currency conversion
- Recurring expenses
- Dark mode

**Bug Fixes:**
- Check the [Issues](https://github.com/tmfrsyth/freesplit/issues) page
- Reproduce the bug
- Create a failing test
- Fix the bug
- Verify the test passes

### Development Tips

**Backend:**
- Use `fmt.Println()` for quick debugging
- Check logs in `logs/backend.log`
- Test API endpoints with curl or Postman

**Frontend:**
- Use React DevTools browser extension
- Check console for errors
- Use `console.log()` sparingly
- Test on mobile viewport

**Database:**
```bash
# Access PostgreSQL database
psql -U postgres -d freesplit

# Useful commands
\dt              # List tables
\d groups        # Show table schema
SELECT * FROM groups;  # Query data
\q               # Quit
```

### Code Review Process

1. Maintainers will review your PR
2. Address any feedback
3. Once approved, your PR will be merged
4. Your contribution will be credited

## 📚 Additional Resources

- [Go Documentation](https://golang.org/doc/)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Frontend Not Loading:**
```bash
# Clear npm cache
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Backend Not Starting:**
```bash
# Clear Go cache
cd backend
go clean -modcache
go mod tidy
```

**Database Issues:**
```bash
# Reset database (WARNING: Deletes all data)
dropdb -U postgres freesplit
createdb -U postgres freesplit
# Restart server to run migrations
```

**Docker Issues:**
```bash
# Rebuild containers
docker-compose down
docker-compose up --build -d

# View logs
docker-compose logs -f

# Clean everything (nuclear option)
docker-compose down -v
docker system prune -a
```

## 📧 Getting Help

- **Issues**: [GitHub Issues](https://github.com/tmfrsyth/freesplit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tmfrsyth/freesplit/discussions)

---

**Happy Coding! 🚀**

