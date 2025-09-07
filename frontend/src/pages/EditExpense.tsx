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
  const [shares, setShares] = useState<{ [key: number]: number }>({});
  const [percentages, setPercentages] = useState<{ [key: number]: number }>({});

  // Helper function to round to 2 decimal places
  const roundToTwoDecimals = (num: number): number => {
    return Math.round(num * 100) / 100;
  };

  // Helper function to distribute remainder to last person
  const distributeWithRemainder = (amounts: number[], total: number): number[] => {
    const rounded = amounts.map(roundToTwoDecimals);
    const sum = rounded.reduce((acc, val) => acc + val, 0);
    const remainder = roundToTwoDecimals(total - sum);
    
    if (remainder !== 0 && rounded.length > 0) {
      rounded[rounded.length - 1] = roundToTwoDecimals(rounded[rounded.length - 1] + remainder);
    }
    
    return rounded;
  };

  // Calculate amounts from shares
  const calculateAmountsFromShares = (shares: { [key: number]: number }, cost: number): { [key: number]: number } => {
    const amounts: { [key: number]: number } = {};
    const totalShares = Object.values(shares).reduce((sum, val) => sum + val, 0);
    
    if (totalShares > 0) {
      const amountsArray = Object.entries(shares).map(([id, share]) => (share / totalShares) * cost);
      const distributed = distributeWithRemainder(amountsArray, cost);
      
      Object.keys(shares).forEach((id, index) => {
        amounts[Number(id)] = distributed[index];
      });
    }
    
    return amounts;
  };

  // Calculate amounts from percentages
  const calculateAmountsFromPercentages = (percentages: { [key: number]: number }, cost: number): { [key: number]: number } => {
    const amounts: { [key: number]: number } = {};
    
    Object.entries(percentages).forEach(([id, percentage]) => {
      amounts[Number(id)] = roundToTwoDecimals((percentage / 100) * cost);
    });
    
    return amounts;
  };

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
      console.log('Expense data loaded:', expense);
      console.log('Splits data loaded:', expenseResponse.splits);
      
      setFormData({
        name: expense.name || '',
        cost: (expense.cost || 0).toString(),
        emoji: expense.emoji || '💰',
        payer_id: expense.payer_id || 0,
        split_type: expense.split_type || 'equal'
      });

      // Initialize splits from existing data, but include all current group members
      const initialSplits: { [key: number]: number } = {};
      const initialShares: { [key: number]: number } = {};
      const initialPercentages: { [key: number]: number } = {};
      
      // First, initialize all current participants with 0
      groupResponse.participants.forEach(participant => {
        initialSplits[participant.id] = 0;
        initialShares[participant.id] = 1; // Default to 1 share each
        initialPercentages[participant.id] = 0; // Will be calculated
      });
      
      // Then, set the amounts from existing splits
      expenseResponse.splits.forEach((split: any) => {
        initialSplits[split.participant_id] = split.split_amount;
      });
      
      // If this is an equal split, recalculate for all participants
      if (expense.split_type === 'equal') {
        const cost = expense.cost || 0;
        const equalAmount = groupResponse.participants.length > 0 ? cost / groupResponse.participants.length : 0;
        groupResponse.participants.forEach(participant => {
          initialSplits[participant.id] = equalAmount;
        });
      } else if (expense.split_type === 'shares') {
        // Convert amounts to shares
        const cost = expense.cost || 0;
        const equalAmount = groupResponse.participants.length > 0 ? cost / groupResponse.participants.length : 0;
        groupResponse.participants.forEach(participant => {
          const amount = initialSplits[participant.id] || 0;
          initialShares[participant.id] = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
        });
      } else if (expense.split_type === 'percentage') {
        // Convert amounts to percentages
        const cost = expense.cost || 0;
        groupResponse.participants.forEach(participant => {
          const amount = initialSplits[participant.id] || 0;
          initialPercentages[participant.id] = cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
        });
      }
      
      setSplits(initialSplits);
      setShares(initialShares);
      setPercentages(initialPercentages);
    } catch (error) {
      toast.error('Failed to load expense data');
      console.error('Error loading expense data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    const oldSplitType = formData.split_type;
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    const cost = parseFloat(formData.cost) || 0;
    
    // Handle split type changes with seamless conversion
    if (field === 'split_type') {
      const newSplitType = value as string;
      
      if (newSplitType === 'equal') {
        const equalAmount = participants.length > 0 ? cost / participants.length : 0;
        const newSplits: { [key: number]: number } = {};
        participants.forEach(participant => {
          newSplits[participant.id] = equalAmount;
        });
        setSplits(newSplits);
      } else if (newSplitType === 'shares') {
        // Convert current amounts to shares
        const newShares: { [key: number]: number } = {};
        const equalAmount = participants.length > 0 ? cost / participants.length : 0;
        participants.forEach(participant => {
          const amount = splits[participant.id] || 0;
          newShares[participant.id] = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
        });
        setShares(newShares);
      } else if (newSplitType === 'percentage') {
        // Convert current amounts to percentages
        const newPercentages: { [key: number]: number } = {};
        participants.forEach(participant => {
          const amount = splits[participant.id] || 0;
          newPercentages[participant.id] = cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
        });
        setPercentages(newPercentages);
      } else if (newSplitType === 'amount') {
        // Keep current amounts but ensure they sum to cost
        const currentTotal = Object.values(splits).reduce((sum, val) => sum + val, 0);
        if (currentTotal > 0 && cost > 0) {
          const multiplier = cost / currentTotal;
          const amounts = participants.map(p => (splits[p.id] || 0) * multiplier);
          const distributed = distributeWithRemainder(amounts, cost);
          const newSplits: { [key: number]: number } = {};
          participants.forEach((participant, index) => {
            newSplits[participant.id] = distributed[index];
          });
          setSplits(newSplits);
        }
      }
    }
    
    // Recalculate splits when cost changes
    if (field === 'cost') {
      if (formData.split_type === 'equal') {
        const equalAmount = participants.length > 0 ? cost / participants.length : 0;
        const newSplits: { [key: number]: number } = {};
        participants.forEach(participant => {
          newSplits[participant.id] = equalAmount;
        });
        setSplits(newSplits);
      } else if (formData.split_type === 'shares') {
        const newAmounts = calculateAmountsFromShares(shares, cost);
        setSplits(newAmounts);
      } else if (formData.split_type === 'percentage') {
        const newAmounts = calculateAmountsFromPercentages(percentages, cost);
        setSplits(newAmounts);
      }
    }
  };

  const handleSplitChange = (participantId: number, amount: string) => {
    const value = parseFloat(amount) || 0;
    setSplits(prev => ({
      ...prev,
      [participantId]: value
    }));
  };

  const handleShareChange = (participantId: number, share: string) => {
    const value = Math.max(1, Math.round(parseFloat(share) || 1));
    setShares(prev => ({
      ...prev,
      [participantId]: value
    }));
    
    // Recalculate amounts from shares
    const cost = parseFloat(formData.cost) || 0;
    const newShares = { ...shares, [participantId]: value };
    const newAmounts = calculateAmountsFromShares(newShares, cost);
    setSplits(newAmounts);
  };

  const handlePercentageChange = (participantId: number, percentage: string) => {
    const value = Math.max(0, Math.min(100, roundToTwoDecimals(parseFloat(percentage) || 0)));
    setPercentages(prev => ({
      ...prev,
      [participantId]: value
    }));
    
    // Recalculate amounts from percentages
    const cost = parseFloat(formData.cost) || 0;
    const newPercentages = { ...percentages, [participantId]: value };
    const newAmounts = calculateAmountsFromPercentages(newPercentages, cost);
    setSplits(newAmounts);
  };

  const validateSplits = () => {
    const totalCost = parseFloat(formData.cost) || 0;
    const totalSplits = Object.values(splits).reduce((sum, amount) => sum + amount, 0);
    
    if (formData.split_type === 'percentage') {
      const totalPercentage = Object.values(percentages).reduce((sum, pct) => sum + pct, 0);
      return Math.abs(100 - totalPercentage) < 0.01; // Must sum to 100%
    }
    
    return Math.abs(totalCost - totalSplits) < 0.01; // Allow small floating point differences
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

      // Ensure all current group members are included in splits
      const allSplits: { [key: number]: number } = { ...splits };
      
      // Add any missing participants
      participants.forEach(participant => {
        if (!(participant.id in allSplits)) {
          allSplits[participant.id] = 0;
        }
      });
      
      // If equal split, recalculate for all participants
      if (formData.split_type === 'equal') {
        const cost = parseFloat(formData.cost) || 0;
        const equalAmount = participants.length > 0 ? cost / participants.length : 0;
        participants.forEach(participant => {
          allSplits[participant.id] = equalAmount;
        });
      }
      
      const splitArray: Split[] = Object.entries(allSplits)
        .filter(([_, amount]) => formData.split_type === 'equal' || amount > 0)
        .map(([participantId, amount]) => ({
          split_id: 0, // Will be set by backend
          group_id: group!.id,
          expense_id: parseInt(expenseId!),
          participant_id: parseInt(participantId),
          split_amount: amount
        }));

      console.log('Updating expense with data:', { expense, splits: splitArray });
      
      const result = await updateExpense({
        expense,
        splits: splitArray
      });
      
      console.log('Update result:', result);

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

      await deleteExpense(parseInt(expenseId!));

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
              <div className="grid grid-cols-2 gap-4">
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
                  <div className="text-sm text-gray-500">By shares (1 = equal)</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('split_type', 'percentage')}
                  className={`p-4 border rounded-lg text-center ${
                    formData.split_type === 'percentage'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">Percentage</div>
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
                    
                    {/* Amount Input */}
                    <div className="w-36">
                      <div className="relative">
                        <span className="absolute left-0 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm w-8">
                          {group.currency}
                        </span>
                        <input
                          type="number"
                          value={splits[participant.id] || 0}
                          onChange={(e) => handleSplitChange(participant.id, e.target.value)}
                          className={`w-full pl-10 pr-4 py-2 border-b-2 border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-right ${
                            formData.split_type === 'shares' || formData.split_type === 'percentage' 
                              ? 'text-gray-500 cursor-not-allowed' 
                              : ''
                          }`}
                          step="0.01"
                          min="0"
                          disabled={formData.split_type === 'equal' || formData.split_type === 'shares' || formData.split_type === 'percentage'}
                          readOnly={formData.split_type === 'shares' || formData.split_type === 'percentage'}
                          style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                        />
                      </div>
                    </div>
                    
                    {/* Shares Input */}
                    {formData.split_type === 'shares' && (
                      <div className="w-28">
                        <div className="flex items-center justify-end">
                          <input
                            type="number"
                            value={shares[participant.id] || 1}
                            onChange={(e) => handleShareChange(participant.id, e.target.value)}
                            className="w-16 px-2 py-2 border-b-2 border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-right"
                            min="1"
                            step="1"
                            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                          />
                          <span className="ml-2 text-sm text-gray-600">shares</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Percentage Input */}
                    {formData.split_type === 'percentage' && (
                      <div className="w-28">
                        <div className="flex items-center justify-end">
                          <input
                            type="number"
                            value={percentages[participant.id] || 0}
                            onChange={(e) => handlePercentageChange(participant.id, e.target.value)}
                            className="w-16 px-2 py-2 border-b-2 border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-right"
                            min="0"
                            max="100"
                            step="0.01"
                            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                          />
                          <span className="ml-2 text-sm text-gray-600">%</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Summary */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Total:</span>
                  <span className="font-bold text-lg">
                    {group.currency} {Object.values(splits).reduce((sum, amount) => sum + amount, 0).toFixed(2)}
                  </span>
                </div>
                {formData.split_type === 'shares' && (
                  <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                    <span>Total Shares:</span>
                    <span>{Object.values(shares).reduce((sum, share) => sum + share, 0)}</span>
                  </div>
                )}
                {formData.split_type === 'percentage' && (
                  <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                    <span>Total Percentage:</span>
                    <span>{Object.values(percentages).reduce((sum, pct) => sum + pct, 0).toFixed(2)}%</span>
                  </div>
                )}
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
