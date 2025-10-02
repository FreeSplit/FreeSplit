package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"freesplit/internal/database"
	"freesplit/internal/services"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Get database URL from environment variable
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		// Default to local PostgreSQL for development
		databaseURL = "host=localhost user=postgres password=postgres dbname=freesplit port=5432 sslmode=disable"
		log.Printf("🔧 Using local PostgreSQL for development")
	} else {
		log.Printf("🔧 Using DATABASE_URL from environment")
	}

	// Initialize database
	log.Printf("🔄 Connecting to database...")
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	log.Printf("✅ Successfully connected to database")

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Create service instances
	groupService := services.NewGroupService(db)
	participantService := services.NewParticipantService(db)
	expenseService := services.NewExpenseService(db)
	debtService := services.NewDebtService(db)

	// CORS middleware
	corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			log.Printf("🌐 [CORS] %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Pragma, Expires")

			if r.Method == "OPTIONS" {
				log.Printf("✅ [CORS] Handling preflight request for %s", r.URL.Path)
				w.WriteHeader(http.StatusOK)
				return
			}

			next(w, r)
		}
	}

	// Routes
	http.HandleFunc("/api/group", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "POST":
			createGroup(w, r, groupService)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// Group operations (by URL slug)
	http.HandleFunc("/api/group/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is a nested operation
		if strings.Contains(r.URL.Path, "/participants") {
			switch r.Method {
			case "POST":
				addParticipant(w, r, participantService)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else if strings.Contains(r.URL.Path, "/expenses") {
			switch r.Method {
			case "GET":
				getExpensesByGroup(w, r, expenseService)
			case "POST":
				createExpense(w, r, expenseService)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else if strings.Contains(r.URL.Path, "/splits") {
			switch r.Method {
			case "GET":
				getSplitsByGroup(w, r, expenseService)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else if strings.Contains(r.URL.Path, "/debts-page-data") {
			switch r.Method {
			case "GET":
				getDebtsPageData(w, r, debtService)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else if strings.Contains(r.URL.Path, "/payments") {
			switch r.Method {
			case "GET":
				getPayments(w, r, debtService)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else {
			// Basic group operations (GET by URL slug, PUT for updates)
			switch r.Method {
			case "GET":
				getGroup(w, r, groupService)
			case "PUT":
				updateGroup(w, r, groupService)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		}
	}))

	http.HandleFunc("/api/participants/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "PUT":
			updateParticipant(w, r, participantService)
		case "DELETE":
			deleteParticipant(w, r, participantService)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	http.HandleFunc("/api/expense/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			getExpenseWithSplits(w, r, expenseService)
		case "PUT":
			updateExpense(w, r, expenseService)
		case "DELETE":
			deleteExpense(w, r, expenseService)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	http.HandleFunc("/api/debts/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/paid") {
			switch r.Method {
			case "PUT":
				createPayment(w, r, debtService)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		}
	}))

	http.HandleFunc("/api/payments/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "DELETE":
			deletePayment(w, r, debtService)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// User Groups API
	http.HandleFunc("/api/user-groups/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/summary") {
			switch r.Method {
			case "POST":
				getUserGroupsSummary(w, r, debtService)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else if strings.Contains(r.URL.Path, "/participants") {
			switch r.Method {
			case "POST":
				getGroupParticipants(w, r, groupService)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		}
	}))

	log.Println("REST API server listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// User Groups handlers
func getUserGroupsSummary(w http.ResponseWriter, r *http.Request, debtService services.DebtService) {
	var req services.UserGroupsSummaryRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Invalid JSON in user groups summary request: %v", err)
		http.Error(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	// Validate input
	if len(req.Groups) == 0 {
		http.Error(w, "Groups list cannot be empty", http.StatusBadRequest)
		return
	}

	for _, group := range req.Groups {
		if group.GroupUrlSlug == "" {
			http.Error(w, "Group URL slug cannot be empty", http.StatusBadRequest)
			return
		}
		if group.UserParticipantId <= 0 {
			http.Error(w, "User participant ID must be positive", http.StatusBadRequest)
			return
		}
	}

	resp, err := debtService.GetUserGroupsSummary(context.TODO(), &req)
	if err != nil {
		log.Printf("Error getting user groups summary: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func getGroupParticipants(w http.ResponseWriter, r *http.Request, groupService services.GroupService) {
	log.Printf("🔍 [GET_GROUP_PARTICIPANTS] Starting request from %s", r.RemoteAddr)

	var req services.GroupParticipantsRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("❌ [GET_GROUP_PARTICIPANTS] Invalid JSON in group participants request: %v", err)
		http.Error(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	log.Printf("📝 [GET_GROUP_PARTICIPANTS] Request data: %+v", req)

	// Validate input
	if len(req.GroupSlugs) == 0 {
		log.Printf("❌ [GET_GROUP_PARTICIPANTS] Group slugs list is empty")
		http.Error(w, "Group slugs list cannot be empty", http.StatusBadRequest)
		return
	}

	for _, slug := range req.GroupSlugs {
		if slug == "" {
			log.Printf("❌ [GET_GROUP_PARTICIPANTS] Empty group slug found")
			http.Error(w, "Group slug cannot be empty", http.StatusBadRequest)
			return
		}
	}

	log.Printf("🔄 [GET_GROUP_PARTICIPANTS] Calling service with %d group slugs", len(req.GroupSlugs))
	resp, err := groupService.GetGroupParticipants(context.TODO(), &req)
	if err != nil {
		log.Printf("❌ [GET_GROUP_PARTICIPANTS] Error getting group participants: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ [GET_GROUP_PARTICIPANTS] Success! Returning %d groups", len(resp.Groups))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// Group handlers
func createGroup(w http.ResponseWriter, r *http.Request, groupService services.GroupService) {
	log.Printf("🚀 [CREATE_GROUP] Starting group creation request from %s", r.RemoteAddr)

	var req struct {
		Name             string   `json:"name"`
		Currency         string   `json:"currency"`
		ParticipantNames []string `json:"participant_names"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("❌ [CREATE_GROUP] Failed to decode JSON: %v", err)
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	log.Printf("📝 [CREATE_GROUP] Request data - Name: %s, Currency: %s, Participants: %v", req.Name, req.Currency, req.ParticipantNames)

	serviceReq := &services.CreateGroupRequest{
		Name:             req.Name,
		Currency:         req.Currency,
		ParticipantNames: req.ParticipantNames,
	}

	resp, err := groupService.CreateGroup(context.TODO(), serviceReq)
	if err != nil {
		log.Printf("❌ [CREATE_GROUP] Error creating group: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("❌ [CREATE_GROUP] Error encoding response: %v", err)
		return
	}

	log.Printf("✅ [CREATE_GROUP] Successfully created and returned group with ID: %d, URL: %s", resp.Group.Id, resp.Group.UrlSlug)
}

func getGroup(w http.ResponseWriter, r *http.Request, groupService services.GroupService) {
	urlSlug := strings.TrimPrefix(r.URL.Path, "/api/group/")
	log.Printf("🚀 [GET_GROUP] Starting group retrieval request for URL slug: %s from %s", urlSlug, r.RemoteAddr)

	if urlSlug == "" {
		log.Printf("❌ [GET_GROUP] Missing url_slug parameter")
		http.Error(w, "url_slug parameter required", http.StatusBadRequest)
		return
	}

	serviceReq := &services.GetGroupRequest{UrlSlug: urlSlug}
	resp, err := groupService.GetGroup(context.TODO(), serviceReq)
	if err != nil {
		log.Printf("❌ [GET_GROUP] Error getting group %s: %v", urlSlug, err)
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("❌ [GET_GROUP] Error encoding response for group %s: %v", urlSlug, err)
		return
	}

	log.Printf("✅ [GET_GROUP] Successfully retrieved and returned group %s with %d participants", urlSlug, len(resp.Participants))
}

func updateGroup(w http.ResponseWriter, r *http.Request, groupService services.GroupService) {
	var req struct {
		Name          string `json:"name"`
		Currency      string `json:"currency"`
		ParticipantID int32  `json:"participant_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	serviceReq := &services.UpdateGroupRequest{
		Name:          req.Name,
		Currency:      req.Currency,
		ParticipantId: req.ParticipantID,
	}

	resp, err := groupService.UpdateGroup(context.TODO(), serviceReq)
	if err != nil {
		log.Printf("Error updating group: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// Participant handlers
func addParticipant(w http.ResponseWriter, r *http.Request, participantService services.ParticipantService) {
	var req struct {
		Name    string `json:"name"`
		GroupID int32  `json:"group_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	serviceReq := &services.AddParticipantRequest{
		Name:    req.Name,
		GroupId: req.GroupID,
	}

	resp, err := participantService.AddParticipant(context.TODO(), serviceReq)
	if err != nil {
		log.Printf("Error adding participant: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func updateParticipant(w http.ResponseWriter, r *http.Request, participantService services.ParticipantService) {
	// Extract participant ID from URL path
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 || pathParts[0] != "api" || pathParts[1] != "participants" {
		http.Error(w, "Invalid URL format", http.StatusBadRequest)
		return
	}

	participantIDStr := pathParts[2]
	participantID, err := strconv.Atoi(participantIDStr)
	if err != nil {
		log.Printf("Invalid participant ID '%s': %v", participantIDStr, err)
		http.Error(w, fmt.Sprintf("Invalid participant ID: %s", participantIDStr), http.StatusBadRequest)
		return
	}

	var req struct {
		Name          string `json:"name"`
		ParticipantID int32  `json:"participant_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Invalid JSON in update participant request: %v", err)
		http.Error(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	// Validate name
	if strings.TrimSpace(req.Name) == "" {
		http.Error(w, "Name cannot be empty", http.StatusBadRequest)
		return
	}

	serviceReq := &services.UpdateParticipantRequest{
		Name:          strings.TrimSpace(req.Name),
		ParticipantId: int32(participantID),
	}

	resp, err := participantService.UpdateParticipant(context.TODO(), serviceReq)
	if err != nil {
		log.Printf("Error updating participant %d: %v", participantID, err)

		// Check if it's a business logic error (participant not found, etc.)
		if strings.Contains(err.Error(), "not found") {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		// For other errors, return internal server error
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func deleteParticipant(w http.ResponseWriter, r *http.Request, participantService services.ParticipantService) {
	participantIDStr := strings.TrimPrefix(r.URL.Path, "/api/participants/")
	participantID, err := strconv.Atoi(participantIDStr)
	if err != nil {
		http.Error(w, "Invalid participant ID", http.StatusBadRequest)
		return
	}

	serviceReq := &services.DeleteParticipantRequest{
		ParticipantId: int32(participantID),
	}

	err = participantService.DeleteParticipant(context.TODO(), serviceReq)
	if err != nil {
		log.Printf("Error deleting participant: %v", err)

		// Check if it's a business logic error (participant has active expenses/splits/debts)
		if strings.Contains(err.Error(), "cannot delete participant") {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}

		// For other errors, return internal server error
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	response := map[string]string{"message": "Participant deleted successfully"}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Expense handlers
func getExpensesByGroup(w http.ResponseWriter, r *http.Request, expenseService services.ExpenseService) {
	// Extract group ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	groupID, err := strconv.Atoi(pathParts[3])
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	serviceReq := &services.GetExpensesByGroupRequest{
		GroupId: int32(groupID),
	}

	resp, err := expenseService.GetExpensesByGroup(context.TODO(), serviceReq)
	if err != nil {
		log.Printf("Error getting expenses: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp.Expenses)
}

func getSplitsByGroup(w http.ResponseWriter, r *http.Request, expenseService services.ExpenseService) {
	// Extract urlSlug from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	urlSlug := pathParts[3]
	if urlSlug == "" {
		http.Error(w, "Invalid URL slug", http.StatusBadRequest)
		return
	}

	serviceReq := &services.GetSplitsByGroupRequest{
		UrlSlug: urlSlug,
	}

	resp, err := expenseService.GetSplitsByGroup(context.TODO(), serviceReq)
	if err != nil {
		log.Printf("Error getting splits: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp.Splits)
}

func createExpense(w http.ResponseWriter, r *http.Request, expenseService services.ExpenseService) {
	var requestData struct {
		Expense struct {
			Name      string  `json:"name"`
			Cost      float64 `json:"cost"`
			Emoji     string  `json:"emoji"`
			PayerID   int32   `json:"payer_id"`
			SplitType string  `json:"split_type"`
			GroupID   int32   `json:"group_id"`
		} `json:"expense"`
		Splits []struct {
			ParticipantID int32   `json:"participant_id"`
			SplitAmount   float64 `json:"split_amount"`
		} `json:"splits"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Convert splits
	splits := make([]*services.Split, len(requestData.Splits))
	for i, split := range requestData.Splits {
		splits[i] = &services.Split{
			GroupId:       requestData.Expense.GroupID,
			ParticipantId: split.ParticipantID,
			SplitAmount:   split.SplitAmount,
		}
	}

	serviceReq := &services.CreateExpenseRequest{
		Expense: &services.Expense{
			Name:      requestData.Expense.Name,
			Cost:      requestData.Expense.Cost,
			Emoji:     requestData.Expense.Emoji,
			PayerId:   requestData.Expense.PayerID,
			SplitType: requestData.Expense.SplitType,
			GroupId:   requestData.Expense.GroupID,
		},
		Splits: splits,
	}

	resp, err := expenseService.CreateExpense(context.Background(), serviceReq)
	if err != nil {
		log.Printf("Error creating expense: %v", err)
		http.Error(w, "Failed to create expense", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func getExpenseWithSplits(w http.ResponseWriter, r *http.Request, expenseService services.ExpenseService) {
	expenseIDStr := strings.TrimPrefix(r.URL.Path, "/api/expense/")
	expenseID, err := strconv.Atoi(expenseIDStr)
	if err != nil {
		http.Error(w, "Invalid expense ID", http.StatusBadRequest)
		return
	}

	serviceReq := &services.GetExpenseWithSplitsRequest{ExpenseId: int32(expenseID)}
	resp, err := expenseService.GetExpenseWithSplits(context.Background(), serviceReq)
	if err != nil {
		log.Printf("Error getting expense with splits: %v", err)
		http.Error(w, "Expense not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func updateExpense(w http.ResponseWriter, r *http.Request, expenseService services.ExpenseService) {
	var requestData struct {
		Expense struct {
			ID        int32   `json:"id"`
			Name      string  `json:"name"`
			Cost      float64 `json:"cost"`
			Emoji     string  `json:"emoji"`
			PayerID   int32   `json:"payer_id"`
			SplitType string  `json:"split_type"`
			GroupID   int32   `json:"group_id"`
		} `json:"expense"`
		Splits []struct {
			ParticipantID int32   `json:"participant_id"`
			SplitAmount   float64 `json:"split_amount"`
		} `json:"splits"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Convert splits
	splits := make([]*services.Split, len(requestData.Splits))
	for i, split := range requestData.Splits {
		splits[i] = &services.Split{
			GroupId:       requestData.Expense.GroupID,
			ParticipantId: split.ParticipantID,
			SplitAmount:   split.SplitAmount,
		}
	}

	serviceReq := &services.UpdateExpenseRequest{
		Expense: &services.Expense{
			Id:        requestData.Expense.ID,
			Name:      requestData.Expense.Name,
			Cost:      requestData.Expense.Cost,
			Emoji:     requestData.Expense.Emoji,
			PayerId:   requestData.Expense.PayerID,
			SplitType: requestData.Expense.SplitType,
			GroupId:   requestData.Expense.GroupID,
		},
		Splits: splits,
	}

	resp, err := expenseService.UpdateExpense(r.Context(), serviceReq)
	if err != nil {
		log.Printf("Error updating expense: %v", err)
		http.Error(w, "Failed to update expense", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func deleteExpense(w http.ResponseWriter, r *http.Request, expenseService services.ExpenseService) {
	expenseIDStr := strings.TrimPrefix(r.URL.Path, "/api/expense/")
	expenseID, err := strconv.Atoi(expenseIDStr)
	if err != nil {
		http.Error(w, "Invalid expense ID", http.StatusBadRequest)
		return
	}

	serviceReq := &services.DeleteExpenseRequest{
		ExpenseId: int32(expenseID),
	}

	err = expenseService.DeleteExpense(r.Context(), serviceReq)
	if err != nil {
		log.Printf("Error deleting expense: %v", err)
		http.Error(w, "Failed to delete expense", http.StatusInternalServerError)
		return
	}

	response := map[string]string{"message": "Expense deleted successfully"}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Debt handlers
func getPayments(w http.ResponseWriter, r *http.Request, debtService services.DebtService) {
	// Extract group ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	groupID, err := strconv.Atoi(pathParts[3])
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Get payments using service
	req := &services.GetPaymentsRequest{GroupId: int32(groupID)}
	response, err := debtService.GetPayments(r.Context(), req)
	if err != nil {
		http.Error(w, "Failed to get payments", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response.Payments)
}

func getDebtsPageData(w http.ResponseWriter, r *http.Request, debtService services.DebtService) {
	// Extract group URL slug from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	urlSlug := pathParts[3]
	if urlSlug == "" {
		http.Error(w, "Invalid group URL slug", http.StatusBadRequest)
		return
	}

	serviceReq := &services.GetDebtsRequest{
		UrlSlug: urlSlug,
	}

	resp, err := debtService.GetDebtsPageData(context.TODO(), serviceReq)
	if err != nil {
		log.Printf("Error getting debts page data: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func createPayment(w http.ResponseWriter, r *http.Request, debtService services.DebtService) {
	var req struct {
		DebtID     int32   `json:"debt_id"`
		PaidAmount float64 `json:"paid_amount"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Invalid JSON in debt update request: %v", err)
		http.Error(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.DebtID <= 0 {
		http.Error(w, "Invalid debt ID", http.StatusBadRequest)
		return
	}

	if req.PaidAmount < 0 {
		http.Error(w, "Paid amount cannot be negative", http.StatusBadRequest)
		return
	}

	serviceReq := &services.CreatePaymentRequest{
		DebtId:     req.DebtID,
		PaidAmount: req.PaidAmount,
	}

	resp, err := debtService.CreatePayment(context.TODO(), serviceReq)
	if err != nil {
		log.Printf("Error creating payment for debt %d: %v", req.DebtID, err)

		// Check if it's a business logic error
		if strings.Contains(err.Error(), "not found") {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		// Check if it's a validation error (overpayment, etc.)
		if strings.Contains(err.Error(), "cannot exceed") || strings.Contains(err.Error(), "cannot be negative") || strings.Contains(err.Error(), "invalid debt ID") {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// For other errors, return internal server error
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func deletePayment(w http.ResponseWriter, r *http.Request, debtService services.DebtService) {
	paymentIDStr := strings.TrimPrefix(r.URL.Path, "/api/payments/")
	paymentID, err := strconv.Atoi(paymentIDStr)
	if err != nil || paymentID <= 0 {
		http.Error(w, "Invalid payment ID", http.StatusBadRequest)
		return
	}

	req := &services.DeletePaymentRequest{
		PaymentId: int32(paymentID),
	}

	if _, err := debtService.DeletePayment(context.TODO(), req); err != nil {
		log.Printf("Error deleting payment %d: %v", paymentID, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
