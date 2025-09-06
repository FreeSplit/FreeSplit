import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { getGroup, getExpenseWithSplits, updateExpense, deleteExpense } from '../services/api';
import { Group, Participant, Expense, Split } from '../services/api';
import toast from 'react-hot-toast';

const EditExpense: React.FC = () => {
  const { urlSlug, expenseId } = useParams<{ urlSlug: string; expenseId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    emoji: '💰',
    payer_id: 0,
    split_type: 'equal'
  });

  const [splits, setSplits] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    if (urlSlug && expenseId) {
      loadExpenseData();
    }
  }, [urlSlug, expenseId]);

  const loadExpenseData = async () => {
    try {
      setLoading(true);
      const [groupResponse, expenseResponse] = await Promise.all([
        getGroup(urlSlug!),
        getExpenseWithSplits(parseInt(expenseId!))
      ]);

      setGroup(groupResponse.group);
      setParticipants(groupResponse.participants);

      const expense = expenseResponse.expense;
      setFormData({
        name: expense.name,
        cost: expense.cost.toString(),
        emoji: expense.emoji,
        payer_id: expense.payer_id,
        split_type: expense.split_type
      });

      // Initialize splits from existing data
      const initialSplits: { [key: number]: number } = {};
      expenseResponse.splits.forEach((split: any) => {
        initialSplits[split.participant_id] = split.split_amount;
      });
      setSplits(initialSplits);
    } catch (error) {
      toast.error('Failed to load expense data');
      console.error('Error loading expense data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Recalculate equal splits when cost changes
    if (field === 'cost' && formData.split_type === 'equal') {
      const cost = parseFloat(value as string) || 0;
      const equalAmount = participants.length > 0 ? cost / participants.length : 0;
      const newSplits: { [key: number]: number } = {};
      participants.forEach(participant => {
        newSplits[participant.id] = equalAmount;
      });
      setSplits(newSplits);
    }
  };

  const handleSplitChange = (participantId: number, amount: string) => {
    const value = parseFloat(amount) || 0;
    setSplits(prev => ({
      ...prev,
      [participantId]: value
    }));
  };

  const validateSplits = () => {
    const totalCost = parseFloat(formData.cost) || 0;
    const totalSplits = Object.values(splits).reduce((sum, amount) => sum + amount, 0);
    return Math.abs(totalCost - totalSplits) < 0.01;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSplits()) {
      toast.error('Split amounts must equal the total cost');
      return;
    }

    if (formData.payer_id === 0) {
      toast.error('Please select who paid for this expense');
      return;
    }

    try {
      setSubmitting(true);
      
      const expense: Expense = {
        id: parseInt(expenseId!),
        name: formData.name,
        cost: parseFloat(formData.cost),
        emoji: formData.emoji,
        payer_id: formData.payer_id,
        split_type: formData.split_type,
        split_ids: [], // Will be set by backend
        group_id: group!.id
      };

      const splitArray: Split[] = Object.entries(splits)
        .filter(([_, amount]) => amount > 0)
        .map(([participantId, amount]) => ({
          split_id: 0, // Will be set by backend
          group_id: group!.id,
          expense_id: parseInt(expenseId!),
          participant_id: parseInt(participantId),
          split_amount: amount
        }));

      await updateExpense({
        expense,
        splits: splitArray,
        participant_id: formData.payer_id
      });

      toast.success('Expense updated successfully!');
      navigate(`/group/${urlSlug}`);
    } catch (error) {
      toast.error('Failed to update expense');
      console.error('Error updating expense:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
      return;
    }

    try {
      setSubmitting(true);
      
      const splitArray: Split[] = Object.entries(splits)
        .filter(([_, amount]) => amount > 0)
        .map(([participantId, amount]) => ({
          split_id: 0,
          group_id: group!.id,
          expense_id: parseInt(expenseId!),
          participant_id: parseInt(participantId),
          split_amount: amount
        }));

      await deleteExpense({
        expense_id: parseInt(expenseId!),
        splits: splitArray
      });

      toast.success('Expense deleted successfully!');
      navigate(`/group/${urlSlug}`);
    } catch (error) {
      toast.error('Failed to delete expense');
      console.error('Error deleting expense:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading expense data...</p>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate(`/group/${urlSlug}`)}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Edit Expense</h1>
            </div>
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
            >
              <Trash2 className="w-5 h-5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Expense Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Dinner at Restaurant"
                  required
                />
              </div>

              <div>
                <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-2">
                  Total Cost
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {group.currency}
                  </span>
                  <input
                    type="number"
                    id="cost"
                    value={formData.cost}
                    onChange={(e) => handleInputChange('cost', e.target.value)}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="emoji" className="block text-sm font-medium text-gray-700 mb-2">
                  Emoji
                </label>
                <input
                  type="text"
                  id="emoji"
                  value={formData.emoji}
                  onChange={(e) => handleInputChange('emoji', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl"
                  maxLength={2}
                />
              </div>

              <div>
                <label htmlFor="payer" className="block text-sm font-medium text-gray-700 mb-2">
                  Who Paid?
                </label>
                <select
                  id="payer"
                  value={formData.payer_id}
                  onChange={(e) => handleInputChange('payer_id', parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value={0}>Select payer</option>
                  {participants.map(participant => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Split Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                How to Split
              </label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => handleInputChange('split_type', 'equal')}
                  className={`p-4 border rounded-lg text-center ${
                    formData.split_type === 'equal'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">Equal</div>
                  <div className="text-sm text-gray-500">Split equally</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('split_type', 'amount')}
                  className={`p-4 border rounded-lg text-center ${
                    formData.split_type === 'amount'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">Amount</div>
                  <div className="text-sm text-gray-500">Custom amounts</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('split_type', 'shares')}
                  className={`p-4 border rounded-lg text-center ${
                    formData.split_type === 'shares'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">Shares</div>
                  <div className="text-sm text-gray-500">By percentage</div>
                </button>
              </div>
            </div>

            {/* Split Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Split Details
              </label>
              <div className="space-y-3">
                {participants.map(participant => (
                  <div key={participant.id} className="flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {participant.name}
                      </label>
                    </div>
                    <div className="w-32">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                          {group.currency}
                        </span>
                        <input
                          type="number"
                          value={splits[participant.id] || 0}
                          onChange={(e) => handleSplitChange(participant.id, e.target.value)}
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          step="0.01"
                          min="0"
                          disabled={formData.split_type === 'equal'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Total:</span>
                  <span className="font-bold text-lg">
                    {group.currency} {Object.values(splits).reduce((sum, amount) => sum + amount, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate(`/group/${urlSlug}`)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !validateSplits()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Updating...' : 'Update Expense'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditExpense;
