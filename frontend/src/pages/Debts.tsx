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

// Note: buildRawEdges function is not currently used but kept for potential future use

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const truncateLabel = (name: string) =>
  name.length > 10 ? `${name.slice(0, 10)}...` : name;

// buildRawEdges function commented out - not currently used
// const buildRawEdges = (details: ExpenseWithSplits[]): AnimationEdge[] => {
//   const edgeMap = new Map<string, number>();
//   // ... implementation would go here
// };

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

  // Derive participants from debt data
  const participants = useMemo(() => {
    const participantMap = new Map<string, { id: string; name: string }>();
    
    debts.forEach(debt => {
      // Create a simple ID from the name for animation purposes
      const debtorId = debt.debtor_name.toLowerCase().replace(/\s+/g, '-');
      const lenderId = debt.lender_name.toLowerCase().replace(/\s+/g, '-');
      
      participantMap.set(debtorId, { id: debtorId, name: debt.debtor_name });
      participantMap.set(lenderId, { id: lenderId, name: debt.lender_name });
    });
    
    return Array.from(participantMap.values());
  }, [debts]);

  const getParticipantName = (participantId: string) => {
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
          {debts.length > 0 && (
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
                 onClick={() => navigate(`/group/${urlSlug}/expenses/add`)}
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
