package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"

	"freesplit/internal/database"
	pb "freesplit/proto"

	"github.com/glebarez/sqlite"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
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

	// Connect to gRPC server
	conn, err := grpc.Dial("localhost:8080", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("Failed to connect to gRPC server: %v", err)
	}
	defer conn.Close()

	// Create gRPC clients
	groupClient := pb.NewGroupServiceClient(conn)

	// HTTP handlers
	http.HandleFunc("/freesplit.GroupService/CreateGroup", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Read request body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}

		// Parse JSON request
		var reqData struct {
			Name             string   `json:"name"`
			Currency         string   `json:"currency"`
			ParticipantNames []string `json:"participant_names"`
		}
		if err := json.Unmarshal(body, &reqData); err != nil {
			http.Error(w, "Failed to parse JSON", http.StatusBadRequest)
			return
		}

		// Create gRPC request
		req := &pb.CreateGroupRequest{
			Name:             reqData.Name,
			Currency:         reqData.Currency,
			ParticipantNames: reqData.ParticipantNames,
		}

		// Call gRPC service
		resp, err := groupClient.CreateGroup(context.Background(), req)
		if err != nil {
			log.Printf("gRPC error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Convert response to JSON
		responseData := map[string]interface{}{
			"group": map[string]interface{}{
				"id":              resp.Group.Id,
				"url_slug":        resp.Group.UrlSlug,
				"name":            resp.Group.Name,
				"settle_up_date":  resp.Group.SettleUpDate,
				"state":           resp.Group.State,
				"currency":        resp.Group.Currency,
				"participant_ids": resp.Group.ParticipantIds,
				"expense_ids":     resp.Group.ExpenseIds,
			},
			"participants": make([]map[string]interface{}, len(resp.Participants)),
		}

		// Add participants
		for i, p := range resp.Participants {
			responseData["participants"].([]map[string]interface{})[i] = map[string]interface{}{
				"id":       p.Id,
				"name":     p.Name,
				"group_id": p.GroupId,
			}
		}

		// Send JSON response
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if err := json.NewEncoder(w).Encode(responseData); err != nil {
			log.Printf("Failed to encode response: %v", err)
		}
	})

	// Handle CORS preflight
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusOK)
			return
		}
		http.NotFound(w, r)
	})

	log.Println("HTTP proxy server listening on :8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
