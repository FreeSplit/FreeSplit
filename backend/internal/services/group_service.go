package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"freesplit/internal/database"

	"gorm.io/gorm"
)

type groupService struct {
	db *gorm.DB
}

// NewGroupService creates a new instance of the group service with database connection.
// Input: gorm.DB database connection
// Output: GroupService interface implementation
// Description: Initializes group service with database dependency injection
func NewGroupService(db *gorm.DB) GroupService {
	return &groupService{db: db}
}

// GetGroup retrieves a group by URL slug with all participants and expenses.
// Input: GetGroupRequest with UrlSlug
// Output: GetGroupResponse with group data including participants and expenses
// Description: Fetches group by URL slug and preloads all related participants and expenses
func (s *groupService) GetGroup(ctx context.Context, req *GetGroupRequest) (*GetGroupResponse, error) {
	var group database.Group
	if err := s.db.Preload("Participants").Preload("Expenses").Where("url_slug = ?", req.UrlSlug).First(&group).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("group not found")
		}
		return nil, fmt.Errorf("failed to get group: %v", err)
	}

	// Convert participants
	participants := make([]*Participant, len(group.Participants))
	for i, p := range group.Participants {
		participants[i] = ParticipantFromDB(&p)
	}

	return &GetGroupResponse{
		Group:        GroupFromDB(&group),
		Participants: participants,
	}, nil
}

// CreateGroup creates a new group with a unique URL slug and initial participants.
// Input: CreateGroupRequest with Name and initial participants
// Output: CreateGroupResponse with created group data
// Description: Creates group, generates unique URL slug, and adds initial participants
func (s *groupService) CreateGroup(ctx context.Context, req *CreateGroupRequest) (*CreateGroupResponse, error) {
	// Generate URL slug
	urlSlug, err := generateURLSlug()
	if err != nil {
		return nil, fmt.Errorf("failed to generate URL slug: %v", err)
	}

	// Create group
	group := database.Group{
		Name:     req.Name,
		Currency: req.Currency,
		URLSlug:  urlSlug,
	}

	if err := s.db.Create(&group).Error; err != nil {
		return nil, fmt.Errorf("failed to create group: %v", err)
	}

	// Create participants
	var participants []database.Participant
	for _, name := range req.ParticipantNames {
		participant := database.Participant{
			Name:    name,
			GroupID: group.ID,
		}
		participants = append(participants, participant)
	}

	if err := s.db.Create(&participants).Error; err != nil {
		return nil, fmt.Errorf("failed to create participants: %v", err)
	}

	// Convert to response types
	responseParticipants := make([]*Participant, len(participants))
	for i, p := range participants {
		responseParticipants[i] = ParticipantFromDB(&p)
	}

	return &CreateGroupResponse{
		Group:        GroupFromDB(&group),
		Participants: responseParticipants,
	}, nil
}

func (s *groupService) UpdateGroup(ctx context.Context, req *UpdateGroupRequest) (*UpdateGroupResponse, error) {
	var group database.Group
	if err := s.db.First(&group, "id = ?", req.ParticipantId).Error; err != nil {
		return nil, fmt.Errorf("failed to find group: %v", err)
	}

	// Update group
	group.Name = req.Name
	group.Currency = req.Currency

	if err := s.db.Save(&group).Error; err != nil {
		return nil, fmt.Errorf("failed to update group: %v", err)
	}

	return &UpdateGroupResponse{
		Group: GroupFromDB(&group),
	}, nil
}

// generateURLSlug generates a unique 32-character hexadecimal URL slug for groups.
// Input: none
// Output: string URL slug and error
// Description: Creates cryptographically secure random 32-character hex string for group URLs
func generateURLSlug() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
