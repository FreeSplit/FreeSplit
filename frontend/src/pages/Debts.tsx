import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Check } from 'lucide-react';
import { getDebtsPageData, createPayment } from '../services/api';
import { DebtPageData } from '../services/api';
import toast from 'react-hot-toast';
import NavBar from "../nav/nav-bar";
import Header from "../nav/header";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign, faPlus } from '@fortawesome/free-solid-svg-icons';
import SimplifyAnimationFM, { Edge as AnimationEdge, AnimationNode } from "../animations/SimplifyAnimation";
import { ring } from 'ldrs'; ring.register();

const formatAmount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0.00';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

type ExpenseWithSplits = { expense: Expense; splits: Split[] };

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const truncateLabel = (name: string) =>
  name.length > 10 ? `${name.slice(0, 10)}...` : name;

const buildRawEdges = (details: ExpenseWithSplits[]): AnimationEdge[] => {
  const edgeMap = new Map<string, number>();

  details.forEach(({ expense, splits }) => {
    const payerId = String(expense.payer_id);

    splits.forEach((split) => {
      const participantId = String(split.participant_id);
      if (participantId === payerId) {
        return;
      }

      const key = `${participantId}->${payerId}`;
      const current = edgeMap.get(key) ?? 0;
      const nextAmount = current + (split.split_amount ?? 0);
      edgeMap.set(key, nextAmount);
    });
  });

  return Array.from(edgeMap.entries())
    .map(([key, amount]) => {
      const [from, to] = key.split("->");
      const rounded = roundToTwo(amount);
      if (rounded <= 0.009) {
        return null;
      }
      return { from, to, amount: rounded } as AnimationEdge;
    })
    .filter((edge): edge is AnimationEdge => edge !== null);
};

const Debts: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const [debts, setDebts] = useState<DebtPageData[]>([]);
  const [currency, setCurrency] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [rawEdges, setRawEdges] = useState<AnimationEdge[]>([]);

  const loadDebtsData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getDebtsPageData(urlSlug!);
      
      setDebts(response.debts);
      setCurrency(response.currency);
      
    } catch (error) {
      toast.error('Failed to load debts data');
      console.error('Error loading debts data:', error);
    } finally {
      setLoading(false);
    }
  }, [urlSlug]);

  useEffect(() => {
    if (urlSlug) {
      loadDebtsData();
    }
  }, [urlSlug, loadDebtsData]);

  const nodes: AnimationNode[] = useMemo(() => {
    return participants
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((participant) => ({
        id: String(participant.id),
        label: truncateLabel(participant.name),
      }));
  }, [participants]);

  const nodeIdSet = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);

  const simplifiedEdges = useMemo<AnimationEdge[]>(() => {
    return debts
      .map((debt) => {
        const remaining = roundToTwo(Math.max(debt.debt_amount - debt.paid_amount, 0));
        if (remaining <= 0.009) {
          return null;
        }
        return {
          from: String(debt.debtor_id),
          to: String(debt.lender_id),
          amount: remaining,
        } as AnimationEdge;
      })
      .filter((edge): edge is AnimationEdge => !!edge)
      .filter((edge) => nodeIdSet.has(edge.from) && nodeIdSet.has(edge.to));
  }, [debts, nodeIdSet]);

  const displayRawEdges = useMemo(() => {
    return rawEdges.filter(
      (edge) => nodeIdSet.has(edge.from) && nodeIdSet.has(edge.to)
    );
  }, [rawEdges, nodeIdSet]);

  const rawEdgeCount = displayRawEdges.length;
  const transactionsSaved = Math.max(rawEdgeCount - debts.length, 0);

  const handleSettleDebt = async (debt: DebtPageData) => {
    try {
      setUpdating(debt.id);
      // Creates a payment record aka settles a debt and recalculates all debts for the group
      await createPayment({
        debt_id: debt.id, // The debt we are settling knows who is involved
        paid_amount: debt.debt_amount // Currently we are settling the debt in full
      });
      
      // Reload debts to get updated state
      await loadDebtsData();
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


  // All debts returned from backend are current (unsettled) debts
  // No need for status checking since settled debts are not returned

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading debts data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="body">
        {/* Header */}
          <Header />

        {/* Debts List */}
        {debts.length > 0 && (
          <div className="expenses-container">
            {debts.map((debt, index) => {
              return (
                <div key={debt.id || `debt-${index}`} className="expense">
                  <div className="expense-details">
                    <p>
                      {debt.debtor_name} owes {debt.lender_name} {currency}{debt.debt_amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      className="link"
                      onClick={() => handleSettleDebt(debt)}
                      disabled={updating === debt.id}
                    >
                      Settle
                    </button>
                  </div>
                </div>
              )}
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
            </div>
          )}
        

        {/* No Debts */}
          {debts.length === 0 && (
            <div className="content-section">
              <div className="content-container text-is-centered">
                <FontAwesomeIcon icon={faDollarSign} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
                <div className="v-flex gap-8px">
                  <h2>No debts</h2>
                  <p>Add an expense to track your group debts.</p>
                </div>
              </div>
            </div>
          )}

        {/* Nav */}
          <div className="floating-cta-footer">
            {debts.length === 0 && (
              <div className="floating-cta-container">
                <button 
                  className="btn fab-shadow"
                  onClick={() => navigate(`/group/${urlSlug}/expenses/add`)}
                >
                  <span>Add a new expense</span>
                  <FontAwesomeIcon icon={faPlus} className="icon has-primary-color" style={{ fontSize: 16 }} aria-hidden="true" />
                </button>
              </div>
            )}
            <NavBar />
          </div>

      </div>
    </div>
  );
};

export default Debts;
