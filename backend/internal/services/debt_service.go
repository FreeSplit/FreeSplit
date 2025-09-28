package services

import (
	"context"
	"fmt"

	"freesplit/internal/database"

	"gorm.io/gorm"
)

type debtService struct {
	db *gorm.DB
}

// NewDebtService creates a new instance of the debt service with database connection.
// Input: gorm.DB database connection
// Output: DebtService interface implementation
// Description: Initializes debt service with database dependency injection
func NewDebtService(db *gorm.DB) DebtService {
	return &debtService{db: db}
}

// GetDebtsPageData retrieves optimized debt data for the debts page with resolved names and currency.
// Input: GetDebtsRequest containing either GroupId or UrlSlug
// Output: GetDebtsPageDataResponse with resolved debt data
// Description: Single query that joins debts with participants and group to get all needed data
func (s *debtService) GetDebtsPageData(ctx context.Context, req *GetDebtsRequest) (*GetDebtsPageDataResponse, error) {
	var groupID uint
	var currency string

	// Handle both GroupId and UrlSlug for backward compatibility
	if req.UrlSlug != "" {
		// Look up group by URL slug
		var group database.Group
		if err := s.db.Where("url_slug = ?", req.UrlSlug).First(&group).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, fmt.Errorf("group not found")
			}
			return nil, fmt.Errorf("failed to get group: %v", err)
		}
		groupID = group.ID
		currency = group.Currency
	} else if req.GroupId > 0 {
		groupID = uint(req.GroupId)
		// Get currency for the group
		var group database.Group
		if err := s.db.Where("id = ?", groupID).First(&group).Error; err != nil {
			return nil, fmt.Errorf("failed to get group: %v", err)
		}
		currency = group.Currency
	} else {
		return nil, fmt.Errorf("either group_id or url_slug must be provided")
	}

	// Single optimized query that joins debts with participants and gets all needed data
	var debtPageData []DebtPageData
	err := s.db.Table("debts").
		Select(`
			debts.id,
			debts.debt_amount,
			debtor.name as debtor_name,
			lender.name as lender_name,
			groups.currency
		`).
		Joins("JOIN participants as debtor ON debts.debtor_id = debtor.id").
		Joins("JOIN participants as lender ON debts.lender_id = lender.id").
		Joins("JOIN groups ON debts.group_id = groups.id").
		Where("debts.group_id = ?", groupID).
		Scan(&debtPageData).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get debt page data: %v", err)
	}

	// Convert to response format
	responseDebts := make([]*DebtPageData, len(debtPageData))
	for i, debt := range debtPageData {
		responseDebts[i] = &debt
	}

	return &GetDebtsPageDataResponse{
		Debts:    responseDebts,
		Currency: currency,
	}, nil
}

// CreatePayment records a payment and recalculates all debts for the group.
// Input: CreatePaymentRequest with DebtId and PaidAmount
// Output: CreatePaymentResponse with updated debt information
// Description: Creates a payment record, recalculates all debts, and returns updated debt
func (s *debtService) CreatePayment(ctx context.Context, req *CreatePaymentRequest) (*CreatePaymentResponse, error) {
	// Validate input
	if req.DebtId <= 0 {
		return nil, fmt.Errorf("invalid debt ID")
	}

	if req.PaidAmount < 0 {
		return nil, fmt.Errorf("paid amount cannot be negative")
	}

	var debt database.Debt
	if err := s.db.First(&debt, req.DebtId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("debt not found")
		}
		return nil, fmt.Errorf("failed to get debt: %v", err)
	}

	// Validate that paid amount doesn't exceed debt amount
	if req.PaidAmount > debt.DebtAmount {
		return nil, fmt.Errorf("paid amount (%.2f) cannot exceed debt amount (%.2f)", req.PaidAmount, debt.DebtAmount)
	}

	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Record the payment in the payments table
	payment := database.Payment{
		GroupID: debt.GroupID,
		PayerID: debt.DebtorID,
		PayeeID: debt.LenderID,
		Amount:  req.PaidAmount,
	}
	if err := tx.Create(&payment).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to record payment: %v", err)
	}

	// Recalculate and update all debts for the group
	if err := s.updateDebts(tx, debt.GroupID); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to recalculate debts: %v", err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	// Get the updated debt (it may have been modified or removed during recalculation)
	var updatedDebt database.Debt
	err := s.db.Where("group_id = ? AND lender_id = ? AND debtor_id = ?", debt.GroupID, debt.LenderID, debt.DebtorID).First(&updatedDebt).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Debt was fully settled and removed
			return &CreatePaymentResponse{
				Debt: nil,
			}, nil
		}
		return nil, fmt.Errorf("failed to get updated debt: %v", err)
	}

	// Create response with updated debt
	responseDebt := DebtFromDB(&updatedDebt)

	return &CreatePaymentResponse{
		Debt: responseDebt,
	}, nil
}

// GetPayments retrieves all payments for a specific group from the database.
// Input: GetPaymentsRequest containing GroupId
// Output: GetPaymentsResponse with list of payments
// Description: Fetches all payment records for a group
func (s *debtService) GetPayments(ctx context.Context, req *GetPaymentsRequest) (*GetPaymentsResponse, error) {
	var payments []database.Payment
	if err := s.db.Where("group_id = ?", req.GroupId).Find(&payments).Error; err != nil {
		return nil, fmt.Errorf("failed to get payments: %v", err)
	}

	responsePayments := make([]*Payment, len(payments))
	for i, p := range payments {
		responsePayments[i] = &Payment{
			Id:        int32(p.ID),
			GroupId:   int32(p.GroupID),
			PayerId:   int32(p.PayerID),
			PayeeId:   int32(p.PayeeID),
			Amount:    p.Amount,
			CreatedAt: p.CreatedAt,
		}
	}

	return &GetPaymentsResponse{
		Payments: responsePayments,
	}, nil
}

// updateDebts recalculates and updates debts in the database after payments
// Input: gorm.DB transaction and groupID
// Output: error if debt calculation fails
// Description: Calculates new debts using the improved algorithm and updates database
func (s *debtService) updateDebts(tx *gorm.DB, groupID uint) error {
	// Calculate new debts using the improved algorithm
	newDebts, err := CalculateNetDebts(tx, groupID)
	if err != nil {
		return err
	}

	// Clear existing debts
	if err := tx.Where("group_id = ?", groupID).Delete(&database.Debt{}).Error; err != nil {
		return err
	}

	// Create new debts
	for _, debt := range newDebts {
		if err := tx.Create(&debt).Error; err != nil {
			return err
		}
	}

	return nil
}
