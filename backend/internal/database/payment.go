package database

import (
	"time"

	"gorm.io/gorm"
)

// Payment represents a payment made between participants
type Payment struct {
	ID        uint        `gorm:"primaryKey" json:"id"`
	GroupID   uint        `gorm:"not null" json:"group_id"`
	Group     Group       `gorm:"foreignKey:GroupID" json:"group"`
	PayerID   uint        `gorm:"not null" json:"payer_id"`
	Payer     Participant `gorm:"foreignKey:PayerID" json:"payer"`
	PayeeID   uint        `gorm:"not null" json:"payee_id"`
	Payee     Participant `gorm:"foreignKey:PayeeID" json:"payee"`
	Amount    float64     `gorm:"type:decimal(10,2);not null" json:"amount"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

// MigratePayments adds the Payment table to migrations
func MigratePayments(db *gorm.DB) error {
	return db.AutoMigrate(&Payment{})
}
