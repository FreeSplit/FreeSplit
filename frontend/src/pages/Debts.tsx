import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Check } from 'lucide-react';
import { getGroup, getDebts, updateDebtPaidAmount } from '../services/api';
import { Group, Debt, Participant } from '../services/api';
import toast from 'react-hot-toast';
import NavBar from "../nav/nav-bar";
import Header from "../nav/header";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign, faPlus } from '@fortawesome/free-solid-svg-icons';

const formatAmount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0.00';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const Debts: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      const groupResponse = await getGroup(urlSlug!);
      const debtsResponse = await getDebts(groupResponse.group.id);

      setGroup(groupResponse.group);
      setParticipants(groupResponse.participants);
      setDebts(debtsResponse);
      
    } catch (error) {
      toast.error('Failed to load group data');
      console.error('Error loading group data:', error);
    } finally {
      setLoading(false);
    }
  }, [urlSlug]);

  useEffect(() => {
    if (urlSlug) {
      loadGroupData();
    }
  }, [urlSlug, loadGroupData]);

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
    } catch (error: any) {
      // Display the specific error message from the backend
      const errorMessage = error.message || 'Failed to settle debt';
      toast.error(errorMessage);
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
    } catch (error: any) {
      // Display the specific error message from the backend
      const errorMessage = error.message || 'Failed to update payment';
      toast.error(errorMessage);
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

  useEffect(() => {
    if (!loading && !group && urlSlug) {
      navigate(`/group/${urlSlug}`);
    }
  }, [loading, group, urlSlug, navigate]);

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
    return null;
  }

  const settledDebts = debts.filter(debt => getDebtStatus(debt) === 'settled');
  const pendingDebts = debts.filter(debt => getDebtStatus(debt) !== 'settled');
  const orderedDebts = [...pendingDebts, ...settledDebts];

  return (
    <div className="page">
      <div className="body">
      {/* Header */}
        <Header />

        {/* Debts List */}
        <div className="content-section">
          <h1>Debts</h1>
        {orderedDebts.length > 0 && (
          <div className="list">
            
            {orderedDebts.map((debt, index) => {
              const status = getDebtStatus(debt);
              const remainingAmount = debt.debt_amount - debt.paid_amount;
              const isSettled = status === 'settled';

              return (
                <div key={debt.debt_id || `debt-${index}`} className="expenses-container">
                  <div className="expense">
                    {isSettled ? (
                      <>
                        <p className="text-is-muted">
                          {getParticipantName(debt.debtor_id)} paid {getParticipantName(debt.lender_id)} {group.currency}{formatAmount(debt.debt_amount)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          <span className="is-bold">{getParticipantName(debt.debtor_id)}</span> owes <span className="is-bold">{getParticipantName(debt.lender_id)}</span> <span className="text-is-success">{group.currency}{formatAmount(remainingAmount)}</span>
                        </p>
                        {status === 'partial' && (
                          <p className="text-sm text-gray-500">
                            Paid so far: {group.currency}{formatAmount(debt.paid_amount)}
                          </p>
                        )}
                      </>
                    )}
 
                    {status === 'partial' && (
                          <button
                            type="button"
                            onClick={() => {
                          const amount = parseFloat(prompt(`Enter payment amount (max ${formatAmount(remainingAmount)}):`) || '0');
                          if (!Number.isNaN(amount) && amount > 0 && amount <= remainingAmount) {
                            handlePartialPayment(debt, debt.paid_amount + amount);
                          }
                        }}
                        className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                        disabled={updating === debt.debt_id}
                      >
                        Add Payment
                      </button>
                    )}
                    {isSettled ? (
                      <span className="link" style={{ color: 'var(--color-muted)', cursor: 'default' }}>
                        Settled
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="link"
                        onClick={() => handleSettleDebt(debt)}
                        disabled={updating === debt.debt_id}
                      >
                        Settle
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* No Debts */}
        <div className="content-section">
        {debts.length === 0 && (
          <div className="content-container text-is-centered">
            <FontAwesomeIcon icon={faDollarSign} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
            <div className="v-flex gap-8px">
              <h2>No debts</h2>
              <p>Add an expense to track your group debts.</p>
            </div>
            <button
              onClick={() => navigate(`/group/${urlSlug}/expenses/add`)}
              className="btn"
             >
              <span>Add an expense</span>
              <FontAwesomeIcon icon={faPlus} className="icon" style={{ fontSize: 16 }} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
            {/* Nav */}
      <NavBar />
    </div>
    </div>
  );
};

export default Debts;
