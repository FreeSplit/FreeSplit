package services

import (
	"fmt"
	"freesplit/internal/database"

	"gorm.io/gorm"
)

// CalculateNetDebts calculates net debts for a group, factoring in all settlements and payments.
// Input: gorm.DB database connection and groupID
// Output: []database.Debt list of calculated debts and error
// Description: Calculates simplified debts based on expenses, splits, and historical payments
func CalculateNetDebts(db *gorm.DB, groupID uint) ([]database.Debt, error) {
	// Get all participants in the group
	var participants []database.Participant
	if err := db.Where("group_id = ?", groupID).Find(&participants).Error; err != nil {
		return nil, err
	}

	// Calculate net balances for each participant
	balances := make(map[uint]float64)
	for _, participant := range participants {
		balances[participant.ID] = 0
	}

	// Get all expenses for the group
	var expenses []database.Expense
	if err := db.Where("group_id = ?", groupID).Find(&expenses).Error; err != nil {
		return nil, err
	}

	// Calculate balances based on expenses and splits
	for _, expense := range expenses {
		// Add the full amount to the payer's balance (they paid for it)
		balances[expense.PayerID] += expense.Cost

		// Get splits for this expense
		var splits []database.Split
		if err := db.Where("expense_id = ?", expense.ID).Find(&splits).Error; err != nil {
			return nil, err
		}

		// Subtract each participant's share from their balance
		for _, split := range splits {
			balances[split.ParticipantID] -= split.SplitAmount
		}
	}

	// Get all historical payments from the Payment table
	var payments []database.Payment
	if err := db.Where("group_id = ?", groupID).Find(&payments).Error; err != nil {
		return nil, err
	}

	// Calculate total payments per participant pair
	paymentTotals := make(map[string]float64) // key: "payerID-payeeID", value: total paid
	for _, payment := range payments {
		key := fmt.Sprintf("%d-%d", payment.PayerID, payment.PayeeID)
		paymentTotals[key] += payment.Amount
	}

	// Debug: Log payments
	fmt.Printf("DEBUG: Found %d payment records\n", len(payments))
	for key, amount := range paymentTotals {
		if amount > 0 {
			fmt.Printf("DEBUG: Payment %s: $%.2f\n", key, amount)
		}
	}

	// Subtract payments from balances
	for key, amount := range paymentTotals {
		var payerID, payeeID uint
		fmt.Sscanf(key, "%d-%d", &payerID, &payeeID)
		// The payer has made a payment, so reduce what they owe
		balances[payerID] += amount
		// The payee has received a payment, so reduce what they're owed
		balances[payeeID] -= amount
	}

	// Debug: Log balances after factoring in payments
	fmt.Printf("DEBUG: Balances after factoring in payments:\n")
	for participantID, balance := range balances {
		fmt.Printf("DEBUG: Participant %d: $%.2f\n", participantID, balance)
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
	var newDebts []database.Debt
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

		// Create debt record (no paid_amount needed - payments are tracked separately)
		debt := database.Debt{
			GroupID:    groupID,
			LenderID:   creditor.ID,
			DebtorID:   debtor.ID,
			DebtAmount: settleAmount,
		}

		newDebts = append(newDebts, debt)

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

	return newDebts, nil
}
