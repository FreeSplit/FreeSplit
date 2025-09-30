import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDebtsPageData, createPayment, getSplitsByGroup } from '../services/api';
import { DebtPageData, SplitWithNames } from '../services/api';
import { useGroupTracking } from '../hooks/useGroupTracking';
import toast from 'react-hot-toast';
import NavBar from "../nav/nav-bar";
import Header from "../nav/header";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign, faPlus } from '@fortawesome/free-solid-svg-icons';
import SimplifyAnimationFM, { Edge as AnimationEdge, AnimationNode } from "../animations/SimplifyAnimation";
import { ring } from 'ldrs'; ring.register();


const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const truncateLabel = (name: string) =>
  name.length > 10 ? `${name.slice(0, 10)}...` : name;

// Animation function - builds raw edges from splits data
// This is completely separate from debt settlement logic
const buildRawEdges = (splits: SplitWithNames[]): AnimationEdge[] => {
  const edgeMap = new Map<string, number>();

  splits.forEach((split) => {
    // Skip if participant is the same as payer (no debt to themselves)
    if (split.participant_id === split.payer_id) {
      return;
    }

    // Create IDs from names for animation
    const participantId = split.participant_name.toLowerCase().replace(/\s+/g, '-');
    const payerId = split.payer_name.toLowerCase().replace(/\s+/g, '-');

    const key = `${participantId}->${payerId}`;
    const current = edgeMap.get(key) ?? 0;
    const nextAmount = current + split.split_amount;
    edgeMap.set(key, nextAmount);
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
  const [showAnimation, setShowAnimation] = useState(true);

  // Track group visit for user groups feature
  useGroupTracking();

  const loadDebtsData = useCallback(async () => {
    try {
      setLoading(true);
      const debtsResponse = await getDebtsPageData(urlSlug!);
      
      setDebts(debtsResponse.debts);
      setCurrency(debtsResponse.currency);
      
      // Load splits data for animation (separate from debt settlement)
      try {
        const splitsData = await getSplitsByGroup(urlSlug!);
        console.log('Splits data:', splitsData);
        const rawEdgesData = buildRawEdges(splitsData);
        console.log('Raw edges data:', rawEdgesData);
        setRawEdges(rawEdgesData);
      } catch (splitsError) {
        console.warn('Failed to load splits for animation:', splitsError);
        // Don't show error to user - animation is optional
      }
      
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

  // Derive participants from debt data and raw edges
  const participants = useMemo(() => {
    const participantMap = new Map<string, { id: string; name: string }>();
    
    // Add participants from debts
    debts.forEach(debt => {
      const debtorId = debt.debtor_name.toLowerCase().replace(/\s+/g, '-');
      const lenderId = debt.lender_name.toLowerCase().replace(/\s+/g, '-');
      
      participantMap.set(debtorId, { id: debtorId, name: debt.debtor_name });
      participantMap.set(lenderId, { id: lenderId, name: debt.lender_name });
    });
    
    // Add participants from raw edges
    rawEdges.forEach(edge => {
      if (!participantMap.has(edge.from)) {
        participantMap.set(edge.from, { id: edge.from, name: edge.from });
      }
      if (!participantMap.has(edge.to)) {
        participantMap.set(edge.to, { id: edge.to, name: edge.to });
      }
    });
    
    return Array.from(participantMap.values());
  }, [debts, rawEdges]);



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
        const remaining = roundToTwo(debt.debt_amount);
        if (remaining <= 0.009) {
          return null;
        }
        const debtorId = debt.debtor_name.toLowerCase().replace(/\s+/g, '-');
        const lenderId = debt.lender_name.toLowerCase().replace(/\s+/g, '-');
        return {
          from: debtorId,
          to: lenderId,
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

        <div className="content-section">
          <h1>Debts</h1>

          {/* Animation Section */}
          {debts.length > 0 && showAnimation && (
            <div className="v-flex align-center gap-16px">
              <SimplifyAnimationFM
                nodes={nodes}
                rawEdges={displayRawEdges}
                simplifiedEdges={simplifiedEdges}
                width={720}
                height={360}
                cycleMs={2800}
                autoplay
                currency={currency}
                onClose={() => setShowAnimation(false)}
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
                );
              })}
            </div>
          )}

          {/* No Debts */}
          {debts.length === 0 && (
            <div className="content-container">
              <FontAwesomeIcon icon={faDollarSign} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
              <h2>No debts</h2>
              <p>Add an expense to track your group debts.</p>
              <button
                 onClick={() => navigate(`/groups/${urlSlug}/expenses/add`)}
                className="btn"
               >
                <span>Add an expense</span>
                <FontAwesomeIcon icon={faPlus} className="icon" style={{ fontSize: 20 }} aria-hidden="true" />
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
