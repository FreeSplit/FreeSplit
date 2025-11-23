import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Users, DollarSign, Receipt, Settings } from 'lucide-react';
import { getGroup, getExpensesByGroup, deleteExpense } from '../services/api';
import { Group, Expense, Participant } from '../services/api';
import { useGroupTracking } from '../hooks/useGroupTracking';
import { useRobotsMeta } from '../hooks/useRobotsMeta';
import toast from 'react-hot-toast';
import NavBar from "../nav/nav-bar";
import Header from "../nav/header";
import WelcomeModal from "../modals/welcome";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faReceipt, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import FreesplitLogo from '../images/FreeSplit.svg';
import { ring } from 'ldrs'; ring.register();

const EXPENSES_PER_PAGE = 50;

const formatAmount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0.00';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const GroupDashboard: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  useRobotsMeta('noindex, nofollow');
  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWelcomeOpen, setWelcomeOpen] = useState(false);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [currentOffset, setCurrentOffset] = useState<number>(0);

  // Track group visit for user groups feature
  useGroupTracking();


  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      const groupResponse = await getGroup(urlSlug!);
      
      const expensesResponse = await getExpensesByGroup(groupResponse.group.id, 0, EXPENSES_PER_PAGE);

      setGroup(groupResponse.group);
      setParticipants(groupResponse.participants);
      setExpenses(expensesResponse.data);
      setTotalRecords(expensesResponse.pagination.total_records);
      setCurrentOffset(EXPENSES_PER_PAGE);
    } catch (error) {
      console.error('Error loading group data:', error);
    } finally {
      setLoading(false);
    }
  }, [urlSlug]);

  const loadMoreExpenses = useCallback(async () => {
    if (!group || loadingMore) return;
    
    try {
      setLoadingMore(true);
      const expensesResponse = await getExpensesByGroup(group.id, currentOffset, EXPENSES_PER_PAGE);
      
      setExpenses(prev => [...prev, ...expensesResponse.data]);
      setCurrentOffset(prev => prev + EXPENSES_PER_PAGE);
    } catch (error) {
      console.error('Error loading more expenses:', error);
      toast.error('Failed to load more expenses');
    } finally {
      setLoadingMore(false);
    }
  }, [group, currentOffset, loadingMore]);

  useEffect(() => {
    if (urlSlug) {
      loadGroupData();
    }
  }, [urlSlug, loadGroupData]);

  useEffect(() => {
    if (group && (location.state as { showWelcome?: boolean } | null)?.showWelcome) {
      setWelcomeOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [group, location, navigate]);


  const calculateTotalSpent = () => {
    return expenses.reduce((total, expense) => total + expense.cost, 0);
  };

  const calculateParticipantSpent = (participantId: number) => {
    return expenses
      .filter(expense => expense.payer_id === participantId)
      .reduce((total, expense) => total + expense.cost, 0);
  };

  const getParticipantName = (participantId: number) => {
    const participant = participants.find(p => p.id === participantId);
    return participant?.name || 'Unknown';
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteExpense(expenseId);
        toast.success('Expense deleted successfully');
        // Reload expenses from the beginning
        const expensesResponse = await getExpensesByGroup(group!.id, 0, EXPENSES_PER_PAGE);
        setExpenses(expensesResponse.data);
        setTotalRecords(expensesResponse.pagination.total_records);
        setCurrentOffset(EXPENSES_PER_PAGE);
      } catch (error) {
        toast.error('Failed to delete expense');
        console.error('Error deleting expense:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="body">
          <Header />
          <div className="content-section align-center">
            <div className="content-container">
              <l-ring size="44" color="var(--color-primary)" />
              <h2>Loading group data...</h2>
            </div>
          </div>
          <div className="floating-cta-footer">
            <div className="floating-cta-container">
              <button 
                className="btn fab-shadow"
                onClick={() => navigate(`/groups/${urlSlug}/expenses/add`)}
              >
                <span>Add a new expense</span>
                <FontAwesomeIcon icon={faReceipt} className="icon has-primary-color" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
            </div>
            < NavBar />
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="page">
        <div className="body">
          <div className="logo-header">
            <img src={FreesplitLogo} alt="Freesplit Logo" />
          </div>
          <div className="content-section v-centered">
            <div className="content-container">
              <h2>Group not found</h2>
              <p className="text-is-centered">Please check the URL is correct, or click below to create a new group.</p>
              <button
                onClick={() => navigate('/')}
                className="btn"
              >
                Create a group
              </button>
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
            {isWelcomeOpen && group ? (
              <WelcomeModal group={group} onClose={() => setWelcomeOpen(false)} />
            ) : null}

        
          {/* Expenses */}
            <div className="content-section">
                
              {expenses.length === 0 ? (
                <div className="content-container text-is-centered">
                  <FontAwesomeIcon icon={faReceipt} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
                  <div className="v-flex gap-8px align-center text-is-centered">
                    <h2>No expenses</h2>
                    <p>Add an expense to track your group debts.</p>
                  </div>
                </div>
              ) : (
                <>
                <h1>Expenses</h1>
                <div className="dark-divider"></div>
                <div className="list">
                  {expenses.map((expense) => (
                    <button key={expense.id} onClick={() => navigate(`/groups/${urlSlug}/expenses/${expense.id}/edit`)} className="expenses-container">
                      <div className="expense">
                        <span className="expense-emoji">{expense.emoji}</span>
                        <div className="expense-details" style={{ minWidth: 0 }}>
                          <p className="truncate-text is-bold">{expense.name}</p>
                          <p className="p2 clamp-two-lines" style={{ display: 'flex', gap: 4, alignItems: 'baseline', minWidth: 0 }}>
                            <span className="truncate-text auto-width" style={{ flex: '0 1 auto', display: 'inline-block', maxWidth: '50%' }}>{getParticipantName(expense.payer_id)}</span>
                            <span>paid</span>
                            <span className="is-green truncate-text auto-width" style={{ flex: '0 1 auto', display: 'inline-block', maxWidth: '50%' }}>{group.currency}{formatAmount(expense.cost)}</span>
                          </p>
                        </div>
                        <FontAwesomeIcon icon={faChevronRight} className="icon" style={{ fontSize: 20 }} aria-hidden="true" />
                      </div>
                    </button>
                  ))}
                </div>
                {expenses.length < totalRecords && (
                  <div className="content-container text-is-centered" style={{ marginTop: '16px' }}>
                    <button
                      onClick={loadMoreExpenses}
                      disabled={loadingMore}
                      className="btn"
                    >
                      {loadingMore ? 'Loading...' : 'Load More...'}
                    </button>
                  </div>
                )}
                </>
              )}
            </div>

          <div className="floating-cta-footer">
            <div className="floating-cta-container">
              <button 
                className="btn fab-shadow"
                onClick={() => navigate(`/groups/${urlSlug}/expenses/add`)}
              >
                <span>Add a new expense</span>
                <FontAwesomeIcon icon={faReceipt} className="icon has-primary-color" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
            </div>
            < NavBar />
          </div>
        </div>
      </div>
  );
};

export default GroupDashboard;
