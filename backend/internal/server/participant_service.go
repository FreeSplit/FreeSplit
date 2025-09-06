package server

import (
	"context"
	"math"

	"freesplit/internal/database"
	pb "freesplit/proto"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type ParticipantService struct {
	pb.UnimplementedParticipantServiceServer
	db *gorm.DB
}

func NewParticipantService(db *gorm.DB) *ParticipantService {
	return &ParticipantService{db: db}
}

func (s *ParticipantService) AddParticipant(ctx context.Context, req *pb.AddParticipantRequest) (*pb.AddParticipantResponse, error) {
	// Check if group exists
	var group database.Group
	if err := s.db.First(&group, req.GroupId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, status.Errorf(codes.NotFound, "Group not found")
		}
		return nil, status.Errorf(codes.Internal, "Failed to get group: %v", err)
	}

	// Check if participant name already exists in group
	var existingParticipant database.Participant
	if err := s.db.Where("name = ? AND group_id = ?", req.Name, req.GroupId).First(&existingParticipant).Error; err == nil {
		return nil, status.Errorf(codes.AlreadyExists, "Participant with this name already exists in the group")
	}

	// Create participant
	participant := database.Participant{
		Name:    req.Name,
		GroupID: uint(req.GroupId),
	}

	if err := s.db.Create(&participant).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to create participant: %v", err)
	}

	// Convert to response format
	pbParticipant := &pb.Participant{
		Id:      int32(participant.ID),
		Name:    participant.Name,
		GroupId: int32(participant.GroupID),
	}

	return &pb.AddParticipantResponse{Participant: pbParticipant}, nil
}

func (s *ParticipantService) UpdateParticipant(ctx context.Context, req *pb.UpdateParticipantRequest) (*pb.UpdateParticipantResponse, error) {
	var participant database.Participant
	if err := s.db.First(&participant, req.ParticipantId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, status.Errorf(codes.NotFound, "Participant not found")
		}
		return nil, status.Errorf(codes.Internal, "Failed to get participant: %v", err)
	}

	// Check if new name already exists in the same group
	var existingParticipant database.Participant
	if err := s.db.Where("name = ? AND group_id = ? AND id != ?", req.Name, participant.GroupID, participant.ID).First(&existingParticipant).Error; err == nil {
		return nil, status.Errorf(codes.AlreadyExists, "Participant with this name already exists in the group")
	}

	// Update participant
	participant.Name = req.Name

	if err := s.db.Save(&participant).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to update participant: %v", err)
	}

	// Convert to response format
	pbParticipant := &pb.Participant{
		Id:      int32(participant.ID),
		Name:    participant.Name,
		GroupId: int32(participant.GroupID),
	}

	return &pb.UpdateParticipantResponse{Participant: pbParticipant}, nil
}

func (s *ParticipantService) DeleteParticipant(ctx context.Context, req *pb.DeleteParticipantRequest) (*pb.Empty, error) {
	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Get participant to find group ID
	var participant database.Participant
	if err := tx.First(&participant, req.ParticipantId).Error; err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, status.Errorf(codes.NotFound, "Participant not found")
		}
		return nil, status.Errorf(codes.Internal, "Failed to get participant: %v", err)
	}

	groupID := participant.GroupID

	// Delete all splits for this participant
	if err := tx.Where("participant_id = ?", req.ParticipantId).Delete(&database.Split{}).Error; err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to delete splits: %v", err)
	}

	// Delete all expenses where this participant was the payer
	if err := tx.Where("payer_id = ?", req.ParticipantId).Delete(&database.Expense{}).Error; err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to delete expenses: %v", err)
	}

	// Delete all debts involving this participant
	if err := tx.Where("lender_id = ? OR debtor_id = ?", req.ParticipantId, req.ParticipantId).Delete(&database.Debt{}).Error; err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to delete debts: %v", err)
	}

	// Delete participant
	if err := tx.Delete(&participant).Error; err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to delete participant: %v", err)
	}

	// Recalculate simplified debts for the group
	if err := s.calculateSimplifiedDebts(tx, groupID); err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to calculate debts: %v", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to commit transaction: %v", err)
	}

	return &pb.Empty{}, nil
}

// calculateSimplifiedDebts implements the debt simplification algorithm
func (s *ParticipantService) calculateSimplifiedDebts(tx *gorm.DB, groupID uint) error {
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
