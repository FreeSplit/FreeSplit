# FreeSplit

A simple, self-hosted expense splitting application similar to Splitwise. Built with Go (gRPC backend) and React (PWA frontend), designed to be easily deployed and self-hosted.

## Features

### MVP Features
- ✅ Create groups with auto-generated unique links
- ✅ Add/edit/delete expenses
- ✅ Add/edit/delete members
- ✅ Split expenses equally, by amount, or by shares/percentage
- ✅ Calculate balances per member
- ✅ Simplify debts (minimize number of transactions)
- ✅ Shareable links (multi-user editing, no login required)
- ✅ Cloud persistence (SQLite database)
- ✅ Unlimited expenses, ad-free
- ✅ Spending totals (group + per member)

### Future Features
- Categorize expenses (Food, Travel, etc.)
- Receipt photo uploads
- Payment requests / reminders
- Currency converter
- Export to CSV/Excel
- Import from CSV/Excel from Splitwise
- Recurring transactions
- Multi-language support
- Mobile offline entry

## Architecture

- **Backend**: Go with gRPC API
- **Frontend**: React with PWA capabilities
- **Database**: SQLite (easily replaceable)
- **Deployment**: Docker containers
- **Communication**: gRPC-Web for frontend-backend communication

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd freesplit
```

2. Start the application:
```bash
docker-compose up -d
```

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8081

### Manual Setup

#### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
go mod download
```

3. Generate protobuf files:
```bash
protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    proto/expense.proto
```

4. Run the backend:
```bash
go run main.go
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

## API Endpoints

The application provides the following gRPC services:

### Group Service
- `GetGroup` - Get group and participants by URL slug
- `CreateGroup` - Create a new group with participants
- `UpdateGroup` - Update group name and currency

### Participant Service
- `AddParticipant` - Add a new participant to a group
- `UpdateParticipant` - Update participant name
- `DeleteParticipant` - Remove participant from group

### Expense Service
- `GetExpensesByGroup` - Get all expenses for a group
- `GetSplitsByParticipant` - Get all splits for a participant
- `GetExpenseWithSplits` - Get expense details with splits
- `CreateExpense` - Create a new expense with splits
- `UpdateExpense` - Update an existing expense
- `DeleteExpense` - Delete an expense

### Debt Service
- `GetDebts` - Get simplified debts for a group
- `UpdateDebtPaidAmount` - Update debt payment status

## Database Schema

### Groups
- ID, URL slug, Name, Settle-up date, State, Currency
- References to participants and expenses

### Participants
- ID, Name, Group ID
- Unique constraint on name + group ID

### Expenses
- ID, Name, Cost, Emoji, Payer ID, Split type, Group ID
- References to splits

### Splits
- Split ID, Group ID, Expense ID, Participant ID, Split amount

### Debts
- Debt ID, Group ID, Lender ID, Debtor ID, Debt amount, Paid amount
- Unique constraint on group + lender + debtor

## Debt Simplification Algorithm

The application uses a greedy algorithm to minimize the number of transactions needed to settle all debts:

1. Calculate net balance for each participant
2. Separate creditors (negative balance) and debtors (positive balance)
3. Use greedy matching to create simplified debts
4. Only create debts for amounts > $0.01 to avoid floating-point issues

## Development

### Backend Development

The backend uses Go modules and gRPC. Key files:
- `main.go` - Application entry point
- `proto/expense.proto` - gRPC service definitions
- `internal/database/models.go` - Database models
- `internal/server/` - gRPC service implementations

### Frontend Development

The frontend is a React PWA with TypeScript. Key files:
- `src/App.tsx` - Main application component
- `src/pages/` - Page components
- `src/services/api.ts` - API client
- `public/manifest.json` - PWA manifest

### Adding New Features

1. Update the protobuf schema in `proto/expense.proto`
2. Regenerate Go code: `protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative proto/expense.proto`
3. Implement the gRPC service in `internal/server/`
4. Update the frontend API client in `src/services/api.ts`
5. Add UI components in `src/pages/`

## Deployment

### Docker Deployment

The application is designed to be easily deployed using Docker:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Considerations

1. **Database**: Consider using PostgreSQL or MySQL for production
2. **Security**: Add authentication and authorization
3. **Monitoring**: Add logging and metrics
4. **Backup**: Implement database backup strategy
5. **SSL**: Use HTTPS in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions, please create an issue in the repository.