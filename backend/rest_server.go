package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"freesplit/internal/database"
	"freesplit/internal/server"
	pb "freesplit/proto"

	"github.com/glebarez/sqlite"
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

	// Create service instances
	groupService := server.NewGroupService(db)
	participantService := server.NewParticipantService(db)
	expenseService := server.NewExpenseService(db)
	debtService := server.NewDebtService(db)

	// CORS middleware
	corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			next(w, r)
		}
	}

	// Group endpoints
	http.HandleFunc("/api/groups", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "POST":
			createGroup(w, r, groupService)
		case "GET":
			getGroup(w, r, groupService)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	http.HandleFunc("/api/groups/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "PUT":
			updateGroup(w, r, groupService)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// Participant endpoints
	http.HandleFunc("/api/participants", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "POST":
			addParticipant(w, r, participantService)
		case "PUT":
			updateParticipant(w, r, participantService)
		case "DELETE":
			deleteParticipant(w, r, participantService)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// Expense endpoints
	http.HandleFunc("/api/expenses", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			getExpensesByGroup(w, r, expenseService)
		case "POST":
			createExpense(w, r, expenseService)
		case "PUT":
			updateExpense(w, r, expenseService)
		case "DELETE":
			deleteExpense(w, r, expenseService)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// Single expense endpoint
	http.HandleFunc("/api/expense/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			getExpenseWithSplits(w, r, expenseService)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// Debt endpoints
	http.HandleFunc("/api/debts", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			getDebts(w, r, debtService)
		case "PUT":
			updateDebtPaidAmount(w, r, debtService)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	log.Println("REST API server listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// Group handlers
func createGroup(w http.ResponseWriter, r *http.Request, groupService *server.GroupService) {
	var req struct {
		Name             string   `json:"name"`
		Currency         string   `json:"currency"`
		ParticipantNames []string `json:"participant_names"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Create gRPC request
	grpcReq := &pb.CreateGroupRequest{
		Name:             req.Name,
		Currency:         req.Currency,
		ParticipantNames: req.ParticipantNames,
	}

	// Call gRPC service
	resp, err := groupService.CreateGroup(nil, grpcReq)
	if err != nil {
		log.Printf("Error creating group: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Convert to JSON response
	response := map[string]interface{}{
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
		response["participants"].([]map[string]interface{})[i] = map[string]interface{}{
			"id":       p.Id,
			"name":     p.Name,
			"group_id": p.GroupId,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getGroup(w http.ResponseWriter, r *http.Request, groupService *server.GroupService) {
	urlSlug := r.URL.Query().Get("url_slug")
	if urlSlug == "" {
		http.Error(w, "url_slug parameter required", http.StatusBadRequest)
		return
	}

	grpcReq := &pb.GetGroupRequest{UrlSlug: urlSlug}
	resp, err := groupService.GetGroup(nil, grpcReq)
	if err != nil {
		log.Printf("Error getting group: %v", err)
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	response := map[string]interface{}{
		"id":              resp.Group.Id,
		"url_slug":        resp.Group.UrlSlug,
		"name":            resp.Group.Name,
		"settle_up_date":  resp.Group.SettleUpDate,
		"state":           resp.Group.State,
		"currency":        resp.Group.Currency,
		"participant_ids": resp.Group.ParticipantIds,
		"expense_ids":     resp.Group.ExpenseIds,
		"participants":    make([]map[string]interface{}, len(resp.Participants)),
	}

	// Add participants
	for i, p := range resp.Participants {
		response["participants"].([]map[string]interface{})[i] = map[string]interface{}{
			"id":       p.Id,
			"name":     p.Name,
			"group_id": p.GroupId,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func updateGroup(w http.ResponseWriter, r *http.Request, groupService *server.GroupService) {
	var req struct {
		Name          string `json:"name"`
		Currency      string `json:"currency"`
		ParticipantID int32  `json:"participant_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	grpcReq := &pb.UpdateGroupRequest{
		Name:          req.Name,
		Currency:      req.Currency,
		ParticipantId: req.ParticipantID,
	}

	resp, err := groupService.UpdateGroup(nil, grpcReq)
	if err != nil {
		log.Printf("Error updating group: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"id":              resp.Group.Id,
		"url_slug":        resp.Group.UrlSlug,
		"name":            resp.Group.Name,
		"settle_up_date":  resp.Group.SettleUpDate,
		"state":           resp.Group.State,
		"currency":        resp.Group.Currency,
		"participant_ids": resp.Group.ParticipantIds,
		"expense_ids":     resp.Group.ExpenseIds,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Participant handlers
func addParticipant(w http.ResponseWriter, r *http.Request, participantService *server.ParticipantService) {
	var req struct {
		Name    string `json:"name"`
		GroupID int32  `json:"group_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	grpcReq := &pb.AddParticipantRequest{
		Name:    req.Name,
		GroupId: req.GroupID,
	}

	resp, err := participantService.AddParticipant(nil, grpcReq)
	if err != nil {
		log.Printf("Error adding participant: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"id":       resp.Participant.Id,
		"name":     resp.Participant.Name,
		"group_id": resp.Participant.GroupId,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func updateParticipant(w http.ResponseWriter, r *http.Request, participantService *server.ParticipantService) {
	var req struct {
		Name          string `json:"name"`
		ParticipantID int32  `json:"participant_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	grpcReq := &pb.UpdateParticipantRequest{
		Name:          req.Name,
		ParticipantId: req.ParticipantID,
	}

	resp, err := participantService.UpdateParticipant(nil, grpcReq)
	if err != nil {
		log.Printf("Error updating participant: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"id":       resp.Participant.Id,
		"name":     resp.Participant.Name,
		"group_id": resp.Participant.GroupId,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func deleteParticipant(w http.ResponseWriter, r *http.Request, participantService *server.ParticipantService) {
	participantIDStr := r.URL.Query().Get("participant_id")
	if participantIDStr == "" {
		http.Error(w, "participant_id parameter required", http.StatusBadRequest)
		return
	}

	participantID, err := strconv.ParseInt(participantIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid participant_id", http.StatusBadRequest)
		return
	}

	grpcReq := &pb.DeleteParticipantRequest{
		ParticipantId: int32(participantID),
	}

	_, err = participantService.DeleteParticipant(nil, grpcReq)
	if err != nil {
		log.Printf("Error deleting participant: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// Expense handlers
func getExpensesByGroup(w http.ResponseWriter, r *http.Request, expenseService *server.ExpenseService) {
	groupIDStr := r.URL.Query().Get("group_id")
	if groupIDStr == "" {
		http.Error(w, "group_id parameter required", http.StatusBadRequest)
		return
	}

	groupID, err := strconv.ParseInt(groupIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid group_id", http.StatusBadRequest)
		return
	}

	grpcReq := &pb.GetExpensesByGroupRequest{
		GroupId: int32(groupID),
	}

	resp, err := expenseService.GetExpensesByGroup(nil, grpcReq)
	if err != nil {
		log.Printf("Error getting expenses: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	expenses := make([]map[string]interface{}, len(resp.Expenses))
	for i, expense := range resp.Expenses {
		expenses[i] = map[string]interface{}{
			"id":         expense.Id,
			"name":       expense.Name,
			"cost":       expense.Cost,
			"emoji":      expense.Emoji,
			"payer_id":   expense.PayerId,
			"split_type": expense.SplitType,
			"split_ids":  expense.SplitIds,
			"group_id":   expense.GroupId,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(expenses)
}

func createExpense(w http.ResponseWriter, r *http.Request, expenseService *server.ExpenseService) {
	var req struct {
		Expense struct {
			ID        int32   `json:"id"`
			Name      string  `json:"name"`
			Cost      float64 `json:"cost"`
			Emoji     string  `json:"emoji"`
			PayerID   int32   `json:"payer_id"`
			SplitType string  `json:"split_type"`
			SplitIds  []int32 `json:"split_ids"`
			GroupID   int32   `json:"group_id"`
		} `json:"expense"`
		Splits []struct {
			SplitID       int32   `json:"split_id"`
			GroupID       int32   `json:"group_id"`
			ExpenseID     int32   `json:"expense_id"`
			ParticipantID int32   `json:"participant_id"`
			SplitAmount   float64 `json:"split_amount"`
		} `json:"splits"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Create gRPC request
	grpcReq := &pb.CreateExpenseRequest{
		Expense: &pb.Expense{
			Id:        req.Expense.ID,
			Name:      req.Expense.Name,
			Cost:      req.Expense.Cost,
			Emoji:     req.Expense.Emoji,
			PayerId:   req.Expense.PayerID,
			SplitType: req.Expense.SplitType,
			SplitIds:  req.Expense.SplitIds,
			GroupId:   req.Expense.GroupID,
		},
		Splits: make([]*pb.Split, len(req.Splits)),
	}

	// Convert splits
	for i, split := range req.Splits {
		grpcReq.Splits[i] = &pb.Split{
			SplitId:       split.SplitID,
			GroupId:       split.GroupID,
			ExpenseId:     split.ExpenseID,
			ParticipantId: split.ParticipantID,
			SplitAmount:   split.SplitAmount,
		}
	}

	// Call gRPC service
	log.Printf("Calling CreateExpense with request: %+v", grpcReq)
	resp, err := expenseService.CreateExpense(context.Background(), grpcReq)
	if err != nil {
		log.Printf("Error creating expense: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if resp == nil {
		log.Printf("CreateExpense returned nil response")
		http.Error(w, "Internal server error: nil response", http.StatusInternalServerError)
		return
	}
	log.Printf("CreateExpense response: %+v", resp)

	// Convert to JSON response
	response := map[string]interface{}{
		"expense": map[string]interface{}{
			"id":         resp.Expense.Id,
			"name":       resp.Expense.Name,
			"cost":       resp.Expense.Cost,
			"emoji":      resp.Expense.Emoji,
			"payer_id":   resp.Expense.PayerId,
			"split_type": resp.Expense.SplitType,
			"split_ids":  resp.Expense.SplitIds,
			"group_id":   resp.Expense.GroupId,
		},
		"splits": make([]map[string]interface{}, len(resp.Splits)),
	}

	// Add splits
	for i, split := range resp.Splits {
		response["splits"].([]map[string]interface{})[i] = map[string]interface{}{
			"split_id":       split.SplitId,
			"group_id":       split.GroupId,
			"expense_id":     split.ExpenseId,
			"participant_id": split.ParticipantId,
			"split_amount":   split.SplitAmount,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func updateExpense(w http.ResponseWriter, r *http.Request, expenseService *server.ExpenseService) {
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

	// Convert splits to protobuf format
	var pbSplits []*pb.Split
	for _, split := range requestData.Splits {
		pbSplits = append(pbSplits, &pb.Split{
			ParticipantId: split.ParticipantID,
			SplitAmount:   split.SplitAmount,
		})
	}

	grpcReq := &pb.UpdateExpenseRequest{
		Expense: &pb.Expense{
			Id:        requestData.Expense.ID,
			Name:      requestData.Expense.Name,
			Cost:      requestData.Expense.Cost,
			Emoji:     requestData.Expense.Emoji,
			PayerId:   requestData.Expense.PayerID,
			SplitType: requestData.Expense.SplitType,
			GroupId:   requestData.Expense.GroupID,
		},
		Splits: pbSplits,
	}

	resp, err := expenseService.UpdateExpense(r.Context(), grpcReq)
	if err != nil {
		log.Printf("Error updating expense: %v", err)
		http.Error(w, "Failed to update expense", http.StatusInternalServerError)
		return
	}

	// Convert response to JSON format
	expense := map[string]interface{}{
		"id":         resp.Expense.Id,
		"name":       resp.Expense.Name,
		"cost":       resp.Expense.Cost,
		"emoji":      resp.Expense.Emoji,
		"payer_id":   resp.Expense.PayerId,
		"split_type": resp.Expense.SplitType,
		"group_id":   resp.Expense.GroupId,
	}

	splits := make([]map[string]interface{}, len(resp.Splits))
	for i, split := range resp.Splits {
		splits[i] = map[string]interface{}{
			"split_id":       split.SplitId,
			"group_id":       split.GroupId,
			"expense_id":     split.ExpenseId,
			"participant_id": split.ParticipantId,
			"split_amount":   split.SplitAmount,
		}
	}

	response := map[string]interface{}{
		"expense": expense,
		"splits":  splits,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func deleteExpense(w http.ResponseWriter, r *http.Request, expenseService *server.ExpenseService) {
	expenseIDStr := r.URL.Query().Get("expense_id")
	if expenseIDStr == "" {
		http.Error(w, "expense_id parameter required", http.StatusBadRequest)
		return
	}

	expenseID, err := strconv.ParseInt(expenseIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid expense_id", http.StatusBadRequest)
		return
	}

	grpcReq := &pb.DeleteExpenseRequest{
		ExpenseId: int32(expenseID),
	}

	_, err = expenseService.DeleteExpense(r.Context(), grpcReq)
	if err != nil {
		log.Printf("Error deleting expense: %v", err)
		http.Error(w, "Failed to delete expense", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// Debt handlers
func getDebts(w http.ResponseWriter, r *http.Request, debtService *server.DebtService) {
	groupIDStr := r.URL.Query().Get("group_id")
	if groupIDStr == "" {
		http.Error(w, "group_id parameter required", http.StatusBadRequest)
		return
	}

	groupID, err := strconv.ParseInt(groupIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid group_id", http.StatusBadRequest)
		return
	}

	grpcReq := &pb.GetDebtsRequest{
		GroupId: int32(groupID),
	}

	resp, err := debtService.GetDebts(nil, grpcReq)
	if err != nil {
		log.Printf("Error getting debts: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	debts := make([]map[string]interface{}, len(resp.Debts))
	for i, debt := range resp.Debts {
		debts[i] = map[string]interface{}{
			"debt_id":     debt.DebtId,
			"group_id":    debt.GroupId,
			"lender_id":   debt.LenderId,
			"debtor_id":   debt.DebtorId,
			"debt_amount": debt.DebtAmount,
			"paid_amount": debt.PaidAmount,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(debts)
}

func updateDebtPaidAmount(w http.ResponseWriter, r *http.Request, debtService *server.DebtService) {
	var req struct {
		DebtID     int32   `json:"debt_id"`
		PaidAmount float64 `json:"paid_amount"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	grpcReq := &pb.UpdateDebtPaidAmountRequest{
		DebtId:     req.DebtID,
		PaidAmount: req.PaidAmount,
	}

	resp, err := debtService.UpdateDebtPaidAmount(nil, grpcReq)
	if err != nil {
		log.Printf("Error updating debt: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"debt_id":     resp.Debt.DebtId,
		"group_id":    resp.Debt.GroupId,
		"lender_id":   resp.Debt.LenderId,
		"debtor_id":   resp.Debt.DebtorId,
		"debt_amount": resp.Debt.DebtAmount,
		"paid_amount": resp.Debt.PaidAmount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getExpenseWithSplits(w http.ResponseWriter, r *http.Request, expenseService *server.ExpenseService) {
	// Extract expense ID from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/expense/")
	expenseId, err := strconv.ParseInt(path, 10, 32)
	if err != nil {
		http.Error(w, "Invalid expense ID", http.StatusBadRequest)
		return
	}

	grpcReq := &pb.GetExpenseWithSplitsRequest{ExpenseId: int32(expenseId)}
	resp, err := expenseService.GetExpenseWithSplits(context.Background(), grpcReq)
	if err != nil {
		log.Printf("Error getting expense with splits: %v", err)
		http.Error(w, "Expense not found", http.StatusNotFound)
		return
	}

	// Convert splits to response format
	splits := make([]map[string]interface{}, len(resp.Splits))
	for i, split := range resp.Splits {
		splits[i] = map[string]interface{}{
			"split_id":       split.SplitId,
			"group_id":       split.GroupId,
			"expense_id":     split.ExpenseId,
			"participant_id": split.ParticipantId,
			"split_amount":   split.SplitAmount,
		}
	}

	response := map[string]interface{}{
		"expense": map[string]interface{}{
			"id":         resp.Expense.Id,
			"name":       resp.Expense.Name,
			"cost":       resp.Expense.Cost,
			"emoji":      resp.Expense.Emoji,
			"payer_id":   resp.Expense.PayerId,
			"split_type": resp.Expense.SplitType,
			"group_id":   resp.Expense.GroupId,
		},
		"splits": splits,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
