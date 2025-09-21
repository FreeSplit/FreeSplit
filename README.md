# FreeSplit

A simple, self-hosted expense splitting application that makes it easy to track and split expenses among friends, family, or any group. Built with Go (REST API backend) and React (PWA frontend), designed to be easily deployed and self-hosted.

## What is FreeSplit?

FreeSplit is a modern expense splitting application that eliminates the hassle of manually calculating who owes what. Whether you're splitting a dinner bill, managing shared household expenses, or organizing group trips, FreeSplit provides an intuitive interface to track expenses, calculate splits, and simplify debts.

The application generates unique shareable links for each group, allowing multiple people to add expenses and view balances without requiring accounts or logins. All data is stored locally, giving you complete control over your financial information.

## Features

### MVP Features
- ✅ Create groups with auto-generated unique links
- ✅ Add/edit/delete expenses with detailed tracking
- ✅ Add/edit/delete group members
- ✅ Multiple split types: Equal, Amount, Share, and Percentage
- ✅ Calculate balances per member
- ✅ Simplify debts (minimize number of transactions)
- ✅ Shareable links (multi-user editing, no login required)
- ✅ Persistence with SQLite database
- ✅ Unlimited expenses, completely ad-free
- ✅ Spending totals (group + per member)
- ✅ Real-time debt calculations
- ✅ Responsive Progressive Web App (PWA)

### Future Enhancement Ideas
- Categorize expenses with custom categories
- Receipt photo uploads and storage
- Payment requests and reminders
- Currency converter for international groups
- Export/import to CSV/Excel
- Recurring transactions for subscriptions
- Multi-language support
- Mobile offline entry of expenses



## Technologies Used

- **Backend**: Go with REST API
- **Frontend**: React with TypeScript
- **Database**: SQLite
- **Deployment**: Docker containers
- **Communication**: HTTP REST API for frontend-backend communication
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/tmfrsyth/freesplit.git
cd freesplit
```

2. Run the setup script:
```bash
chmod +x setup.sh
./setup.sh
```

3. Start the application:
```bash
./start.sh
```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

### Manual Setup

#### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install Go dependencies:
```bash
go mod tidy
```

3. Run the backend:
```bash
go run rest_server.go
```

#### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## Starting and Stopping the Project

### Start the Application
```bash
./start.sh
```

This script will:
- Start the backend server on port 8080
- Start the frontend development server on port 3000
- Display helpful information about accessing the application

### Stop the Application
```bash
./stop.sh
```

This script will:
- Stop the backend server
- Stop the frontend development server
- Clean up any running processes

### Individual Services

To start only the backend:
```bash
cd backend && go run rest_server.go
```

To start only the frontend:
```bash
cd frontend && npm start
```

## Development

### Backend Development

The backend uses Go modules with a clean REST API architecture. Key files:
- `rest_server.go` - REST API server entry point
- `internal/database/models.go` - Database models and migrations
- `internal/services/` - Business logic service implementations

### Frontend Development

The frontend is a React PWA with TypeScript. Key files:
- `src/App.tsx` - Main application component
- `src/pages/` - Page components
- `src/services/api.ts` - API client
- `public/manifest.json` - PWA manifest

### Adding New Features

1. Define new data types in `internal/services/types.go`
2. Add service methods to the appropriate interface in `internal/services/interfaces.go`
3. Implement the service methods in `internal/services/`
4. Add REST endpoints in `rest_server.go`
5. Update the frontend API client in `src/services/api.ts`
6. Add UI components in `src/pages/`

## Deployment

### Docker Deployment

1. Build and run with Docker Compose:
```bash
docker-compose up --build
```

2. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

### Self-Hosting

The application is designed to be easily self-hosted. Simply run the setup script and start the services on your preferred server.

## Authors

- **Thomas Forsyth** - *Team Captain: Initial work and architecture* - [tmfrsyth](https://github.com/tmfrsyth)
- **Kris Sousa** - *Code Monkey: Development and implementation* - [KMFSousa](https://github.com/KMFSousa)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions, please create an issue in the repository.