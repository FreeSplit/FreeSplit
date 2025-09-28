package services

import (
	"fmt"
	"freesplit/internal/database"

	"gorm.io/gorm"
)

// CalculateNetDebts calculates net debts for a group, factoring in all expenses and payments.
// Input: gorm.DB database connection and groupID
// Output: []database.Debt list of calculated debts and error
// Description: Calculates simplified debts based on expenses with their splits, and previous payments made between participants
/*

Example: Two Expenses
Let's say we have 3 people: Alice, Bob, and Charlie.

Expense 1: Alice pays $30 for dinner (split equally)
    Alice pays: $30
    Split: $10 each (Alice, Bob, Charlie)

    After Expense 1:
    Result after Expense 1:
        Alice: +$20 (owed $20)
        Bob: -$10 (owes $10)
        Charlie: -$10 (owes $10)

Expense 2: Bob pays $24 for gas (split by usage)
    Bob pays: $24
    Split: Alice $8, Bob $8, Charlie $8

    After Expense 2:
    Result after both expenses:
        Alice: +$12 (owed $12)
        Bob: +$6 (owed $6)
        Charlie: -$18 (owes $18)

What this means:
    Alice is owed $12 by the group
    Bob is owed $6 by the group
    Charlie owes $18 to the group

The debt simplification will create:
    Charlie owes Alice $12
    Charlie owes Bob $6
    Total: Charlie owes $18 (which matches his -$18 balance)

*/
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

	// Subtract payments from balances
	for key, amount := range paymentTotals {
		var payerID, payeeID uint
		fmt.Sscanf(key, "%d-%d", &payerID, &payeeID)
		// The payer has made a payment, so reduce what they owe
		balances[payerID] += amount
		// The payee has received a payment, so reduce what they're owed
		balances[payeeID] -= amount
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
		// Using 0.01 as a threshold to avoid floating point precision issues
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
