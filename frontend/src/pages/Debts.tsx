import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDebtsPageData, createPayment, getSplitsByGroup, getGroup, getPaymentsByGroup, deletePayment } from '../services/api';
import { DebtPageData, SplitWithNames, Participant, Payment } from '../services/api';
import { useGroupTracking } from '../hooks/useGroupTracking';
import toast from 'react-hot-toast';
import NavBar from "../nav/nav-bar";
import Header from "../nav/header";
import SimplifyModal from "../modals/simplification"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign, faPlus, faCircleInfo,} from '@fortawesome/free-solid-svg-icons';
import { ring } from 'ldrs'; ring.register();

const Debts: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const [debts, setDebts] = useState<DebtPageData[]>([]);
  const [currency, setCurrency] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [isSimplifyOpen, setSimplifyOpen] = useState(false);
  const [rawPaymentCount, setRawPaymentCount] = useState<number | null>(null);
  const [simplifiedPaymentCount, setSimplifiedPaymentCount] = useState<number | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [participantNames, setParticipantNames] = useState<Record<number, string>>({});
  const [undoingPaymentId, setUndoingPaymentId] = useState<number | null>(null);

  const countChargeableSplits = useCallback((splits: SplitWithNames[]): number => (
    splits.reduce((count, split) => (
      split.participant_id === split.payer_id ? count : count + 1
    ), 0)
  ), []);

  // Track group visit for user groups feature
  useGroupTracking();

  const loadDebtsData = useCallback(async () => {
    try {
      setLoading(true);
      setRawPaymentCount(null);
      setSimplifiedPaymentCount(null);
      const debtsResponse = await getDebtsPageData(urlSlug!);

      setDebts(debtsResponse.debts);
      setCurrency(debtsResponse.currency);
      setPayments([]);
      setParticipantNames({});

      let groupId: number | null = null;

      try {
        const groupResponse = await getGroup(urlSlug!);
        groupId = groupResponse.group.id;
        const participantMap: Record<number, string> = {};
        (groupResponse.participants ?? []).forEach((participant: Participant) => {
          participantMap[participant.id] = participant.name;
        });
        setParticipantNames(participantMap);
      } catch (groupError) {
        console.warn('Failed to load group for simplification banner:', groupError);
      }

      try {
        const splitsData = await getSplitsByGroup(urlSlug!);
        setRawPaymentCount(countChargeableSplits(splitsData));
        if (!groupId && splitsData.length > 0) {
          groupId = splitsData[0].group_id ?? null;
        }
      } catch (splitsError) {
        console.warn('Failed to load splits for simplification banner:', splitsError);
      }

      if (groupId) {
        try {
          const paymentsResponse = await getPaymentsByGroup(groupId);
          setPayments(paymentsResponse);
          setSimplifiedPaymentCount(debtsResponse.debts.length + paymentsResponse.length);
        } catch (paymentsError) {
          console.warn('Failed to load payments for simplification banner:', paymentsError);
          setPayments([]);
          setSimplifiedPaymentCount(debtsResponse.debts.length);
        }
      } else {
        setPayments([]);
        setSimplifiedPaymentCount(debtsResponse.debts.length);
      }
      
    } catch (error) {
      toast.error('Failed to load debts data');
      console.error('Error loading debts data:', error);
    } finally {
      setLoading(false);
    }
  }, [urlSlug, countChargeableSplits]);

  useEffect(() => {
    if (urlSlug) {
      loadDebtsData();
    }
  }, [urlSlug, loadDebtsData]);


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

  const handleUndoPayment = useCallback(async (payment: Payment) => {
    try {
      setUndoingPaymentId(payment.id);
      await deletePayment(payment.id);
      toast.success('Payment reverted');
      await loadDebtsData();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to undo payment';
      toast.error(errorMessage);
      console.error('Error undoing payment:', error);
    } finally {
      setUndoingPaymentId(null);
    }
  }, [loadDebtsData]);


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
          {(debts.length > 0 || payments.length > 0) && (
            <>
            <div className="v-flex gap-8px">
              <h1>Debts</h1>
              
              {/* Value section */}
              <div className="h-flex align-center gap-4px">
                <p>
                  Simplified from{' '}
                  <span className="text-is-error is-bold">{rawPaymentCount ?? '—'}</span>
                  {' '}payments to{' '}
                  <span className="text-is-success is-bold">{simplifiedPaymentCount ?? debts.length}</span>
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

            {/* Debts List */}
            <div className="list">
              {debts.map((debt, index) => {
                return (
                  <div key={debt.id || `debt-${index}`} className="expenses-container">
                    <div className="expense">
                      <div className="v-flex">
                        <p>
                          <span className="is-bold">{debt.debtor_name}</span> owes <span className="is-bold">{debt.lender_name}</span>
                        </p>
                        <p>
                          <span className="p2 is-bold text-is-success">{currency}{debt.debt_amount.toFixed(2)}</span>
                        </p>
                      </div>
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
              {payments.map((payment) => {
                const payerName = participantNames[payment.payer_id] ?? 'Someone';
                const payeeName = participantNames[payment.payee_id] ?? 'Someone';

                return (
                  <div key={`payment-${payment.id}`} className="expenses-container">
                    <div className="expense">
                      <div className="v-flex">
                      <p className="text-is-muted ">
                        <span className="is-bold">{payerName}</span> paid <span className="is-bold">{payeeName}</span>{' '}
                      </p>
                      <p>
                        <span className="p2 is-bold">{currency}{payment.amount.toFixed(2)}</span>
                      </p>
                      </div>
                      <div className="h-flex gap-8px">
                        <button
                          type="button"
                          className="pill bg-is-red"
                          onClick={() => handleUndoPayment(payment)}
                          disabled={undoingPaymentId === payment.id}
                        >
                          {undoingPaymentId === payment.id ? 'Undoing…' : 'Undo'}
                        </button>
                        <span className="text-is-muted">Settled</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}

          {/* No Debts */}
          {debts.length === 0 && payments.length === 0 && (
            <div className="content-container">
              <FontAwesomeIcon icon={faDollarSign} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
              <div className="v-flex gap-8px align-center text-is-centered">
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
