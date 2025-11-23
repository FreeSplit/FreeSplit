package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"freesplit/internal/database"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Get database URL from environment variable or use default
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		// Default to local PostgreSQL for development
		databaseURL = "host=localhost user=postgres password=postgres dbname=freesplit port=5432 sslmode=disable"
		log.Printf("🔧 Using local PostgreSQL for development")
	} else {
		log.Printf("🔧 Using DATABASE_URL from environment")
	}

	// Connect to database
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	log.Printf("✅ Successfully connected to database")

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Create test group
	group := database.Group{
		Name:     "Test Pagination Group",
		URLSlug:  fmt.Sprintf("test-pagination-%d", time.Now().Unix()),
		Currency: "USD",
		State:    "active",
	}

	if err := db.Create(&group).Error; err != nil {
		log.Fatalf("Failed to create group: %v", err)
	}
	log.Printf("✅ Created group: %s (ID: %d)", group.Name, group.ID)

	// Create participants
	participant1 := database.Participant{
		Name:   "Alice",
		GroupID: group.ID,
	}
	participant2 := database.Participant{
		Name:   "Bob",
		GroupID: group.ID,
	}

	if err := db.Create(&participant1).Error; err != nil {
		log.Fatalf("Failed to create participant 1: %v", err)
	}
	if err := db.Create(&participant2).Error; err != nil {
		log.Fatalf("Failed to create participant 2: %v", err)
	}
	log.Printf("✅ Created participants: %s (ID: %d), %s (ID: %d)", participant1.Name, participant1.ID, participant2.Name, participant2.ID)

	// Create 51 expenses
	baseTime := time.Now()
	for i := 0; i < 51; i++ {
		// Create expense with different timestamps to ensure proper ordering
		expense := database.Expense{
			Name:      fmt.Sprintf("Expense %d", i),
			Cost:      10.00,
			Emoji:     "💰",
			PayerID:   participant1.ID,
			SplitType: "equal",
			GroupID:   group.ID,
			CreatedAt: baseTime.Add(time.Duration(i) * time.Second),
			UpdatedAt: baseTime.Add(time.Duration(i) * time.Second),
		}

		if err := db.Create(&expense).Error; err != nil {
			log.Fatalf("Failed to create expense %d: %v", i, err)
		}

		// Create splits for this expense (equal split between both participants)
		split1 := database.Split{
			GroupID:       group.ID,
			ExpenseID:     expense.ID,
			ParticipantID: participant1.ID,
			SplitAmount:   5.00,
		}
		split2 := database.Split{
			GroupID:       group.ID,
			ExpenseID:     expense.ID,
			ParticipantID: participant2.ID,
			SplitAmount:   5.00,
		}

		if err := db.Create(&split1).Error; err != nil {
			log.Fatalf("Failed to create split 1 for expense %d: %v", i, err)
		}
		if err := db.Create(&split2).Error; err != nil {
			log.Fatalf("Failed to create split 2 for expense %d: %v", i, err)
		}

		if (i+1)%10 == 0 {
			log.Printf("✅ Created %d expenses...", i+1)
		}
	}

	log.Printf("✅ Successfully created 51 expenses for group '%s'", group.Name)
	log.Printf("📋 Group URL slug: %s", group.URLSlug)
	log.Printf("🎉 Test data creation complete!")
}

