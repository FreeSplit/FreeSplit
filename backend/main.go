package main

import (
	"log"
	"net"

	"freesplit/internal/database"
	"freesplit/internal/server"
	pb "freesplit/proto"

	"github.com/glebarez/sqlite"
	"google.golang.org/grpc"
	"gorm.io/gorm"
)

func main() {
	// Initialize database
	db, err := gorm.Open(sqlite.Open("freesplit.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Create gRPC server
	grpcServer := grpc.NewServer()

	// Register services
	expenseService := server.NewExpenseService(db)
	pb.RegisterExpenseServiceServer(grpcServer, expenseService)

	groupService := server.NewGroupService(db)
	pb.RegisterGroupServiceServer(grpcServer, groupService)

	participantService := server.NewParticipantService(db)
	pb.RegisterParticipantServiceServer(grpcServer, participantService)

	debtService := server.NewDebtService(db)
	pb.RegisterDebtServiceServer(grpcServer, debtService)

	// Start gRPC server
	lis, err := net.Listen("tcp", ":8080")
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}
	log.Println("gRPC server listening on :8080")
	log.Fatal(grpcServer.Serve(lis))
}
