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

// NewExpenseService creates a new instance of the expense service with database connection.
// Input: gorm.DB database connection
// Output: ExpenseService interface implementation
// Description: Initializes expense service with database dependency injection
func NewExpenseService(db *gorm.DB) ExpenseService {
	return &expenseService{db: db}
}

// GetExpensesByGroup retrieves all expenses for a specific group ordered by creation date.
// Input: GetExpensesByGroupRequest containing GroupId
// Output: GetExpensesByGroupResponse with list of expenses
// Description: Fetches all expenses for a group in descending order by creation date
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

// GetSplitsByGroup retrieves all splits for a group with participant and payer names.
// This is used for animation purposes and is separate from debt settlement logic.
func (s *expenseService) GetSplitsByGroup(ctx context.Context, req *GetSplitsByGroupRequest) (*GetSplitsByGroupResponse, error) {
	var splitsWithNames []SplitWithNames

	// Join splits with participants, expenses, and groups to get names using urlSlug
	err := s.db.Table("splits").
		Select(`
			splits.id as split_id,
			splits.group_id,
			splits.expense_id,
			splits.participant_id,
			splits.split_amount,
			participant.name as participant_name,
			expenses.payer_id,
			payer.name as payer_name
		`).
		Joins("JOIN participants as participant ON splits.participant_id = participant.id").
		Joins("JOIN expenses ON splits.expense_id = expenses.id").
		Joins("JOIN participants as payer ON expenses.payer_id = payer.id").
		Joins("JOIN groups ON splits.group_id = groups.id").
		Where("groups.url_slug = ?", req.UrlSlug).
		Scan(&splitsWithNames).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get splits with names: %v", err)
	}

	responseSplits := make([]*SplitWithNames, len(splitsWithNames))
	for i, split := range splitsWithNames {
		responseSplits[i] = &split
	}

	return &GetSplitsByGroupResponse{
		Splits: responseSplits,
	}, nil
}

// CreateExpense creates a new expense with splits and recalculates group debts.
// Input: CreateExpenseRequest with expense and splits data
// Output: CreateExpenseResponse with created expense and splits
// Description: Creates expense, saves splits, and recalculates simplified debts for the group
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
	if err := s.updateDebts(tx, expense.GroupID); err != nil {
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

// UpdateExpense updates an existing expense and its splits, then recalculates group debts.
// Input: UpdateExpenseRequest with expense ID and updated data
// Output: UpdateExpenseResponse with updated expense and splits
// Description: Updates expense, replaces splits, and recalculates simplified debts
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
	if err := s.updateDebts(tx, expense.GroupID); err != nil {
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

// DeleteExpense deletes an expense and its splits, then recalculates group debts.
// Input: DeleteExpenseRequest with expense ID
// Output: error if deletion fails
// Description: Removes expense, deletes associated splits, and recalculates debts
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
	if err := s.updateDebts(tx, expense.GroupID); err != nil {
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

	// Factor in existing debt settlements (paid amounts) BEFORE clearing debts
	var existingDebts []database.Debt
	if err := tx.Where("group_id = ?", groupID).Find(&existingDebts).Error; err != nil {
		return err
	}

	// Clear existing debts for this group AFTER factoring in paid amounts
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

// updateDebts updates debts using the new calculation method and preserves paid amounts.
// Input: gorm.DB transaction and groupID
// Output: error if debt calculation fails
// Description: Calculates new debts, preserves existing paid amounts, and updates database
func (s *expenseService) updateDebts(tx *gorm.DB, groupID uint) error {
	// Get existing debts to preserve paid amounts
	var existingDebts []database.Debt
	if err := tx.Where("group_id = ?", groupID).Find(&existingDebts).Error; err != nil {
		return err
	}

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
