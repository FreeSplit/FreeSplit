# Backend Tests

This directory contains unit tests for the FreeSplit backend services.

## Test Structure

- **`debt_service_test.go`** - Comprehensive unit tests for the debt service
  - Tests all debt service functions with clear, descriptive names
  - Uses in-memory SQLite database for fast, isolated testing
  - Covers both success and error scenarios

## Running Tests

```bash
# Run all tests
go test ./internal/tests/ -v

# Run specific test file
go test ./internal/tests/debt_service_test.go -v

# Run with coverage
go test ./internal/tests/ -v -cover
```

## Test Dependencies

- **`gorm.io/driver/sqlite`** - In-memory SQLite database for testing
- **`github.com/stretchr/testify`** - Assertion library for cleaner test code

- ✅ Edge cases and boundary conditions

## Adding New Tests

When adding new service tests:

1. Create test file: `{service_name}_test.go`
2. Use descriptive test names: `TestFunctionName_ExpectedBehavior`
3. Follow the Arrange-Act-Assert pattern
4. Use `setupTestDB()` for database setup
5. Clean up test data between tests
6. Test both success and error scenarios
