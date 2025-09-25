package tests

import (
	"context"
	"testing"

	"freesplit/internal/database"
	"freesplit/internal/services"

	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB() *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("Failed to connect to test database")
	}

	// Auto-migrate the database
	db.AutoMigrate(&database.Group{}, &database.Participant{}, &database.Expense{}, &database.Split{}, &database.Debt{}, &database.Payment{})

	return db
}

func TestGetDebts_ReturnsUnpaidDebtsForGroup(t *testing.T) {
	// Arrange
	db := setupTestDB()
	service := services.NewDebtService(db)
	ctx := context.Background()

	// Create test data
	group := database.Group{Name: "Test Group", URLSlug: "test-group"}
	db.Create(&group)

	participant1 := database.Participant{Name: "Alice", GroupID: group.ID}
	participant2 := database.Participant{Name: "Bob", GroupID: group.ID}
	db.Create(&participant1)
	db.Create(&participant2)

	// Create a debt
	debt := database.Debt{
		GroupID:    group.ID,
		LenderID:   participant1.ID,
		DebtorID:   participant2.ID,
		DebtAmount: 100.0,
		PaidAmount: 0.0,
	}
	db.Create(&debt)

	req := &services.GetDebtsRequest{GroupId: int32(group.ID)}

	// Act
	result, err := service.GetDebts(ctx, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 1, len(result.Debts))
	assert.Equal(t, 100.0, result.Debts[0].DebtAmount)
	assert.Equal(t, 0.0, result.Debts[0].PaidAmount)
}

func TestGetDebts_ExcludesFullyPaidDebts(t *testing.T) {
	// Arrange
	db := setupTestDB()
	service := services.NewDebtService(db)
	ctx := context.Background()

	// Create test data
	group := database.Group{Name: "Test Group", URLSlug: "test-group"}
	db.Create(&group)

	participant1 := database.Participant{Name: "Alice", GroupID: group.ID}
	participant2 := database.Participant{Name: "Bob", GroupID: group.ID}
	db.Create(&participant1)
	db.Create(&participant2)

	// Create a fully paid debt
	paidDebt := database.Debt{
		GroupID:    group.ID,
		LenderID:   participant1.ID,
		DebtorID:   participant2.ID,
		DebtAmount: 100.0,
		PaidAmount: 100.0,
	}
	db.Create(&paidDebt)

	// Create an unpaid debt
	unpaidDebt := database.Debt{
		GroupID:    group.ID,
		LenderID:   participant1.ID,
		DebtorID:   participant2.ID,
		DebtAmount: 50.0,
		PaidAmount: 0.0,
	}
	db.Create(&unpaidDebt)

	req := &services.GetDebtsRequest{GroupId: int32(group.ID)}

	// Act
	result, err := service.GetDebts(ctx, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 1, len(result.Debts))
	assert.Equal(t, 50.0, result.Debts[0].DebtAmount)
}

func TestUpdateDebtPaidAmount_UpdatesDebtWithValidAmount(t *testing.T) {
	// Arrange
	db := setupTestDB()
	service := services.NewDebtService(db)
	ctx := context.Background()

	// Create test data
	group := database.Group{Name: "Test Group", URLSlug: "test-group"}
	db.Create(&group)

	participant1 := database.Participant{Name: "Alice", GroupID: group.ID}
	participant2 := database.Participant{Name: "Bob", GroupID: group.ID}
	db.Create(&participant1)
	db.Create(&participant2)

	debt := database.Debt{
		GroupID:    group.ID,
		LenderID:   participant1.ID,
		DebtorID:   participant2.ID,
		DebtAmount: 100.0,
		PaidAmount: 0.0,
	}
	db.Create(&debt)

	req := &services.UpdateDebtPaidAmountRequest{DebtId: int32(debt.ID), PaidAmount: 50.0}

	// Act
	result, err := service.UpdateDebtPaidAmount(ctx, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 50.0, result.Debt.PaidAmount)

	// Verify payment was recorded
	var payment database.Payment
	db.Where("group_id = ? AND payer_id = ? AND payee_id = ?", group.ID, participant2.ID, participant1.ID).First(&payment)
	assert.Equal(t, 50.0, payment.Amount)
}

func TestUpdateDebtPaidAmount_ReturnsErrorForInvalidDebtId(t *testing.T) {
	// Arrange
	db := setupTestDB()
	service := services.NewDebtService(db)
	ctx := context.Background()
	req := &services.UpdateDebtPaidAmountRequest{DebtId: 0, PaidAmount: 50.0}

	// Act
	result, err := service.UpdateDebtPaidAmount(ctx, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "invalid debt ID")
}

