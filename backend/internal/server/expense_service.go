package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"math"

	"freesplit/internal/database"
	pb "freesplit/proto"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"gorm.io/gorm"
)

type ExpenseService struct {
	pb.UnimplementedExpenseServiceServer
	db *gorm.DB
}

func NewExpenseService(db *gorm.DB) *ExpenseService {
	return &ExpenseService{db: db}
}

func (s *ExpenseService) GetExpensesByGroup(ctx context.Context, req *pb.GetExpensesByGroupRequest) (*pb.GetExpensesByGroupResponse, error) {
	var expenses []database.Expense
	if err := s.db.Preload("Payer").Preload("Splits.Participant").Where("group_id = ?", req.GroupId).Find(&expenses).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to get expenses: %v", err)
	}

	var pbExpenses []*pb.Expense
	for _, expense := range expenses {
		var splitIds []int32
		for _, split := range expense.Splits {
			splitIds = append(splitIds, int32(split.ID))
		}

		pbExpenses = append(pbExpenses, &pb.Expense{
			Id:        int32(expense.ID),
			Name:      expense.Name,
			Cost:      expense.Cost,
			Emoji:     expense.Emoji,
			PayerId:   int32(expense.PayerID),
			SplitType: expense.SplitType,
			SplitIds:  splitIds,
			GroupId:   int32(expense.GroupID),
		})
	}

	return &pb.GetExpensesByGroupResponse{Expenses: pbExpenses}, nil
}

func (s *ExpenseService) GetSplitsByParticipant(ctx context.Context, req *pb.GetSplitsByParticipantRequest) (*pb.GetSplitsByParticipantResponse, error) {
	var splits []database.Split
	if err := s.db.Preload("Participant").Preload("Expense").Where("participant_id = ?", req.ParticipantId).Find(&splits).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to get splits: %v", err)
	}

	var pbSplits []*pb.Split
	for _, split := range splits {
		pbSplits = append(pbSplits, &pb.Split{
			SplitId:       int32(split.ID),
			GroupId:       int32(split.GroupID),
			ExpenseId:     int32(split.ExpenseID),
			ParticipantId: int32(split.ParticipantID),
			SplitAmount:   split.SplitAmount,
		})
	}

	return &pb.GetSplitsByParticipantResponse{Splits: pbSplits}, nil
}

func (s *ExpenseService) GetExpenseWithSplits(ctx context.Context, req *pb.GetExpenseWithSplitsRequest) (*pb.GetExpenseWithSplitsResponse, error) {
	var expense database.Expense
	if err := s.db.Preload("Payer").Preload("Splits.Participant").First(&expense, req.ExpenseId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, status.Errorf(codes.NotFound, "Expense not found")
		}
		return nil, status.Errorf(codes.Internal, "Failed to get expense: %v", err)
	}

	var splitIds []int32
	for _, split := range expense.Splits {
		splitIds = append(splitIds, int32(split.ID))
	}

	pbExpense := &pb.Expense{
		Id:        int32(expense.ID),
		Name:      expense.Name,
		Cost:      expense.Cost,
		Emoji:     expense.Emoji,
		PayerId:   int32(expense.PayerID),
		SplitType: expense.SplitType,
		SplitIds:  splitIds,
		GroupId:   int32(expense.GroupID),
	}

	var pbSplits []*pb.Split
	for _, split := range expense.Splits {
		pbSplits = append(pbSplits, &pb.Split{
			SplitId:       int32(split.ID),
			GroupId:       int32(split.GroupID),
			ExpenseId:     int32(split.ExpenseID),
			ParticipantId: int32(split.ParticipantID),
			SplitAmount:   split.SplitAmount,
		})
	}

	return &pb.GetExpenseWithSplitsResponse{
		Expense: pbExpense,
		Splits:  pbSplits,
	}, nil
}

func (s *ExpenseService) CreateExpense(ctx context.Context, req *pb.CreateExpenseRequest) (*pb.CreateExpenseResponse, error) {
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
		return nil, status.Errorf(codes.Internal, "Failed to create expense: %v", err)
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
		return nil, status.Errorf(codes.Internal, "Failed to create splits: %v", err)
	}

	// Calculate and update simplified debts
	if err := s.calculateSimplifiedDebts(tx, uint(req.Expense.GroupId)); err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to calculate debts: %v", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to commit transaction: %v", err)
	}

	// Convert to response format
	var splitIds []int32
	for _, split := range splits {
		splitIds = append(splitIds, int32(split.ID))
	}

	pbExpense := &pb.Expense{
		Id:        int32(expense.ID),
		Name:      expense.Name,
		Cost:      expense.Cost,
		Emoji:     expense.Emoji,
		PayerId:   int32(expense.PayerID),
		SplitType: expense.SplitType,
		SplitIds:  splitIds,
		GroupId:   int32(expense.GroupID),
	}

	var pbSplits []*pb.Split
	for _, split := range splits {
		pbSplits = append(pbSplits, &pb.Split{
			SplitId:       int32(split.ID),
			GroupId:       int32(split.GroupID),
			ExpenseId:     int32(split.ExpenseID),
			ParticipantId: int32(split.ParticipantID),
			SplitAmount:   split.SplitAmount,
		})
	}

	return &pb.CreateExpenseResponse{
		Expense: pbExpense,
		Splits:  pbSplits,
	}, nil
}

