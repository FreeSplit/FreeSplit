package services

import (
	"context"
	"fmt"

	"freesplit/internal/database"

	"gorm.io/gorm"
)

type expenseService struct {
	db *gorm.DB
}

func NewExpenseService(db *gorm.DB) ExpenseService {
	return &expenseService{db: db}
}

func (s *expenseService) GetExpensesByGroup(ctx context.Context, req *GetExpensesByGroupRequest) (*GetExpensesByGroupResponse, error) {
	var expenses []database.Expense
	if err := s.db.Where("group_id = ?", req.GroupId).Order("created_at DESC").Find(&expenses).Error; err != nil {
		return nil, fmt.Errorf("failed to get expenses: %v", err)
	}

	responseExpenses := make([]*Expense, len(expenses))
	for i, e := range expenses {
		responseExpenses[i] = ExpenseFromDB(&e)
	}

	return &GetExpensesByGroupResponse{
		Expenses: responseExpenses,
	}, nil
}

func (s *expenseService) GetExpenseWithSplits(ctx context.Context, req *GetExpenseWithSplitsRequest) (*GetExpenseWithSplitsResponse, error) {
	var expense database.Expense
	if err := s.db.First(&expense, req.ExpenseId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("expense not found")
		}
		return nil, fmt.Errorf("failed to get expense: %v", err)
	}

	var splits []database.Split
	if err := s.db.Where("expense_id = ?", req.ExpenseId).Find(&splits).Error; err != nil {
		return nil, fmt.Errorf("failed to get splits: %v", err)
	}

	responseSplits := make([]*Split, len(splits))
	for i, s := range splits {
		responseSplits[i] = SplitFromDB(&s)
	}

	return &GetExpenseWithSplitsResponse{
		Expense: ExpenseFromDB(&expense),
		Splits:  responseSplits,
	}, nil
}

func (s *expenseService) CreateExpense(ctx context.Context, req *CreateExpenseRequest) (*CreateExpenseResponse, error) {
	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Create expense
	expense := database.Expense{
		Name:      req.Expense.Name,
		Cost:      req.Expense.Cost,
		Emoji:     req.Expense.Emoji,
		PayerID:   uint(req.Expense.PayerId),
		SplitType: req.Expense.SplitType,
		GroupID:   uint(req.Expense.GroupId),
	}

	if err := tx.Create(&expense).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create expense: %v", err)
	}

	// Create splits
	var splits []database.Split
	for _, split := range req.Splits {
		splitRecord := database.Split{
			GroupID:       uint(split.GroupId),
			ExpenseID:     expense.ID,
			ParticipantID: uint(split.ParticipantId),
			SplitAmount:   split.SplitAmount,
		}
		splits = append(splits, splitRecord)
	}

	if err := tx.Create(&splits).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create splits: %v", err)
	}

	// Calculate and update simplified debts
	if err := s.calculateSimplifiedDebts(tx, expense.GroupID); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to calculate debts: %v", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	// Convert to response types
	responseSplits := make([]*Split, len(splits))
	for i, s := range splits {
		responseSplits[i] = SplitFromDB(&s)
	}

	return &CreateExpenseResponse{
		Expense: ExpenseFromDB(&expense),
		Splits:  responseSplits,
	}, nil
}

func (s *expenseService) UpdateExpense(ctx context.Context, req *UpdateExpenseRequest) (*UpdateExpenseResponse, error) {
	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Update expense
	expense := database.Expense{
		ID:        uint(req.Expense.Id),
		Name:      req.Expense.Name,
		Cost:      req.Expense.Cost,
		Emoji:     req.Expense.Emoji,
		PayerID:   uint(req.Expense.PayerId),
		SplitType: req.Expense.SplitType,
		GroupID:   uint(req.Expense.GroupId),
	}

	if err := tx.Save(&expense).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update expense: %v", err)
	}

	// Delete existing splits
	if err := tx.Where("expense_id = ?", expense.ID).Delete(&database.Split{}).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to delete existing splits: %v", err)
	}

	// Create new splits
	var splits []database.Split
	for _, split := range req.Splits {
		splitRecord := database.Split{
			GroupID:       uint(split.GroupId),
			ExpenseID:     expense.ID,
			ParticipantID: uint(split.ParticipantId),
			SplitAmount:   split.SplitAmount,
		}
		splits = append(splits, splitRecord)
	}

	if err := tx.Create(&splits).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create splits: %v", err)
	}

	// Calculate and update simplified debts
	if err := s.calculateSimplifiedDebts(tx, expense.GroupID); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to calculate debts: %v", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	// Convert to response types
	responseSplits := make([]*Split, len(splits))
	for i, s := range splits {
		responseSplits[i] = SplitFromDB(&s)
	}

	return &UpdateExpenseResponse{
		Expense: ExpenseFromDB(&expense),
		Splits:  responseSplits,
	}, nil
}

