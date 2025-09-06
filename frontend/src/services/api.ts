import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8081';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Group {
  id: number;
  url_slug: string;
  name: string;
  settle_up_date: number;
  state: string;
  currency: string;
  participant_ids: number[];
  expense_ids: number[];
}

export interface Participant {
  id: number;
  name: string;
  group_id: number;
}

export interface Expense {
  id: number;
  name: string;
  cost: number;
  emoji: string;
  payer_id: number;
  split_type: string;
  split_ids: number[];
  group_id: number;
}

export interface Split {
  split_id: number;
  group_id: number;
  expense_id: number;
  participant_id: number;
  split_amount: number;
}

export interface Debt {
  debt_id: number;
  group_id: number;
  lender_id: number;
  debtor_id: number;
  debt_amount: number;
  paid_amount: number;
}

// Group API
export const getGroup = async (urlSlug: string) => {
  const response = await api.get(`/freesplit.GroupService/GetGroup?url_slug=${urlSlug}`);
  return response.data;
};

export const createGroup = async (data: {
  name: string;
  currency: string;
  participant_names: string[];
}) => {
  const response = await api.post('/freesplit.GroupService/CreateGroup', data);
  return response.data;
};

export const updateGroup = async (data: {
  name: string;
  currency: string;
  participant_id: number;
}) => {
  const response = await api.post('/freesplit.GroupService/UpdateGroup', data);
  return response.data;
};

// Participant API
export const addParticipant = async (data: {
  name: string;
  group_id: number;
}) => {
  const response = await api.post('/freesplit.ParticipantService/AddParticipant', data);
  return response.data;
};

export const updateParticipant = async (data: {
  name: string;
  participant_id: number;
}) => {
  const response = await api.post('/freesplit.ParticipantService/UpdateParticipant', data);
  return response.data;
};

export const deleteParticipant = async (participantId: number) => {
  const response = await api.post('/freesplit.ParticipantService/DeleteParticipant', {
    participant_id: participantId
  });
  return response.data;
};

// Expense API
export const getExpensesByGroup = async (groupId: number) => {
  const response = await api.get(`/freesplit.ExpenseService/GetExpensesByGroup?group_id=${groupId}`);
  return response.data;
};

export const getSplitsByParticipant = async (participantId: number) => {
  const response = await api.get(`/freesplit.ExpenseService/GetSplitsByParticipant?participant_id=${participantId}`);
  return response.data;
};

export const getExpenseWithSplits = async (expenseId: number) => {
  const response = await api.get(`/freesplit.ExpenseService/GetExpenseWithSplits?expense_id=${expenseId}`);
  return response.data;
};

export const createExpense = async (data: {
  expense: Expense;
  splits: Split[];
}) => {
  const response = await api.post('/freesplit.ExpenseService/CreateExpense', data);
  return response.data;
};

export const updateExpense = async (data: {
  expense: Expense;
  splits: Split[];
  participant_id: number;
}) => {
  const response = await api.post('/freesplit.ExpenseService/UpdateExpense', data);
  return response.data;
};

export const deleteExpense = async (data: {
  expense_id: number;
  splits: Split[];
}) => {
  const response = await api.post('/freesplit.ExpenseService/DeleteExpense', data);
  return response.data;
};

// Debt API
export const getDebts = async (groupId: number) => {
  const response = await api.get(`/freesplit.DebtService/GetDebts?group_id=${groupId}`);
  return response.data;
};

export const updateDebtPaidAmount = async (data: {
  debt_id: number;
  paid_amount: number;
}) => {
  const response = await api.post('/freesplit.DebtService/UpdateDebtPaidAmount', data);
  return response.data;
};

