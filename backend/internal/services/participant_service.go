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
	// Delete the participant
	if err := s.db.Delete(&database.Participant{}, req.ParticipantId).Error; err != nil {
		return fmt.Errorf("failed to delete participant: %v", err)
	}

	return nil
}
