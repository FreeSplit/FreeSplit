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

// GetUserGroupsSummary retrieves debt summary for multiple groups by slug and participant.
// Input: UserGroupsSummaryRequest with list of groups and participant info
// Output: UserGroupsSummaryResponse with group summaries including net balances
// Description: Calculates net balance for each user in their respective groups
func (s *debtService) GetUserGroupsSummary(ctx context.Context, req *UserGroupsSummaryRequest) (*UserGroupsSummaryResponse, error) {
	if len(req.Groups) == 0 {
		return &UserGroupsSummaryResponse{Groups: []*UserGroupSummary{}}, nil
	}

	// Get all groups by URL slug
	groupSlugs := make([]string, len(req.Groups))
	for i, group := range req.Groups {
		groupSlugs[i] = group.GroupUrlSlug
	}

	var groups []database.Group
	if err := s.db.Where("url_slug IN ?", groupSlugs).Find(&groups).Error; err != nil {
		return nil, fmt.Errorf("failed to get groups: %v", err)
	}

	// Create map for quick lookup
	groupMap := make(map[string]*database.Group)
	for _, group := range groups {
		groupMap[group.URLSlug] = &group
	}

	var summaries []*UserGroupSummary

	for _, userGroup := range req.Groups {
		group, exists := groupMap[userGroup.GroupUrlSlug]
		if !exists {
			continue // Skip groups that don't exist
		}

		// Calculate net balance for this participant in this group
		netBalance, err := s.calculateNetBalance(group.ID, userGroup.UserParticipantId)
		if err != nil {
			// Log error but continue with other groups
			fmt.Printf("Error calculating net balance for group %s, participant %d: %v\n",
				userGroup.GroupUrlSlug, userGroup.UserParticipantId, err)
			netBalance = 0
		}

		summaries = append(summaries, &UserGroupSummary{
			GroupUrlSlug: group.URLSlug,
			GroupName:    group.Name,
			Currency:     group.Currency,
			NetBalance:   netBalance,
		})
	}

	return &UserGroupsSummaryResponse{
		Groups: summaries,
	}, nil
}

// GetGroupParticipants retrieves participants for multiple groups by URL slug.
// Input: GroupParticipantsRequest with list of group slugs
// Output: GroupParticipantsResponse with participants for each group
// Description: Fetches all participants for the requested groups
func (s *debtService) GetGroupParticipants(ctx context.Context, req *GroupParticipantsRequest) (*GroupParticipantsResponse, error) {
	if len(req.GroupSlugs) == 0 {
		return &GroupParticipantsResponse{Groups: []*GroupParticipants{}}, nil
	}

	// Get all groups by URL slug
	var groups []database.Group
	if err := s.db.Where("url_slug IN ?", req.GroupSlugs).Find(&groups).Error; err != nil {
		return nil, fmt.Errorf("failed to get groups: %v", err)
	}

	// Create map for quick lookup
	groupMap := make(map[string]*database.Group)
	for _, group := range groups {
		groupMap[group.URLSlug] = &group
	}

	var result []*GroupParticipants

	for _, groupSlug := range req.GroupSlugs {
		group, exists := groupMap[groupSlug]
		if !exists {
			continue // Skip groups that don't exist
		}

		// Get participants for this group
		var participants []database.Participant
		if err := s.db.Where("group_id = ?", group.ID).Find(&participants).Error; err != nil {
			return nil, fmt.Errorf("failed to get participants for group %s: %v", groupSlug, err)
		}

		// Convert to service types
		serviceParticipants := make([]*Participant, len(participants))
		for i, p := range participants {
			serviceParticipants[i] = ParticipantFromDB(&p)
		}

		result = append(result, &GroupParticipants{
			GroupUrlSlug: groupSlug,
			Participants: serviceParticipants,
		})
	}

	return &GroupParticipantsResponse{
		Groups: result,
	}, nil
}

// calculateNetBalance calculates the net balance for a participant in a group.
// Positive means they are owed money, negative means they owe money.
func (s *debtService) calculateNetBalance(groupID uint, participantID int32) (float64, error) {
	// Get all debts where this participant is involved
	var debts []database.Debt
	if err := s.db.Where("group_id = ? AND (lender_id = ? OR debtor_id = ?)",
		groupID, participantID, participantID).Find(&debts).Error; err != nil {
		return 0, fmt.Errorf("failed to get debts: %v", err)
	}

	var netBalance float64
	for _, debt := range debts {
		if debt.LenderID == uint(participantID) {
			// Participant is owed money
			netBalance += debt.DebtAmount
		} else if debt.DebtorID == uint(participantID) {
			// Participant owes money
			netBalance -= debt.DebtAmount
		}
	}

	return netBalance, nil
}
