import axios from 'axios';


// Force production URL if we're not on localhost
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalhost ? 'http://localhost:8080' : (process.env.REACT_APP_API_URL || 'https://freesplit-backend.onrender.com');

// Debug logging
console.log('Environment variables:', {
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  NODE_ENV: process.env.NODE_ENV,
  API_BASE_URL: API_BASE_URL,
  isLocalhost: isLocalhost,
  currentHostname: window.location.hostname
});

// Create axios instance with cache control
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.config?.url, error.message);
    return Promise.reject(error);
  }
);

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
  const response = await apiClient.get(`/api/group/${urlSlug}`);
  return {
    group: response.data.group,
    participants: response.data.participants || []
  };
};

export const createGroup = async (data: {
  name: string;
  currency: string;
  participant_names: string[];
}): Promise<Group> => {
  const response = await apiClient.post(`/api/group`, {
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
  const response = await axios.put(`${API_BASE_URL}/api/group/`, {
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
  const response = await axios.post(`${API_BASE_URL}/api/group/participants`, {
    name: data.name,
    group_id: data.group_id
  });
  return response.data;
};

export const updateParticipant = async (data: {
  name: string;
  participant_id: number;
}): Promise<Participant> => {
  try {
    const response = await axios.put(`${API_BASE_URL}/api/participants/${data.participant_id}`, {
      name: data.name,
      participant_id: data.participant_id
    });
    return response.data.participant;
  } catch (error: any) {
    // Extract error message from response if available
    if (error.response?.data) {
      throw new Error(error.response.data);
    }
    throw error;
  }
};

export const deleteParticipant = async (participantId: number): Promise<void> => {
  try {
    await axios.delete(`${API_BASE_URL}/api/participants/${participantId}`);
  } catch (error: any) {
    // Extract error message from response if available
    if (error.response?.data) {
      throw new Error(error.response.data);
    }
    throw error;
  }
};

// Expense API
export const getExpensesByGroup = async (groupId: number): Promise<Expense[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/group/${groupId}/expenses`);
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
  const response = await axios.post(`${API_BASE_URL}/api/group/${data.expense.group_id}/expenses`, {
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
  const response = await axios.put(`${API_BASE_URL}/api/expense/`, {
    expense: data.expense,
    splits: data.splits
  });
  return {
    expense: response.data.expense,
    splits: response.data.splits
  };
};

export const deleteExpense = async (expenseId: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/expense/${expenseId}`);
};


// Debt API
export const getDebts = async (groupId: number): Promise<Debt[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/group/${groupId}/debts`);
  console.log('Getting debts:', response.data);
  
  // Transform the response to match the Debt interface
  return response.data.map((debt: any) => ({
    debt_id: debt.id,
    group_id: debt.group_id,
    lender_id: debt.lender_id,
    debtor_id: debt.debtor_id,
    debt_amount: debt.debt_amount,
    paid_amount: debt.paid_amount
  }));
};

export const updateDebtPaidAmount = async (data: {
  debt_id: number;
  paid_amount: number;
}): Promise<Debt> => {
  try {
    console.log('Updating debt paid amount:', data);
    const response = await axios.put(`${API_BASE_URL}/api/debts/paid`, {
      debt_id: data.debt_id,
      paid_amount: data.paid_amount
    });
    return response.data.debt;
  } catch (error: any) {
    // Extract error message from response if available
    if (error.response?.data) {
      throw new Error(error.response.data);
    }
    throw error;
  }
};