package services

import (
	"context"
	"fmt"

	"freesplit/internal/database"

	"gorm.io/gorm"
)

type participantService struct {
	db *gorm.DB
}

func NewParticipantService(db *gorm.DB) ParticipantService {
	return &participantService{db: db}
}

func (s *participantService) AddParticipant(ctx context.Context, req *AddParticipantRequest) (*AddParticipantResponse, error) {
	participant := database.Participant{
		Name:    req.Name,
		GroupID: uint(req.GroupId),
	}

	if err := s.db.Create(&participant).Error; err != nil {
		return nil, fmt.Errorf("failed to create participant: %v", err)
	}

	return &AddParticipantResponse{
		Participant: ParticipantFromDB(&participant),
	}, nil
}

func (s *participantService) UpdateParticipant(ctx context.Context, req *UpdateParticipantRequest) (*UpdateParticipantResponse, error) {
	var participant database.Participant
	if err := s.db.First(&participant, req.ParticipantId).Error; err != nil {
		return nil, fmt.Errorf("participant not found: %v", err)
	}

	participant.Name = req.Name
	if err := s.db.Save(&participant).Error; err != nil {
		return nil, fmt.Errorf("failed to update participant: %v", err)
	}

	return &UpdateParticipantResponse{
		Participant: ParticipantFromDB(&participant),
	}, nil
}

func (s *participantService) DeleteParticipant(ctx context.Context, req *DeleteParticipantRequest) error {
	// Check if participant exists
	var participant database.Participant
	if err := s.db.First(&participant, req.ParticipantId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("participant not found")
		}
		return fmt.Errorf("failed to find participant: %v", err)
	}

	// Check if participant has any active expenses as payer
	var expenseCount int64
	if err := s.db.Model(&database.Expense{}).Where("payer_id = ?", req.ParticipantId).Count(&expenseCount).Error; err != nil {
		return fmt.Errorf("failed to check participant expenses: %v", err)
	}

	if expenseCount > 0 {
		return fmt.Errorf("cannot delete participant: they have %d active expenses as payer. Please delete or reassign these expenses first", expenseCount)
	}

	// Check if participant has any active splits
	var splitCount int64
	if err := s.db.Model(&database.Split{}).Where("participant_id = ?", req.ParticipantId).Count(&splitCount).Error; err != nil {
		return fmt.Errorf("failed to check participant splits: %v", err)
	}

	if splitCount > 0 {
		return fmt.Errorf("cannot delete participant: they are involved in %d expense splits. Please delete or reassign these expenses first", splitCount)
	}

	// Check if participant has any active debts
	var debtCount int64
	if err := s.db.Model(&database.Debt{}).Where("lender_id = ? OR debtor_id = ?", req.ParticipantId, req.ParticipantId).Count(&debtCount).Error; err != nil {
		return fmt.Errorf("failed to check participant debts: %v", err)
	}

	if debtCount > 0 {
		return fmt.Errorf("cannot delete participant: they have %d active debts. Please settle these debts first", debtCount)
	}

	// Delete the participant
	if err := s.db.Delete(&participant).Error; err != nil {
		return fmt.Errorf("failed to delete participant: %v", err)
	}

	return nil
}