func (s *expenseService) DeleteExpense(ctx context.Context, req *DeleteExpenseRequest) error {
	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Get expense to find group ID
	var expense database.Expense
	if err := tx.First(&expense, req.ExpenseId).Error; err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("expense not found")
		}
		return fmt.Errorf("failed to get expense: %v", err)
	}

	// Delete splits
	if err := tx.Where("expense_id = ?", req.ExpenseId).Delete(&database.Split{}).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete splits: %v", err)
	}

	// Delete expense
	if err := tx.Delete(&expense).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete expense: %v", err)
	}

	// Calculate and update simplified debts
	if err := s.calculateSimplifiedDebts(tx, expense.GroupID); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to calculate debts: %v", err)
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit transaction: %v", err)
	}

	return nil
}

// calculateSimplifiedDebts implements the debt simplification algorithm
func (s *expenseService) calculateSimplifiedDebts(tx *gorm.DB, groupID uint) error {
	// Get all participants in the group
	var participants []database.Participant
	if err := tx.Where("group_id = ?", groupID).Find(&participants).Error; err != nil {
		return err
	}

	// Calculate net balances for each participant
	balances := make(map[uint]float64)
	for _, participant := range participants {
		balances[participant.ID] = 0
	}

	// Get all expenses for the group
	var expenses []database.Expense
	if err := tx.Where("group_id = ?", groupID).Find(&expenses).Error; err != nil {
		return err
	}

	// Calculate balances based on expenses and splits
	for _, expense := range expenses {
		// Add the full amount to the payer's balance (they paid for it)
		balances[expense.PayerID] += expense.Cost

		// Get splits for this expense
		var splits []database.Split
		if err := tx.Where("expense_id = ?", expense.ID).Find(&splits).Error; err != nil {
			return err
		}

		// Subtract each participant's share from their balance
		for _, split := range splits {
			balances[split.ParticipantID] -= split.SplitAmount
		}
	}

	// Clear existing debts for this group
	if err := tx.Where("group_id = ?", groupID).Delete(&database.Debt{}).Error; err != nil {
		return err
	}

	// Create creditors and debtors lists
	var creditors []struct {
		ID      uint
		Balance float64
	}
	var debtors []struct {
		ID      uint
		Balance float64
	}

	for participantID, balance := range balances {
		if balance > 0.01 { // They are owed money (creditor)
			creditors = append(creditors, struct {
				ID      uint
				Balance float64
			}{ID: participantID, Balance: balance})
		} else if balance < -0.01 { // They owe money (debtor)
			debtors = append(debtors, struct {
				ID      uint
				Balance float64
			}{ID: participantID, Balance: -balance}) // Make positive for easier calculation
		}
	}

	// Simplify debts using greedy algorithm
	creditorIdx := 0
	debtorIdx := 0

	for creditorIdx < len(creditors) && debtorIdx < len(debtors) {
		creditor := &creditors[creditorIdx]
		debtor := &debtors[debtorIdx]

		// Determine the amount to settle
		settleAmount := creditor.Balance
		if debtor.Balance < settleAmount {
			settleAmount = debtor.Balance
		}

		// Create debt record
		debt := database.Debt{
			GroupID:    groupID,
			LenderID:   creditor.ID,
			DebtorID:   debtor.ID,
			DebtAmount: settleAmount,
			PaidAmount: 0,
		}

		if err := tx.Create(&debt).Error; err != nil {
			return err
		}

		// Update balances
		creditor.Balance -= settleAmount
		debtor.Balance -= settleAmount

		// Move to next creditor/debtor if current one is settled
		if creditor.Balance <= 0.01 {
			creditorIdx++
		}
		if debtor.Balance <= 0.01 {
			debtorIdx++
		}
	}

	return nil
}
