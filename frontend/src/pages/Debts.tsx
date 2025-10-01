import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDebtsPageData, createPayment, getSplitsByGroup } from '../services/api';
import { DebtPageData, SplitWithNames } from '../services/api';
import { useGroupTracking } from '../hooks/useGroupTracking';
import toast from 'react-hot-toast';
import NavBar from "../nav/nav-bar";
import Header from "../nav/header";
import SimplifyModal from "../modals/simplification"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign, faPlus, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
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
  const [isSimplifyOpen, setSimplifyOpen] = useState(false);

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
        const rawEdgesData = buildRawEdges(splitsData);
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
      <div className="page">
        <div className="body">
          <div className="content-section align-center">
            <div className="content-container">
              <l-ring size="44" color="var(--color-primary)" />
              <h2>Loading debt data...</h2>
            </div>
          </div>
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
          {/* W/ Debts */}
          {debts.length > 0 && (
            <>
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
                <div className="h-flex align-center gap-4px">
                  <p>
                    Simplified from
                    {' '}
                    <span className="text-is-error is-bold">{rawEdgeCount}</span>
                    {' '}payments to{' '}
                    <span className="text-is-success is-bold">{debts.length}</span>
                    .
                  </p>
                  <button
                    onClick={() => setSimplifyOpen(true)}
                    aria-label="More info about simplification"
                  >
                    <FontAwesomeIcon icon={faCircleInfo} className="icon" style={{ fontSize: 16 }} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Debts List */}
            <div className="list">
              {debts.map((debt, index) => {
                return (
                  <div key={debt.id || `debt-${index}`} className="expenses-container">
                    <div className="expense">
                      <p>
                        <span className="is-bold">{debt.debtor_name}</span> owes <span className="is-bold">{debt.lender_name}</span> <span className="is-bold text-is-success">{currency}{debt.debt_amount.toFixed(2)}</span>
                      </p>
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
            </>
          )}

          {/* No Debts */}
          {debts.length === 0 && (
            <div className="content-container">
              <FontAwesomeIcon icon={faDollarSign} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
              <div className="v-flex gap-8px">
                <h2>No debts</h2>
                <p>Add an expense to track your group debts.</p>
              </div>
            </div>
          )}
          
        </div>
        
        {/* Nav */}
        <div className="floating-cta-footer">
          <div className="floating-cta-container">
            <button 
              className="btn fab-shadow"
              onClick={() => navigate(`/groups/${urlSlug}/expenses/add`)}
            >
              <span>Add a new expense</span>
              <FontAwesomeIcon icon={faPlus} className="icon has-primary-color" style={{ fontSize: 16 }} aria-hidden="true" />
            </button>
          </div>
          < NavBar />
        </div>

        {isSimplifyOpen && (
        <SimplifyModal onClose={() => setSimplifyOpen(false)} />
      )}

      </div>
    </div>
  );
};

export default Debts;
