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
	if err := s.db.Where("group_id = ?", req.GroupId).Find(&debts).Error; err != nil {
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

// UpdateDebtPaidAmount records a payment for a specific debt and returns updated debt information.
// Input: UpdateDebtPaidAmountRequest with DebtId and PaidAmount
// Output: UpdateDebtPaidAmountResponse with updated debt information
// Description: Records payment in history and returns current debt with net amount calculated
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

	// Record the payment in the payments table
	payment := database.Payment{
		GroupID: debt.GroupID,
		PayerID: debt.DebtorID,
		PayeeID: debt.LenderID,
		Amount:  req.PaidAmount,
	}
	if err := s.db.Create(&payment).Error; err != nil {
		return nil, fmt.Errorf("failed to record payment: %v", err)
	}

	// Calculate net amount (debt_amount - total_payments)
	var totalPaid float64
	s.db.Model(&database.Payment{}).
		Where("group_id = ? AND payer_id = ? AND payee_id = ?", debt.GroupID, debt.DebtorID, debt.LenderID).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalPaid)

	// Create response with net amount
	responseDebt := &Debt{
		Id:         int32(debt.ID),
		GroupId:    int32(debt.GroupID),
		LenderId:   int32(debt.LenderID),
		DebtorId:   int32(debt.DebtorID),
		DebtAmount: debt.DebtAmount,
		PaidAmount: totalPaid,
	}

	return &UpdateDebtPaidAmountResponse{
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
