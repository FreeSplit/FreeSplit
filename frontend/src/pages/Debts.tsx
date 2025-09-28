import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getGroup,
  getDebts,
  updateDebtPaidAmount,
  getExpensesByGroup,
  getExpenseWithSplits,
  Group,
  Debt,
  Participant,
  Expense,
  Split,
} from '../services/api';
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
  const [group, setGroup] = useState<Group | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [rawEdges, setRawEdges] = useState<AnimationEdge[]>([]);

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      const groupResponse = await getGroup(urlSlug!);
      const groupId = groupResponse.group.id;
      setRawEdges([]);

      const [debtsResponse, expensesResponse] = await Promise.all([
        getDebts(groupId),
        getExpensesByGroup(groupId),
      ]);

      setGroup(groupResponse.group);
      setParticipants(groupResponse.participants);
      setDebts(debtsResponse);

      if (expensesResponse.length > 0) {
        const detailedResults = await Promise.allSettled(
          expensesResponse.map((expense) => getExpenseWithSplits(expense.id))
        );

        const fulfilled = detailedResults.filter(
          (res): res is PromiseFulfilledResult<{ expense: Expense; splits: Split[] }> =>
            res.status === "fulfilled"
        );

        const edges = buildRawEdges(
          fulfilled.map((result) => result.value)
        );

        setRawEdges(edges);
      } else {
        setRawEdges([]);
      }
    } catch (error) {
      toast.error('Failed to load group data');
      console.error('Error loading group data:', error);
      setRawEdges([]);
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

  useEffect(() => {
    if (!loading && !group && urlSlug) {
      navigate(`/group/${urlSlug}`);
    }
  }, [loading, group, urlSlug, navigate]);

  if (loading) {
    return (
      <div className="page">
        <div className="body">
          <div className="content-section align-center">
            <div className="content-container">
              <l-ring size="44" color="var(--color-primary)" />
              <h2>Loading group data...</h2>
            </div>
          </div>
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
          {orderedDebts.length > 0 && (
            <div className="content-section">
              <h1>Debts</h1>
              {transactionsSaved > 0 && (
                <div className="v-flex align-center gap-16px">
                  <SimplifyAnimationFM
                    nodes={nodes}
                    rawEdges={displayRawEdges}
                    simplifiedEdges={simplifiedEdges}
                    width={720}
                    height={360}
                    cycleMs={2800}
                    autoplay
                    currency={group.currency}
                  />
                  <p>
                    Debts simplified from
                    {' '}
                    <span className="text-is-error is-bold">{rawEdgeCount}</span>
                    {' '}to{' '}
                    <span className="text-is-success is-bold">{debts.length}</span>
                    {' '}transactions.{' '}
                    <span className="text-is-success is-bold">{transactionsSaved}</span>
                    {' '}transactions saved.
                  </p>
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
