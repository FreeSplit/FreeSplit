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

// GetDebts retrieves all unpaid debts for a specific group from the database.
// Input: GetDebtsRequest containing GroupId
// Output: GetDebtsResponse with list of debts where debt_amount > paid_amount
// Description: Fetches all outstanding debts for a group, excluding fully paid debts
func (s *debtService) GetDebts(ctx context.Context, req *GetDebtsRequest) (*GetDebtsResponse, error) {
	var debts []database.Debt
	if err := s.db.Where("group_id = ? AND debt_amount > paid_amount", req.GroupId).Find(&debts).Error; err != nil {
		return nil, fmt.Errorf("failed to get debts: %v", err)
	}

	responseDebts := make([]*Debt, len(debts))
	for i, d := range debts {
		responseDebts[i] = DebtFromDB(&d)
	}

	return &GetDebtsResponse{
		Debts: responseDebts,
	}, nil
}

// UpdateDebtPaidAmount updates the paid amount for a specific debt and records payment history.
// Input: UpdateDebtPaidAmountRequest with DebtId and PaidAmount
// Output: UpdateDebtPaidAmountResponse with updated debt information
// Description: Updates debt paid amount, validates input, and records payment in history
func (s *debtService) UpdateDebtPaidAmount(ctx context.Context, req *UpdateDebtPaidAmountRequest) (*UpdateDebtPaidAmountResponse, error) {
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

	// Calculate the payment amount (difference between old and new paid amount)
	paymentAmount := req.PaidAmount - debt.PaidAmount

	// Update the debt
	debt.PaidAmount = req.PaidAmount
	if err := s.db.Save(&debt).Error; err != nil {
		return nil, fmt.Errorf("failed to update debt: %v", err)
	}

	// Record the payment if there's a payment amount
	if paymentAmount > 0 {
		payment := database.Payment{
			GroupID: debt.GroupID,
			PayerID: debt.DebtorID,
			PayeeID: debt.LenderID,
			Amount:  paymentAmount,
		}
		if err := s.db.Create(&payment).Error; err != nil {
			// Log error but don't fail the debt update
			fmt.Printf("Warning: Failed to record payment: %v\n", err)
		}
	}

	return &UpdateDebtPaidAmountResponse{
		Debt: DebtFromDB(&debt),
	}, nil
}
