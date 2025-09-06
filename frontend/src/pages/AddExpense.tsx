import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import { getGroup, createExpense } from '../services/api';
import { Group, Participant, Expense, Split } from '../services/api';
import toast from 'react-hot-toast';

const AddExpense: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
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
    if (urlSlug) {
      loadGroupData();
    }
  }, [urlSlug]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      const response = await getGroup(urlSlug!);
      setGroup(response.group);
      setParticipants(response.participants);
      
      // Initialize splits for equal splitting
      const equalAmount = 0; // Will be calculated when cost is entered
      const initialSplits: { [key: number]: number } = {};
      response.participants.forEach(participant => {
        initialSplits[participant.id] = equalAmount;
      });
      setSplits(initialSplits);
    } catch (error) {
      toast.error('Failed to load group data');
      console.error('Error loading group data:', error);
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
        id: 0, // Will be set by backend
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
          expense_id: 0, // Will be set by backend
          participant_id: parseInt(participantId),
          split_amount: amount
        }));

      await createExpense({
        expense,
        splits: splitArray
      });

      toast.success('Expense added successfully!');
      navigate(`/group/${urlSlug}`);
    } catch (error) {
      toast.error('Failed to add expense');
      console.error('Error adding expense:', error);
    } finally {
      setSubmitting(false);
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <button
              onClick={() => navigate(`/group/${urlSlug}`)}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Add Expense</h1>
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
                {submitting ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddExpense;

