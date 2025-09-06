package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

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
	// Simplified implementation for now
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Create expense not implemented yet"})
}

func updateExpense(w http.ResponseWriter, r *http.Request, expenseService *server.ExpenseService) {
	// Simplified implementation for now
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Update expense not implemented yet"})
}

func deleteExpense(w http.ResponseWriter, r *http.Request, expenseService *server.ExpenseService) {
	// Simplified implementation for now
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
