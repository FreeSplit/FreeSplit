import { grpc } from 'grpc-web';
import { 
  ExpenseServiceClient,
  GroupServiceClient,
  ParticipantServiceClient,
  DebtServiceClient
} from '../proto/src/proto/expense_grpc_web_pb';
import {
  GetGroupRequest,
  CreateGroupRequest,
  UpdateGroupRequest,
  AddParticipantRequest,
  UpdateParticipantRequest,
  DeleteParticipantRequest,
  GetExpensesByGroupRequest,
  GetSplitsByParticipantRequest,
  GetExpenseWithSplitsRequest,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  DeleteExpenseRequest,
  GetDebtsRequest,
  UpdateDebtPaidAmountRequest
} from '../proto/src/proto/expense_pb';

// gRPC-Web client configuration
const GRPC_HOST = process.env.REACT_APP_GRPC_HOST || 'http://localhost:8080';

// Create gRPC clients
const groupClient = new GroupServiceClient(GRPC_HOST);
const participantClient = new ParticipantServiceClient(GRPC_HOST);
const expenseClient = new ExpenseServiceClient(GRPC_HOST);
const debtClient = new DebtServiceClient(GRPC_HOST);

// Types (matching the protobuf messages)
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
export const getGroup = async (urlSlug: string): Promise<Group> => {
  return new Promise((resolve, reject) => {
    const request = new GetGroupRequest();
    request.setUrlSlug(urlSlug);
    
    groupClient.getGroup(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.toObject() as Group);
    });
  });
};

export const createGroup = async (data: {
  name: string;
  currency: string;
  participant_names: string[];
}): Promise<Group> => {
  return new Promise((resolve, reject) => {
    const request = new CreateGroupRequest();
    request.setName(data.name);
    request.setCurrency(data.currency);
    request.setParticipantNamesList(data.participant_names);
    
    groupClient.createGroup(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.toObject() as Group);
    });
  });
};

export const updateGroup = async (data: {
  name: string;
  currency: string;
  participant_id: number;
}): Promise<Group> => {
  return new Promise((resolve, reject) => {
    const request = new UpdateGroupRequest();
    request.setName(data.name);
    request.setCurrency(data.currency);
    request.setParticipantId(data.participant_id);
    
    groupClient.updateGroup(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.toObject() as Group);
    });
  });
};

// Participant API
export const addParticipant = async (data: {
  name: string;
  group_id: number;
}): Promise<Participant> => {
  return new Promise((resolve, reject) => {
    const request = new AddParticipantRequest();
    request.setName(data.name);
    request.setGroupId(data.group_id);
    
    participantClient.addParticipant(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.toObject() as Participant);
    });
  });
};

export const updateParticipant = async (data: {
  name: string;
  participant_id: number;
}): Promise<Participant> => {
  return new Promise((resolve, reject) => {
    const request = new UpdateParticipantRequest();
    request.setName(data.name);
    request.setParticipantId(data.participant_id);
    
    participantClient.updateParticipant(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.toObject() as Participant);
    });
  });
};

export const deleteParticipant = async (participantId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = new DeleteParticipantRequest();
    request.setParticipantId(participantId);
    
    participantClient.deleteParticipant(request, {}, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};

// Expense API
export const getExpensesByGroup = async (groupId: number): Promise<Expense[]> => {
  return new Promise((resolve, reject) => {
    const request = new GetExpensesByGroupRequest();
    request.setGroupId(groupId);
    
    expenseClient.getExpensesByGroup(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.getExpensesList().map(expense => expense.toObject()) as Expense[]);
    });
  });
};

export const getSplitsByParticipant = async (participantId: number): Promise<Split[]> => {
  return new Promise((resolve, reject) => {
    const request = new GetSplitsByParticipantRequest();
    request.setParticipantId(participantId);
    
    expenseClient.getSplitsByParticipant(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.getSplitsList().map(split => split.toObject()) as Split[]);
    });
  });
};

export const getExpenseWithSplits = async (expenseId: number): Promise<{expense: Expense, splits: Split[]}> => {
  return new Promise((resolve, reject) => {
    const request = new GetExpenseWithSplitsRequest();
    request.setExpenseId(expenseId);
    
    expenseClient.getExpenseWithSplits(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({
        expense: response?.getExpense()?.toObject() as Expense,
        splits: response?.getSplitsList().map(split => split.toObject()) as Split[]
      });
    });
  });
};

export const createExpense = async (data: {
  expense: Expense;
  splits: Split[];
}): Promise<Expense> => {
  return new Promise((resolve, reject) => {
    const request = new CreateExpenseRequest();
    // Note: You'll need to create the expense and splits objects from the protobuf messages
    // This is a simplified version - you'll need to properly construct the protobuf objects
    
    expenseClient.createExpense(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.toObject() as Expense);
    });
  });
};

export const updateExpense = async (data: {
  expense: Expense;
  splits: Split[];
  participant_id: number;
}): Promise<Expense> => {
  return new Promise((resolve, reject) => {
    const request = new UpdateExpenseRequest();
    // Note: You'll need to create the expense and splits objects from the protobuf messages
    
    expenseClient.updateExpense(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.toObject() as Expense);
    });
  });
};

export const deleteExpense = async (data: {
  expense_id: number;
  splits: Split[];
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = new DeleteExpenseRequest();
    request.setExpenseId(data.expense_id);
    
    expenseClient.deleteExpense(request, {}, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};

// Debt API
export const getDebts = async (groupId: number): Promise<Debt[]> => {
  return new Promise((resolve, reject) => {
    const request = new GetDebtsRequest();
    request.setGroupId(groupId);
    
    debtClient.getDebts(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.getDebtsList().map(debt => debt.toObject()) as Debt[]);
    });
  });
};

export const updateDebtPaidAmount = async (data: {
  debt_id: number;
  paid_amount: number;
}): Promise<Debt> => {
  return new Promise((resolve, reject) => {
    const request = new UpdateDebtPaidAmountRequest();
    request.setDebtId(data.debt_id);
    request.setPaidAmount(data.paid_amount);
    
    debtClient.updateDebtPaidAmount(request, {}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response?.toObject() as Debt);
    });
  });
};
