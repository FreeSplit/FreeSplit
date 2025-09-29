import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Users, DollarSign, Receipt, Settings } from 'lucide-react';
import { getGroup, getExpensesByGroup, deleteExpense } from '../services/api';
import { Group, Expense, Participant } from '../services/api';
import toast from 'react-hot-toast';
import NavBar from "../nav/nav-bar";
import Header from "../nav/header";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faReceipt, faPlus, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import FreesplitLogo from '../images/FreeSplit.svg';
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

const GroupDashboard: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShareOpen, setShareOpen] = useState(false);


  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      const groupResponse = await getGroup(urlSlug!);
      
      const expensesResponse = await getExpensesByGroup(groupResponse.group.id);

      setGroup(groupResponse.group);
      setParticipants(groupResponse.participants);
      setExpenses(expensesResponse);
    } catch (error) {
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
        // Reload expenses
        const expensesResponse = await getExpensesByGroup(group!.id);
        setExpenses(expensesResponse);
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
          {/* Expenses */}
            <div className="content-section">
              {expenses.length === 0 ? (
                <div className="content-container text-is-centered">
                  <FontAwesomeIcon icon={faReceipt} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
                  <div className="v-flex gap-8px">
                    <h2>No expenses</h2>
                    <p>Add an expense to track your group debts.</p>
                  </div>
                </div>
              ) : (
                <>
                <h1>Expenses</h1>
                <div className="list">
                  {expenses.slice(0, 5).map((expense) => (
                    <button key={expense.id} onClick={() => navigate(`/group/${urlSlug}/expenses/${expense.id}/edit`)} className="expenses-container">
                      <div className="expense">
                        <span className="expense-emoji">{expense.emoji}</span>
                        <div className="expense-details">
                          <p>{expense.name}</p>
                          <p className="p2">{getParticipantName(expense.payer_id)} paid <span className="is-green">{group.currency}{formatAmount(expense.cost)}</span></p>
                        </div>
                        <FontAwesomeIcon icon={faChevronRight} className="icon" style={{ fontSize: 20 }} aria-hidden="true" />
                      </div>
                    </button>
                  ))}
                </div>
                </>
              )}
            </div>

          <div className="floating-cta-footer">
            <div className="floating-cta-container">
              <button 
                className="btn fab-shadow"
                onClick={() => navigate(`/group/${urlSlug}/expenses/add`)}
              >
                <span>Add a new expense</span>
                <FontAwesomeIcon icon={faPlus} className="icon has-primary-color" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
            </div>
            < NavBar />
          </div>
        </div>
      </div>
  );
};

export default GroupDashboard;
