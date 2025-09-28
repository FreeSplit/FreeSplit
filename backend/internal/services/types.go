package services

import (
	"freesplit/internal/database"
	"time"
)

// Request and Response types for Group operations
type CreateGroupRequest struct {
	Name             string   `json:"name"`
	Currency         string   `json:"currency"`
	ParticipantNames []string `json:"participant_names"`
}

type CreateGroupResponse struct {
	Group        *Group         `json:"group"`
	Participants []*Participant `json:"participants"`
}

type GetGroupRequest struct {
	UrlSlug string `json:"url_slug"`
}

type GetGroupResponse struct {
	Group        *Group         `json:"group"`
	Participants []*Participant `json:"participants"`
}

type UpdateGroupRequest struct {
	Name          string `json:"name"`
	Currency      string `json:"currency"`
	ParticipantId int32  `json:"participant_id"`
}

type UpdateGroupResponse struct {
	Group *Group `json:"group"`
}

// Request and Response types for Participant operations
type AddParticipantRequest struct {
	Name    string `json:"name"`
	GroupId int32  `json:"group_id"`
}

type AddParticipantResponse struct {
	Participant *Participant `json:"participant"`
}

type UpdateParticipantRequest struct {
	Name          string `json:"name"`
	ParticipantId int32  `json:"participant_id"`
}

type UpdateParticipantResponse struct {
	Participant *Participant `json:"participant"`
}

type DeleteParticipantRequest struct {
	ParticipantId int32 `json:"participant_id"`
}

// Request and Response types for Expense operations
type GetExpensesByGroupRequest struct {
	GroupId int32 `json:"group_id"`
}

type GetExpensesByGroupResponse struct {
	Expenses []*Expense `json:"expenses"`
}

type CreateExpenseRequest struct {
	Expense *Expense `json:"expense"`
	Splits  []*Split `json:"splits"`
}

type CreateExpenseResponse struct {
	Expense *Expense `json:"expense"`
	Splits  []*Split `json:"splits"`
}

type GetExpenseWithSplitsRequest struct {
	ExpenseId int32 `json:"expense_id"`
}

type GetExpenseWithSplitsResponse struct {
	Expense *Expense `json:"expense"`
	Splits  []*Split `json:"splits"`
}

type UpdateExpenseRequest struct {
	Expense *Expense `json:"expense"`
	Splits  []*Split `json:"splits"`
}

type UpdateExpenseResponse struct {
	Expense *Expense `json:"expense"`
	Splits  []*Split `json:"splits"`
}

type DeleteExpenseRequest struct {
	ExpenseId int32 `json:"expense_id"`
}

// Request and Response types for Debt operations
type GetDebtsRequest struct {
	GroupId int32 `json:"group_id"`
}

type GetDebtsResponse struct {
	Debts []*Debt `json:"debts"`
}

type UpdateDebtPaidAmountRequest struct {
	DebtId     int32   `json:"debt_id"`
	PaidAmount float64 `json:"paid_amount"`
}

type UpdateDebtPaidAmountResponse struct {
	Debt *Debt `json:"debt"`
}

type GetPaymentsRequest struct {
	GroupId int32 `json:"group_id"`
}

type GetPaymentsResponse struct {
	Payments []*Payment `json:"payments"`
}

// Data types
type Group struct {
	Id        int32     `json:"id"`
	Name      string    `json:"name"`
	Currency  string    `json:"currency"`
	UrlSlug   string    `json:"url_slug"`
	CreatedAt time.Time `json:"created_at"`
}

type Participant struct {
	Id      int32  `json:"id"`
	Name    string `json:"name"`
	GroupId int32  `json:"group_id"`
}

type Expense struct {
	Id        int32     `json:"id"`
	Name      string    `json:"name"`
	Cost      float64   `json:"cost"`
	Emoji     string    `json:"emoji"`
	PayerId   int32     `json:"payer_id"`
	SplitType string    `json:"split_type"`
	GroupId   int32     `json:"group_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Split struct {
	Id            int32   `json:"id"`
	GroupId       int32   `json:"group_id"`
	ExpenseId     int32   `json:"expense_id"`
	ParticipantId int32   `json:"participant_id"`
	SplitAmount   float64 `json:"split_amount"`
}

type Debt struct {
	Id         int32   `json:"id"`
	GroupId    int32   `json:"group_id"`
	LenderId   int32   `json:"lender_id"`
	DebtorId   int32   `json:"debtor_id"`
	DebtAmount float64 `json:"debt_amount"`
	PaidAmount float64 `json:"paid_amount"`
}

type Payment struct {
	Id        int32     `json:"id"`
	GroupId   int32     `json:"group_id"`
	PayerId   int32     `json:"payer_id"`
	PayeeId   int32     `json:"payee_id"`
	Amount    float64   `json:"amount"`
	CreatedAt time.Time `json:"created_at"`
}

// Conversion functions from database models to service types
func GroupFromDB(dbGroup *database.Group) *Group {
	return &Group{
		Id:        int32(dbGroup.ID),
		Name:      dbGroup.Name,
		Currency:  dbGroup.Currency,
		UrlSlug:   dbGroup.URLSlug,
		CreatedAt: dbGroup.CreatedAt,
	}
}

func ParticipantFromDB(dbParticipant *database.Participant) *Participant {
	return &Participant{
		Id:      int32(dbParticipant.ID),
		Name:    dbParticipant.Name,
		GroupId: int32(dbParticipant.GroupID),
	}
}

func ExpenseFromDB(dbExpense *database.Expense) *Expense {
	return &Expense{
		Id:        int32(dbExpense.ID),
		Name:      dbExpense.Name,
		Cost:      dbExpense.Cost,
		Emoji:     dbExpense.Emoji,
		PayerId:   int32(dbExpense.PayerID),
		SplitType: dbExpense.SplitType,
		GroupId:   int32(dbExpense.GroupID),
		CreatedAt: dbExpense.CreatedAt,
	}
}

func SplitFromDB(dbSplit *database.Split) *Split {
	return &Split{
		Id:            int32(dbSplit.ID),
		GroupId:       int32(dbSplit.GroupID),
		ExpenseId:     int32(dbSplit.ExpenseID),
		ParticipantId: int32(dbSplit.ParticipantID),
		SplitAmount:   dbSplit.SplitAmount,
	}
}

func DebtFromDB(dbDebt *database.Debt) *Debt {
	return &Debt{
		Id:         int32(dbDebt.ID),
		GroupId:    int32(dbDebt.GroupID),
		LenderId:   int32(dbDebt.LenderID),
		DebtorId:   int32(dbDebt.DebtorID),
		DebtAmount: dbDebt.DebtAmount,
	}
}
