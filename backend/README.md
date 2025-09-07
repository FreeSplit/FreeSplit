# FreeSplit Backend

REST API backend for the FreeSplit expense splitting application, built with Go and SQLite.

## Overview

The backend provides a REST API that handles all the core functionality for expense splitting, including group management, participant management, expense tracking, and debt calculations. It uses SQLite for data persistence and provides a clean REST interface for the frontend.

## Database

The application uses SQLite as the primary database. The database file (`freesplit.db`) is created automatically when the server starts.

### Database Schema

The database consists of the following tables:

- **groups** - Stores group information
- **participants** - Stores group members
- **expenses** - Stores expense records
- **splits** - Stores how expenses are split among participants
- **debts** - Stores calculated debts between participants

### Accessing the Database

To access the SQLite database directly:

```bash
# Navigate to the backend directory
cd backend

# Open the database with sqlite3
sqlite3 freesplit.db

# List all tables
.tables

# View table schema
.schema groups
.schema participants
.schema expenses
.schema splits
.schema debts

# Query data
SELECT * FROM groups;
SELECT * FROM participants WHERE group_id = 1;
SELECT * FROM expenses WHERE group_id = 1;
SELECT * FROM splits WHERE expense_id = 1;
SELECT * FROM debts WHERE group_id = 1;

# Exit sqlite3
.quit
```

### Common Database Commands

```bash
# View all groups
SELECT id, name, currency, url_slug, created_at FROM groups;

# View participants for a specific group
SELECT p.id, p.name, p.group_id, g.name as group_name 
FROM participants p 
JOIN groups g ON p.group_id = g.id 
WHERE g.url_slug = 'your-group-slug';

# View expenses for a group
SELECT e.id, e.name, e.cost, e.emoji, e.split_type, e.created_at
FROM expenses e
JOIN groups g ON e.group_id = g.id
WHERE g.url_slug = 'your-group-slug'
ORDER BY e.created_at DESC;

# View splits for an expense
SELECT s.id, s.split_amount, p.name as participant_name
FROM splits s
JOIN participants p ON s.participant_id = p.id
WHERE s.expense_id = 1;

# View simplified debts
SELECT d.id, l.name as lender, b.name as borrower, d.debt_amount, d.paid_amount
FROM debts d
JOIN participants l ON d.lender_id = l.id
JOIN participants b ON d.borrower_id = b.id
WHERE d.group_id = 1;
```

## API Endpoints

### Group Management

#### GET /api/group/{url_slug}
Get group information and participants by URL slug.

**Parameters:**
- `url_slug` (path) - The unique URL slug for the group

**Response:**
```json
{
  "group": {
    "id": 1,
    "name": "Weekend Trip",
    "currency": "USD",
    "url_slug": "abc123",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "participants": [
    {
      "id": 1,
      "name": "John Doe",
      "group_id": 1
    }
  ]
}
```

#### POST /api/group
Create a new group with participants.

**Request Body:**
```json
{
  "name": "Weekend Trip",
  "currency": "USD",
  "participant_names": ["John Doe", "Jane Smith", "Bob Johnson"]
}
```

**Response:**
```json
{
  "group": {
    "id": 1,
    "name": "Weekend Trip",
    "currency": "USD",
    "url_slug": "abc123",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "participants": [
    {
      "id": 1,
      "name": "John Doe",
      "group_id": 1
    }
  ]
}
```

#### PUT /api/group/{url_slug}
Update group name and currency.

**Parameters:**
- `url_slug` (path) - The unique URL slug for the group

**Request Body:**
```json
{
  "name": "Updated Group Name",
  "currency": "EUR",
  "participant_id": 1
}
```

