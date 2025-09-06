package server

import (
	"context"

	"freesplit/internal/database"
	pb "freesplit/proto"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type DebtService struct {
	pb.UnimplementedDebtServiceServer
	db *gorm.DB
}

func NewDebtService(db *gorm.DB) *DebtService {
	return &DebtService{db: db}
}

func (s *DebtService) GetDebts(ctx context.Context, req *pb.GetDebtsRequest) (*pb.GetDebtsResponse, error) {
	// Get all debts for the group
	var debts []database.Debt
	if err := s.db.Preload("Lender").Preload("Debtor").Where("group_id = ?", req.GroupId).Find(&debts).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to get debts: %v", err)
	}

	// Get all participants in the group for reference
	var participants []database.Participant
	if err := s.db.Where("group_id = ?", req.GroupId).Find(&participants).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to get participants: %v", err)
	}

	// Convert debts to protobuf format
	var pbDebts []*pb.Debt
	for _, debt := range debts {
		pbDebts = append(pbDebts, &pb.Debt{
			DebtId:     int32(debt.ID),
			GroupId:    int32(debt.GroupID),
			LenderId:   int32(debt.LenderID),
			DebtorId:   int32(debt.DebtorID),
			DebtAmount: debt.DebtAmount,
			PaidAmount: debt.PaidAmount,
		})
	}

	// Convert participants to protobuf format
	var pbParticipants []*pb.Participant
	for _, participant := range participants {
		pbParticipants = append(pbParticipants, &pb.Participant{
			Id:      int32(participant.ID),
			Name:    participant.Name,
			GroupId: int32(participant.GroupID),
		})
	}

	return &pb.GetDebtsResponse{
		Debts:        pbDebts,
		Participants: pbParticipants,
	}, nil
}

func (s *DebtService) UpdateDebtPaidAmount(ctx context.Context, req *pb.UpdateDebtPaidAmountRequest) (*pb.UpdateDebtPaidAmountResponse, error) {
	var debt database.Debt
	if err := s.db.First(&debt, req.DebtId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, status.Errorf(codes.NotFound, "Debt not found")
		}
		return nil, status.Errorf(codes.Internal, "Failed to get debt: %v", err)
	}

	// Validate paid amount
	if req.PaidAmount < 0 {
		return nil, status.Errorf(codes.InvalidArgument, "Paid amount cannot be negative")
	}
	if req.PaidAmount > debt.DebtAmount {
		return nil, status.Errorf(codes.InvalidArgument, "Paid amount cannot exceed debt amount")
	}

	// Update paid amount
	debt.PaidAmount = req.PaidAmount

	if err := s.db.Save(&debt).Error; err != nil {
		return nil, status.Errorf(codes.Internal, "Failed to update debt: %v", err)
	}

	// Convert to response format
	pbDebt := &pb.Debt{
		DebtId:     int32(debt.ID),
		GroupId:    int32(debt.GroupID),
		LenderId:   int32(debt.LenderID),
		DebtorId:   int32(debt.DebtorID),
		DebtAmount: debt.DebtAmount,
		PaidAmount: debt.PaidAmount,
	}

	return &pb.UpdateDebtPaidAmountResponse{Debt: pbDebt}, nil
}
