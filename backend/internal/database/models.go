package database

import (
	"time"
	"gorm.io/gorm"
)

// Group represents a group of people sharing expenses
type Group struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	URLSlug       string    `gorm:"uniqueIndex;not null" json:"url_slug"`
	Name          string    `gorm:"not null" json:"name"`
	SettleUpDate  *time.Time `json:"settle_up_date"`
	State         string    `gorm:"default:'active'" json:"state"`
	Currency      string    `gorm:"size:3;not null" json:"currency"`
	Participants  []Participant `gorm:"foreignKey:GroupID" json:"participants"`
	Expenses      []Expense `gorm:"foreignKey:GroupID" json:"expenses"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Participant represents a member of a group
type Participant struct {
	ID      uint   `gorm:"primaryKey" json:"id"`
	Name    string `gorm:"not null" json:"name"`
	GroupID uint   `gorm:"not null;index" json:"group_id"`
	Group   Group  `gorm:"foreignKey:GroupID" json:"group"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Expense represents a single expense in a group
type Expense struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Name      string `gorm:"not null" json:"name"`
	Cost      float64 `gorm:"type:decimal(10,2);not null" json:"cost"`
	Emoji     string `json:"emoji"`
	PayerID   uint   `gorm:"not null" json:"payer_id"`
	Payer     Participant `gorm:"foreignKey:PayerID" json:"payer"`
	SplitType string `gorm:"not null" json:"split_type"` // "equal", "amount", "shares"
	GroupID   uint   `gorm:"not null" json:"group_id"`
	Group     Group  `gorm:"foreignKey:GroupID" json:"group"`
	Splits    []Split `gorm:"foreignKey:ExpenseID" json:"splits"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Split represents how an expense is split among participants
type Split struct {
	ID           uint     `gorm:"primaryKey" json:"id"`
	GroupID      uint     `gorm:"not null" json:"group_id"`
	Group        Group    `gorm:"foreignKey:GroupID" json:"group"`
	ExpenseID    uint     `gorm:"not null" json:"expense_id"`
	Expense      Expense  `gorm:"foreignKey:ExpenseID" json:"expense"`
	ParticipantID uint    `gorm:"not null" json:"participant_id"`
	Participant  Participant `gorm:"foreignKey:ParticipantID" json:"participant"`
	SplitAmount  float64  `gorm:"type:decimal(10,2);not null" json:"split_amount"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Debt represents simplified debts between participants
type Debt struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	GroupID    uint   `gorm:"not null" json:"group_id"`
	Group      Group  `gorm:"foreignKey:GroupID" json:"group"`
	LenderID   uint   `gorm:"not null" json:"lender_id"`
	Lender     Participant `gorm:"foreignKey:LenderID" json:"lender"`
	DebtorID   uint   `gorm:"not null" json:"debtor_id"`
	Debtor     Participant `gorm:"foreignKey:DebtorID" json:"debtor"`
	DebtAmount float64 `gorm:"type:decimal(10,2);not null" json:"debt_amount"`
	PaidAmount float64 `gorm:"type:decimal(10,2);default:0" json:"paid_amount"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Migrate runs database migrations
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&Group{},
		&Participant{},
		&Expense{},
		&Split{},
		&Debt{},
	)
}

