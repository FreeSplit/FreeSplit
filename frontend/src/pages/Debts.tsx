import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Check } from 'lucide-react';
import { getDebtsPageData, createPayment } from '../services/api';
import { DebtPageData } from '../services/api';
import toast from 'react-hot-toast';
import NavBar from "../nav/nav-bar";
import Header from "../nav/header";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign, faPlus } from '@fortawesome/free-solid-svg-icons';

const Debts: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const [debts, setDebts] = useState<DebtPageData[]>([]);
  const [currency, setCurrency] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

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

  const handleSettleDebt = async (debt: DebtPageData) => {
    try {
      setUpdating(debt.id);
      // Creates a payment record aka settles a debt and recalculates all debts for the group
      await createPayment({
        debt_id: debt.id,
        paid_amount: debt.debt_amount
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
