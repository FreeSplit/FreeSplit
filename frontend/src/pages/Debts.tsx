import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Check } from 'lucide-react';
import { getGroup, getDebts, updateDebtPaidAmount } from '../services/api';
import { Group, Debt, Participant } from '../services/api';
import toast from 'react-hot-toast';

const Debts: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  useEffect(() => {
    if (urlSlug) {
      loadGroupData();
    }
  }, [urlSlug]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      const [groupResponse, debtsResponse] = await Promise.all([
        getGroup(urlSlug!),
        getDebts(group?.id || 0)
      ]);

      setGroup(groupResponse.group);
      setParticipants(groupResponse.participants);
      setDebts(debtsResponse.debts);
    } catch (error) {
      toast.error('Failed to load group data');
      console.error('Error loading group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getParticipantName = (participantId: number) => {
    const participant = participants.find(p => p.id === participantId);
    return participant?.name || 'Unknown';
  };

  const handleSettleDebt = async (debt: Debt) => {
    try {
      setUpdating(debt.debt_id);
      await updateDebtPaidAmount({
        debt_id: debt.debt_id,
        paid_amount: debt.debt_amount
      });
      
      setDebts(prev => 
        prev.map(d => 
          d.debt_id === debt.debt_id 
            ? { ...d, paid_amount: debt.debt_amount }
            : d
        )
      );
      toast.success('Debt settled successfully!');
    } catch (error) {
      toast.error('Failed to settle debt');
      console.error('Error settling debt:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handlePartialPayment = async (debt: Debt, amount: number) => {
    try {
      setUpdating(debt.debt_id);
      await updateDebtPaidAmount({
        debt_id: debt.debt_id,
        paid_amount: amount
      });
      
      setDebts(prev => 
        prev.map(d => 
          d.debt_id === debt.debt_id 
            ? { ...d, paid_amount: amount }
            : d
        )
      );
      toast.success('Payment updated successfully!');
    } catch (error) {
      toast.error('Failed to update payment');
      console.error('Error updating payment:', error);
    } finally {
      setUpdating(null);
    }
  };

  const getDebtStatus = (debt: Debt) => {
    if (debt.paid_amount >= debt.debt_amount) {
      return 'settled';
    } else if (debt.paid_amount > 0) {
      return 'partial';
    }
    return 'pending';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'settled':
        return 'text-green-600 bg-green-100';
      case 'partial':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-red-600 bg-red-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'settled':
        return 'Settled';
      case 'partial':
        return 'Partial';
      default:
        return 'Pending';
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

  const settledDebts = debts.filter(debt => getDebtStatus(debt) === 'settled');
  const pendingDebts = debts.filter(debt => getDebtStatus(debt) !== 'settled');

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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Debts & Settlements</h1>
              <p className="text-gray-600">{group.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Debts</p>
                <p className="text-2xl font-bold text-gray-900">{debts.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{pendingDebts.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Settled</p>
                <p className="text-2xl font-bold text-gray-900">{settledDebts.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Debts */}
        {pendingDebts.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Pending Debts</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {pendingDebts.map((debt) => {
                const status = getDebtStatus(debt);
                const remainingAmount = debt.debt_amount - debt.paid_amount;
                
                return (
                  <div key={debt.debt_id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {getParticipantName(debt.debtor_id)} owes {getParticipantName(debt.lender_id)}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-sm text-gray-500">
                                Total: {group.currency} {debt.debt_amount.toFixed(2)}
                              </span>
                              {debt.paid_amount > 0 && (
                                <span className="text-sm text-gray-500">
                                  Paid: {group.currency} {debt.paid_amount.toFixed(2)}
                                </span>
                              )}
                              <span className="text-sm text-gray-500">
                                Remaining: {group.currency} {remainingAmount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                            {getStatusText(status)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {status === 'partial' && (
                          <button
                            onClick={() => {
                              const amount = parseFloat(prompt(`Enter payment amount (max ${remainingAmount.toFixed(2)}):`) || '0');
                              if (amount > 0 && amount <= remainingAmount) {
                                handlePartialPayment(debt, debt.paid_amount + amount);
                              }
                            }}
                            className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                            disabled={updating === debt.debt_id}
                          >
                            Add Payment
                          </button>
                        )}
                        <button
                          onClick={() => handleSettleDebt(debt)}
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-1"
                          disabled={updating === debt.debt_id}
                        >
                          <Check className="w-4 h-4" />
                          <span>Settle</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Settled Debts */}
        {settledDebts.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Settled Debts</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {settledDebts.map((debt) => (
                <div key={debt.debt_id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {getParticipantName(debt.debtor_id)} paid {getParticipantName(debt.lender_id)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {group.currency} {debt.debt_amount.toFixed(2)}
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium text-green-600 bg-green-100">
                      Settled
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Debts */}
        {debts.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Debts Yet</h3>
            <p className="text-gray-500 mb-4">
              Add some expenses to see simplified debts between members.
            </p>
            <button
              onClick={() => navigate(`/group/${urlSlug}/expenses/add`)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Add First Expense
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Debts;