func TestUpdateDebtPaidAmount_ReturnsErrorForNegativePaidAmount(t *testing.T) {
	// Arrange
	db := setupTestDB()
	service := services.NewDebtService(db)
	ctx := context.Background()
	req := &services.UpdateDebtPaidAmountRequest{DebtId: 1, PaidAmount: -10.0}

	// Act
	result, err := service.UpdateDebtPaidAmount(ctx, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "paid amount cannot be negative")
}

func TestUpdateDebtPaidAmount_ReturnsErrorWhenDebtNotFound(t *testing.T) {
	// Arrange
	db := setupTestDB()
	service := services.NewDebtService(db)
	ctx := context.Background()
	req := &services.UpdateDebtPaidAmountRequest{DebtId: 999, PaidAmount: 50.0}

	// Act
	result, err := service.UpdateDebtPaidAmount(ctx, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "debt not found")
}

func TestUpdateDebtPaidAmount_ReturnsErrorWhenPaidAmountExceedsDebtAmount(t *testing.T) {
	// Arrange
	db := setupTestDB()
	service := services.NewDebtService(db)
	ctx := context.Background()

	// Create test data
	group := database.Group{Name: "Test Group", URLSlug: "test-group"}
	db.Create(&group)

	participant1 := database.Participant{Name: "Alice", GroupID: group.ID}
	participant2 := database.Participant{Name: "Bob", GroupID: group.ID}
	db.Create(&participant1)
	db.Create(&participant2)

	debt := database.Debt{
		GroupID:    group.ID,
		LenderID:   participant1.ID,
		DebtorID:   participant2.ID,
		DebtAmount: 100.0,
		PaidAmount: 0.0,
	}
	db.Create(&debt)

	req := &services.UpdateDebtPaidAmountRequest{DebtId: int32(debt.ID), PaidAmount: 150.0}

	// Act
	result, err := service.UpdateDebtPaidAmount(ctx, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "paid amount (150.00) cannot exceed debt amount (100.00)")
}

func TestUpdateDebtPaidAmount_RecordsPaymentWhenAmountIncreases(t *testing.T) {
	// Arrange
	db := setupTestDB()
	service := services.NewDebtService(db)
	ctx := context.Background()

	// Create test data
	group := database.Group{Name: "Test Group", URLSlug: "test-group"}
	db.Create(&group)

	participant1 := database.Participant{Name: "Alice", GroupID: group.ID}
	participant2 := database.Participant{Name: "Bob", GroupID: group.ID}
	db.Create(&participant1)
	db.Create(&participant2)

	debt := database.Debt{
		GroupID:    group.ID,
		LenderID:   participant1.ID,
		DebtorID:   participant2.ID,
		DebtAmount: 100.0,
		PaidAmount: 25.0,
	}
	db.Create(&debt)

	req := &services.UpdateDebtPaidAmountRequest{DebtId: int32(debt.ID), PaidAmount: 50.0}

	// Act
	result, err := service.UpdateDebtPaidAmount(ctx, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)

	// Verify payment was recorded (50 - 25 = 25)
	var payment database.Payment
	db.Where("group_id = ? AND payer_id = ? AND payee_id = ?", group.ID, participant2.ID, participant1.ID).First(&payment)
	assert.Equal(t, 25.0, payment.Amount)
}

func TestUpdateDebtPaidAmount_DoesNotRecordPaymentWhenAmountDecreases(t *testing.T) {
	// Arrange
	db := setupTestDB()
	service := services.NewDebtService(db)
	ctx := context.Background()

	// Create test data
	group := database.Group{Name: "Test Group", URLSlug: "test-group"}
	db.Create(&group)

	participant1 := database.Participant{Name: "Alice", GroupID: group.ID}
	participant2 := database.Participant{Name: "Bob", GroupID: group.ID}
	db.Create(&participant1)
	db.Create(&participant2)

	debt := database.Debt{
		GroupID:    group.ID,
		LenderID:   participant1.ID,
		DebtorID:   participant2.ID,
		DebtAmount: 100.0,
		PaidAmount: 50.0,
	}
	db.Create(&debt)

	req := &services.UpdateDebtPaidAmountRequest{DebtId: int32(debt.ID), PaidAmount: 25.0}

	// Act
	result, err := service.UpdateDebtPaidAmount(ctx, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)

	// Verify no payment was recorded (25 - 50 = -25, which is negative)
	var paymentCount int64
	db.Model(&database.Payment{}).Where("group_id = ? AND payer_id = ? AND payee_id = ?", group.ID, participant2.ID, participant1.ID).Count(&paymentCount)
	assert.Equal(t, int64(0), paymentCount)
}
