package services

import "context"

// GroupService interface
type GroupService interface {
	GetGroup(ctx context.Context, req *GetGroupRequest) (*GetGroupResponse, error)
	CreateGroup(ctx context.Context, req *CreateGroupRequest) (*CreateGroupResponse, error)
	UpdateGroup(ctx context.Context, req *UpdateGroupRequest) (*UpdateGroupResponse, error)
}

// ParticipantService interface
type ParticipantService interface {
	AddParticipant(ctx context.Context, req *AddParticipantRequest) (*AddParticipantResponse, error)
	UpdateParticipant(ctx context.Context, req *UpdateParticipantRequest) (*UpdateParticipantResponse, error)
	DeleteParticipant(ctx context.Context, req *DeleteParticipantRequest) error
}

// ExpenseService interface
type ExpenseService interface {
	GetExpensesByGroup(ctx context.Context, req *GetExpensesByGroupRequest) (*GetExpensesByGroupResponse, error)
	GetExpenseWithSplits(ctx context.Context, req *GetExpenseWithSplitsRequest) (*GetExpenseWithSplitsResponse, error)
	GetSplitsByGroup(ctx context.Context, req *GetSplitsByGroupRequest) (*GetSplitsByGroupResponse, error)
	CreateExpense(ctx context.Context, req *CreateExpenseRequest) (*CreateExpenseResponse, error)
	UpdateExpense(ctx context.Context, req *UpdateExpenseRequest) (*UpdateExpenseResponse, error)
	DeleteExpense(ctx context.Context, req *DeleteExpenseRequest) error
}

// DebtService interface
type DebtService interface {
	GetDebtsPageData(ctx context.Context, req *GetDebtsRequest) (*GetDebtsPageDataResponse, error)
	CreatePayment(ctx context.Context, req *CreatePaymentRequest) (*CreatePaymentResponse, error)
	GetPayments(ctx context.Context, req *GetPaymentsRequest) (*GetPaymentsResponse, error)
}
