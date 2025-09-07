import axios from 'axios';

// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

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
  participants?: Participant[];
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
export const getGroup = async (urlSlug: string): Promise<{group: Group, participants: Participant[]}> => {
  const response = await axios.get(`${API_BASE_URL}/api/groups?url_slug=${urlSlug}`);
  return {
    group: response.data,
    participants: response.data.participants || []
  };
};

export const createGroup = async (data: {
  name: string;
  currency: string;
  participant_names: string[];
}): Promise<Group> => {
  const response = await axios.post(`${API_BASE_URL}/api/groups`, {
    name: data.name,
    currency: data.currency,
    participant_names: data.participant_names
  });
  return response.data.group;
};

export const updateGroup = async (data: {
  name: string;
  currency: string;
  participant_id: number;
}): Promise<Group> => {
  const response = await axios.put(`${API_BASE_URL}/api/groups/`, {
    name: data.name,
    currency: data.currency,
    participant_id: data.participant_id
  });
  return response.data;
};

// Participant API
export const addParticipant = async (data: {
  name: string;
  group_id: number;
}): Promise<Participant> => {
  const response = await axios.post(`${API_BASE_URL}/api/participants`, {
    name: data.name,
    group_id: data.group_id
  });
  return response.data;
};

export const updateParticipant = async (data: {
  name: string;
  participant_id: number;
}): Promise<Participant> => {
  const response = await axios.put(`${API_BASE_URL}/api/participants`, {
    name: data.name,
    participant_id: data.participant_id
  });
  return response.data;
};

export const deleteParticipant = async (participantId: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/participants?participant_id=${participantId}`);
};

// Expense API
export const getExpensesByGroup = async (groupId: number): Promise<Expense[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/expenses?group_id=${groupId}`);
  return response.data;
};

export const getSplitsByParticipant = async (participantId: number): Promise<Split[]> => {
  // Simplified implementation for now
  return [];
};

export const getExpenseWithSplits = async (expenseId: number): Promise<{expense: Expense, splits: Split[]}> => {
  const response = await axios.get(`${API_BASE_URL}/api/expense/${expenseId}`);
  return {
    expense: response.data.expense,
    splits: response.data.splits
  };
};

export const createExpense = async (data: {
  expense: Expense;
  splits: Split[];
}): Promise<{expense: Expense, splits: Split[]}> => {
  const response = await axios.post(`${API_BASE_URL}/api/expenses`, {
    expense: data.expense,
    splits: data.splits
  });
  return {
    expense: response.data.expense,
    splits: response.data.splits
  };
};

export const updateExpense = async (data: {
  expense: Expense;
  splits: Split[];
}): Promise<{expense: Expense, splits: Split[]}> => {
  const response = await axios.put(`${API_BASE_URL}/api/expenses`, {
    expense: data.expense,
    splits: data.splits
  });
  return {
    expense: response.data.expense,
    splits: response.data.splits
  };
};

export const deleteExpense = async (expenseId: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/expenses?expense_id=${expenseId}`);
};


// Debt API
export const getDebts = async (groupId: number): Promise<Debt[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/debts?group_id=${groupId}`);
  return response.data;
};

export const updateDebtPaidAmount = async (data: {
  debt_id: number;
  paid_amount: number;
}): Promise<Debt> => {
  const response = await axios.put(`${API_BASE_URL}/api/debts`, {
    debt_id: data.debt_id,
    paid_amount: data.paid_amount
  });
  return response.data;
};