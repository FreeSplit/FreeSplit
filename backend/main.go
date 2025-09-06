package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/http"

	"freesplit/internal/database"
	"freesplit/internal/server"
	pb "freesplit/proto"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"gorm.io/driver/sqlite"
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
	go func() {
		lis, err := net.Listen("tcp", ":8080")
		if err != nil {
			log.Fatalf("Failed to listen: %v", err)
		}
		log.Println("gRPC server listening on :8080")
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("Failed to serve gRPC: %v", err)
		}
	}()

	// Create gRPC-Gateway mux
	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	// Register gRPC-Gateway handlers
	if err := pb.RegisterExpenseServiceHandlerFromEndpoint(ctx, mux, "localhost:8080", opts); err != nil {
		log.Fatalf("Failed to register expense service handler: %v", err)
	}
	if err := pb.RegisterGroupServiceHandlerFromEndpoint(ctx, mux, "localhost:8080", opts); err != nil {
		log.Fatalf("Failed to register group service handler: %v", err)
	}
	if err := pb.RegisterParticipantServiceHandlerFromEndpoint(ctx, mux, "localhost:8080", opts); err != nil {
		log.Fatalf("Failed to register participant service handler: %v", err)
	}
	if err := pb.RegisterDebtServiceHandlerFromEndpoint(ctx, mux, "localhost:8080", opts); err != nil {
		log.Fatalf("Failed to register debt service handler: %v", err)
	}

	// Start HTTP server
	log.Println("HTTP server listening on :8081")
	if err := http.ListenAndServe(":8081", mux); err != nil {
		log.Fatalf("Failed to serve HTTP: %v", err)
	}
}