func (s *ExpenseService) UpdateExpense(ctx context.Context, req *pb.UpdateExpenseRequest) (*pb.UpdateExpenseResponse, error) {
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
		return nil, status.Errorf(codes.Internal, "Failed to update expense: %v", err)
	}

	// Delete existing splits
	if err := tx.Where("expense_id = ?", expense.ID).Delete(&database.Split{}).Error; err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to delete existing splits: %v", err)
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
		return nil, status.Errorf(codes.Internal, "Failed to create splits: %v", err)
	}

	// Calculate and update simplified debts
	if err := s.calculateSimplifiedDebts(tx, uint(req.Expense.GroupId)); err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to calculate debts: %v", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to commit transaction: %v", err)
	}

	// Convert to response format
	var splitIds []int32
	for _, split := range splits {
		splitIds = append(splitIds, int32(split.ID))
	}

	pbExpense := &pb.Expense{
		Id:        int32(expense.ID),
		Name:      expense.Name,
		Cost:      expense.Cost,
		Emoji:     expense.Emoji,
		PayerId:   int32(expense.PayerID),
		SplitType: expense.SplitType,
		SplitIds:  splitIds,
		GroupId:   int32(expense.GroupID),
	}

	var pbSplits []*pb.Split
	for _, split := range splits {
		pbSplits = append(pbSplits, &pb.Split{
			SplitId:       int32(split.ID),
			GroupId:       int32(split.GroupID),
			ExpenseId:     int32(split.ExpenseID),
			ParticipantId: int32(split.ParticipantID),
			SplitAmount:   split.SplitAmount,
		})
	}

	return &pb.UpdateExpenseResponse{
		Expense: pbExpense,
		Splits:  pbSplits,
	}, nil
}

func (s *ExpenseService) DeleteExpense(ctx context.Context, req *pb.DeleteExpenseRequest) (*emptypb.Empty, error) {
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
			return nil, status.Errorf(codes.NotFound, "Expense not found")
		}
		return nil, status.Errorf(codes.Internal, "Failed to get expense: %v", err)
	}

	// Delete splits
	if err := tx.Where("expense_id = ?", req.ExpenseId).Delete(&database.Split{}).Error; err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to delete splits: %v", err)
	}

	// Delete expense
	if err := tx.Delete(&expense).Error; err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to delete expense: %v", err)
	}

	// Calculate and update simplified debts
	if err := s.calculateSimplifiedDebts(tx, expense.GroupID); err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to calculate debts: %v", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to commit transaction: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// calculateSimplifiedDebts implements the debt simplification algorithm
func (s *ExpenseService) calculateSimplifiedDebts(tx *gorm.DB, groupID uint) error {
	// Get all participants in the group
	var participants []database.Participant
	if err := tx.Where("group_id = ?", groupID).Find(&participants).Error; err != nil {
		return err
	}

	// Calculate net balance for each participant
	balances := make(map[uint]float64)
	for _, participant := range participants {
		balances[participant.ID] = 0.0
	}

	// Get all splits for this group
	var splits []database.Split
	if err := tx.Preload("Expense").Where("group_id = ?", groupID).Find(&splits).Error; err != nil {
		return err
	}

	// Calculate net balances
	for _, split := range splits {
		// Participant owes money (positive balance)
		balances[split.ParticipantID] += split.SplitAmount
		// Payer is owed money (negative balance)
		balances[split.Expense.PayerID] -= split.SplitAmount
	}

	// Separate creditors (negative balance) and debtors (positive balance)
	var creditors, debtors []struct {
		ID      uint
		Balance float64
	}

	for id, balance := range balances {
		if math.Abs(balance) > 0.01 { // Ignore very small amounts
			if balance < 0 {
				creditors = append(creditors, struct {
					ID      uint
					Balance float64
				}{ID: id, Balance: -balance}) // Make positive
			} else {
				debtors = append(debtors, struct {
					ID      uint
					Balance float64
				}{ID: id, Balance: balance})
			}
		}
	}

	// Delete existing debts for this group
	if err := tx.Where("group_id = ?", groupID).Delete(&database.Debt{}).Error; err != nil {
		return err
	}

	// Create simplified debts using greedy algorithm
	var debts []database.Debt
	creditorIdx, debtorIdx := 0, 0

	for creditorIdx < len(creditors) && debtorIdx < len(debtors) {
		creditor := creditors[creditorIdx]
		debtor := debtors[debtorIdx]

		amount := math.Min(creditor.Balance, debtor.Balance)
		if amount > 0.01 { // Only create debt if amount is significant
			debts = append(debts, database.Debt{
				GroupID:    groupID,
				LenderID:   creditor.ID,
				DebtorID:   debtor.ID,
				DebtAmount: amount,
				PaidAmount: 0,
			})
		}

		creditor.Balance -= amount
		debtor.Balance -= amount

		if creditor.Balance < 0.01 {
			creditorIdx++
		}
		if debtor.Balance < 0.01 {
			debtorIdx++
		}

		creditors[creditorIdx] = creditor
		debtors[debtorIdx] = debtor
	}

	// Create debts in database
	if len(debts) > 0 {
		if err := tx.Create(&debts).Error; err != nil {
			return err
		}
	}

	return nil
}

// generateURLSlug creates a unique URL slug for groups
func generateURLSlug() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