**Response:**
```json
{
  "group": {
    "id": 1,
    "name": "Updated Group Name",
    "currency": "EUR",
    "url_slug": "abc123",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Participant Management

#### POST /api/group/{url_slug}/participants
Add a new participant to the group.

**Parameters:**
- `url_slug` (path) - The unique URL slug for the group

**Request Body:**
```json
{
  "name": "New Member",
  "group_id": 1
}
```

**Response:**
```json
{
  "participant": {
    "id": 2,
    "name": "New Member",
    "group_id": 1
  }
}
```

#### PUT /api/participants/{participant_id}
Update participant name.

**Parameters:**
- `participant_id` (path) - The ID of the participant to update

**Request Body:**
```json
{
  "name": "Updated Name",
  "participant_id": 1
}
```

**Response:**
```json
{
  "participant": {
    "id": 1,
    "name": "Updated Name",
    "group_id": 1
  }
}
```

#### DELETE /api/participants/{participant_id}
Delete a participant from the group.

**Parameters:**
- `participant_id` (path) - The ID of the participant to delete

**Response:**
```json
{
  "message": "Participant deleted successfully"
}
```

### Expense Management

#### GET /api/group/{group_id}/expenses
Get all expenses for a group.

**Parameters:**
- `group_id` (path) - The ID of the group

**Response:**
```json
[
  {
    "id": 1,
    "name": "Dinner at Restaurant",
    "cost": 120.50,
    "emoji": "🍽️",
    "payer_id": 1,
    "split_type": "equal",
    "group_id": 1,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /api/group/{group_id}/expenses
Create a new expense.

**Parameters:**
- `group_id` (path) - The ID of the group

**Request Body:**
```json
{
  "expense": {
    "name": "Dinner at Restaurant",
    "cost": 120.50,
    "emoji": "🍽️",
    "payer_id": 1,
    "split_type": "equal",
    "group_id": 1
  },
  "splits": [
    {
      "participant_id": 1,
      "split_amount": 40.17
    },
    {
      "participant_id": 2,
      "split_amount": 40.17
    },
    {
      "participant_id": 3,
      "split_amount": 40.16
    }
  ]
}
```

**Response:**
```json
{
  "expense": {
    "id": 1,
    "name": "Dinner at Restaurant",
    "cost": 120.50,
    "emoji": "🍽️",
    "payer_id": 1,
    "split_type": "equal",
    "group_id": 1,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "splits": [
    {
      "id": 1,
      "group_id": 1,
      "expense_id": 1,
      "participant_id": 1,
      "split_amount": 40.17
    }
  ]
}
```

#### GET /api/expense/{expense_id}
Get expense details with splits.

**Parameters:**
- `expense_id` (path) - The ID of the expense

**Response:**
```json
{
  "expense": {
    "id": 1,
    "name": "Dinner at Restaurant",
    "cost": 120.50,
    "emoji": "🍽️",
    "payer_id": 1,
    "split_type": "equal",
    "group_id": 1,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "splits": [
    {
      "id": 1,
      "group_id": 1,
      "expense_id": 1,
      "participant_id": 1,
      "split_amount": 40.17
    }
  ]
}
```

#### PUT /api/expense/{expense_id}
Update an existing expense.

**Parameters:**
- `expense_id` (path) - The ID of the expense to update

**Request Body:**
```json
{
  "expense": {
    "id": 1,
    "name": "Updated Expense Name",
    "cost": 150.00,
    "emoji": "🍕",
    "payer_id": 2,
    "split_type": "amount",
    "group_id": 1
  },
  "splits": [
    {
      "participant_id": 1,
      "split_amount": 50.00
    },
    {
      "participant_id": 2,
      "split_amount": 100.00
    }
  ]
}
```

**Response:**
```json
{
  "expense": {
    "id": 1,
    "name": "Updated Expense Name",
    "cost": 150.00,
    "emoji": "🍕",
    "payer_id": 2,
    "split_type": "amount",
    "group_id": 1,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "splits": [
    {
      "id": 1,
      "group_id": 1,
      "expense_id": 1,
      "participant_id": 1,
      "split_amount": 50.00
    }
  ]
}
```

#### DELETE /api/expense/{expense_id}
Delete an expense.

**Parameters:**
- `expense_id` (path) - The ID of the expense to delete

**Response:**
```json
{
  "message": "Expense deleted successfully"
}
```

### Debt Management

#### GET /api/group/{group_id}/debts
Get simplified debts for a group.

**Parameters:**
- `group_id` (path) - The ID of the group

**Response:**
```json
[
  {
    "id": 1,
    "group_id": 1,
    "lender_id": 1,
    "borrower_id": 2,
    "debt_amount": 25.50,
    "paid_amount": 0.00
  }
]
```

#### PUT /api/debts/{debt_id}/paid
Update the paid amount for a debt.

**Parameters:**
- `debt_id` (path) - The ID of the debt to update

**Request Body:**
```json
{
  "debt_id": 1,
  "paid_amount": 10.00
}
```

**Response:**
```json
{
  "debt": {
    "id": 1,
    "group_id": 1,
    "lender_id": 1,
    "borrower_id": 2,
    "debt_amount": 25.50,
    "paid_amount": 10.00
  }
}
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid input)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

Error responses include a descriptive message:

```json
{
  "error": "Group not found"
}
```

## Development

### Running the Server

```bash
# Install dependencies
go mod tidy

# Run the server
go run rest_server.go
```

The server will start on port 8080 by default.

### Database Migrations

Database migrations are automatically run when the server starts. The migration creates all necessary tables and indexes.

### Adding New Endpoints

1. Define the endpoint in `rest_server.go`
2. Implement the business logic in the appropriate service file
3. Update the API documentation in this README

## Architecture

The backend follows a clean architecture pattern:

- **REST Layer** (`rest_server.go`) - HTTP handlers and request/response handling
- **Service Layer** (`internal/server/`) - Business logic and data processing
- **Data Layer** (`internal/database/`) - Database models and migrations
- **Protocol Buffers** (`proto/`) - Internal service communication

The REST API acts as a facade over the internal gRPC services, providing a clean HTTP interface while maintaining the benefits of gRPC for internal communication.
