import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Users, DollarSign, Receipt, Settings } from 'lucide-react';
import { getGroup, getExpensesByGroup, getDebts, deleteExpense } from '../services/api';
import { Group, Expense, Debt, Participant } from '../services/api';
import toast from 'react-hot-toast';

const GroupDashboard: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (urlSlug) {
      loadGroupData();
    }
  }, [urlSlug]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      const groupResponse = await getGroup(urlSlug!);
      
      const [expensesResponse, debtsResponse] = await Promise.all([
        getExpensesByGroup(groupResponse.group.id),
        getDebts(groupResponse.group.id)
      ]);

      setGroup(groupResponse.group);
      setParticipants(groupResponse.participants);
      setExpenses(expensesResponse);
      setDebts(debtsResponse);
    } catch (error) {
      toast.error('Failed to load group data');
      console.error('Error loading group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalSpent = () => {
    return expenses.reduce((total, expense) => total + expense.cost, 0);
  };

  const calculateParticipantSpent = (participantId: number) => {
    return expenses
      .filter(expense => expense.payer_id === participantId)
      .reduce((total, expense) => total + expense.cost, 0);
  };

  const getParticipantName = (participantId: number) => {
    const participant = participants.find(p => p.id === participantId);
    return participant?.name || 'Unknown';
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteExpense(expenseId);
        toast.success('Expense deleted successfully');
        // Reload expenses
        const expensesResponse = await getExpensesByGroup(group!.id);
        setExpenses(expensesResponse);
      } catch (error) {
        toast.error('Failed to delete expense');
        console.error('Error deleting expense:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading group data...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Group not found</h1>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Create New Group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
              <p className="text-gray-600">Share this link: {window.location.href}</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => navigate(`/group/${urlSlug}/members`)}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <Users className="w-5 h-5" />
                <span>Members</span>
              </button>
              <button
                onClick={() => navigate(`/group/${urlSlug}/debts`)}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <DollarSign className="w-5 h-5" />
                <span>Debts</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Receipt className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">
                  {group.currency} {calculateTotalSpent().toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Members</p>
                <p className="text-2xl font-bold text-gray-900">{participants.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Expenses</p>
                <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/group/${urlSlug}/expenses/add`)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Expense</span>
          </button>
        </div>

        {/* Recent Expenses */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Expenses</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {expenses.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No expenses yet. Add your first expense to get started!</p>
              </div>
            ) : (
              expenses.slice(0, 5).map((expense) => (
                <div key={expense.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{expense.emoji}</span>
                      <div>
                        <p className="font-medium text-gray-900">{expense.name}</p>
                        <p className="text-sm text-gray-500">
                          Paid by {getParticipantName(expense.payer_id)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {group.currency} {expense.cost.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">{expense.split_type}</p>
                      <p className="text-xs text-gray-400">Added recently</p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => navigate(`/group/${urlSlug}/expenses/${expense.id}/edit`)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Edit expense"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete expense"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Member Spending Summary */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Member Spending</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {participants.map((participant) => (
              <div key={participant.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{participant.name}</p>
                    <p className="text-sm text-gray-500">Total spent</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {group.currency} {calculateParticipantSpent(participant.id).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupDashboard;

