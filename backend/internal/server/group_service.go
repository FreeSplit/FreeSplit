package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"

	"freesplit/internal/database"
	pb "freesplit/proto"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type GroupService struct {
	pb.UnimplementedGroupServiceServer
	db *gorm.DB
}

func NewGroupService(db *gorm.DB) *GroupService {
	return &GroupService{db: db}
}

func (s *GroupService) GetGroup(ctx context.Context, req *pb.GetGroupRequest) (*pb.GetGroupResponse, error) {
	var group database.Group
	if err := s.db.Preload("Participants").Where("url_slug = ?", req.UrlSlug).First(&group).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, status.Errorf(codes.NotFound, "Group not found")
		}
		return nil, status.Errorf(codes.Internal, "Failed to get group: %v", err)
	}

	// Convert to protobuf format
	var participantIds []int32
	for _, participant := range group.Participants {
		participantIds = append(participantIds, int32(participant.ID))
	}

	var expenseIds []int32
	for _, expense := range group.Expenses {
		expenseIds = append(expenseIds, int32(expense.ID))
	}

	var settleUpDate int64
	if group.SettleUpDate != nil {
		settleUpDate = group.SettleUpDate.Unix()
	}

	pbGroup := &pb.Group{
		Id:             int32(group.ID),
		UrlSlug:        group.URLSlug,
		Name:           group.Name,
		SettleUpDate:   settleUpDate,
		State:          group.State,
		Currency:       group.Currency,
		ParticipantIds: participantIds,
		ExpenseIds:     expenseIds,
	}

	var pbParticipants []*pb.Participant
	for _, participant := range group.Participants {
		pbParticipants = append(pbParticipants, &pb.Participant{
			Id:      int32(participant.ID),
			Name:    participant.Name,
			GroupId: int32(participant.GroupID),
		})
	}

	return &pb.GetGroupResponse{
		Group:        pbGroup,
		Participants: pbParticipants,
	}, nil
}

func (s *GroupService) CreateGroup(ctx context.Context, req *pb.CreateGroupRequest) (*pb.CreateGroupResponse, error) {
	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Generate unique URL slug
	urlSlug, err := generateURLSlug()
	if err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to generate URL slug: %v", err)
	}

	// Create group
	group := database.Group{
		URLSlug:  urlSlug,
		Name:     req.Name,
		Currency: req.Currency,
		State:    "active",
	}

	if err := tx.Create(&group).Error; err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to create group: %v", err)
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

	if err := tx.Create(&participants).Error; err != nil {
		tx.Rollback()
		return nil, status.Errorf(codes.Internal, "Failed to create participants: %v", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to commit transaction: %v", err)
	}

	// Convert to response format
	var participantIds []int32
	for _, participant := range participants {
		participantIds = append(participantIds, int32(participant.ID))
	}

	pbGroup := &pb.Group{
		Id:             int32(group.ID),
		UrlSlug:        group.URLSlug,
		Name:           group.Name,
		SettleUpDate:   0,
		State:          group.State,
		Currency:       group.Currency,
		ParticipantIds: participantIds,
		ExpenseIds:     []int32{},
	}

	var pbParticipants []*pb.Participant
	for _, participant := range participants {
		pbParticipants = append(pbParticipants, &pb.Participant{
			Id:      int32(participant.ID),
			Name:    participant.Name,
			GroupId: int32(participant.GroupID),
		})
	}

	return &pb.CreateGroupResponse{
		Group:        pbGroup,
		Participants: pbParticipants,
	}, nil
}

func (s *GroupService) UpdateGroup(ctx context.Context, req *pb.UpdateGroupRequest) (*pb.UpdateGroupResponse, error) {
	var group database.Group
	if err := s.db.Preload("Participants").Preload("Expenses").First(&group, "url_slug = ?", req.UrlSlug).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, status.Errorf(codes.NotFound, "Group not found")
		}
		return nil, status.Errorf(codes.Internal, "Failed to get group: %v", err)
	}

	// Update group fields
	group.Name = req.Name
	group.Currency = req.Currency

	if err := s.db.Save(&group).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to update group: %v", err)
	}

	// Convert to response format
	var participantIds []int32
	for _, participant := range group.Participants {
		participantIds = append(participantIds, int32(participant.ID))
	}

	var expenseIds []int32
	for _, expense := range group.Expenses {
		expenseIds = append(expenseIds, int32(expense.ID))
	}

	var settleUpDate int64
	if group.SettleUpDate != nil {
		settleUpDate = group.SettleUpDate.Unix()
	}

	pbGroup := &pb.Group{
		Id:             int32(group.ID),
		UrlSlug:        group.URLSlug,
		Name:           group.Name,
		SettleUpDate:   settleUpDate,
		State:          group.State,
		Currency:       group.Currency,
		ParticipantIds: participantIds,
		ExpenseIds:     expenseIds,
	}

	return &pb.UpdateGroupResponse{Group: pbGroup}, nil
}

// generateURLSlug creates a unique URL slug for groups
func generateURLSlug() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
