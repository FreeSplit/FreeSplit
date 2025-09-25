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

func NewDebtService(db *gorm.DB) DebtService {
	return &debtService{db: db}
}

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

	debt.PaidAmount = req.PaidAmount
	if err := s.db.Save(&debt).Error; err != nil {
		return nil, fmt.Errorf("failed to update debt: %v", err)
	}

	return &UpdateDebtPaidAmountResponse{
		Debt: DebtFromDB(&debt),
	}, nil
}
