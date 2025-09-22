import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Users, DollarSign, Receipt, Settings } from 'lucide-react';
import { getGroup, getExpensesByGroup, getDebts, deleteExpense } from '../services/api';
import { Group, Expense, Debt, Participant } from '../services/api';
import toast from 'react-hot-toast';
import NavBar from "../nav/nav-bar";
import ShareLink from '../modals/share-link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faReceipt, faPlus, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import FreesplitLogo from '../images/freesplit-logo.svg';

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
      
      const [expensesResponse, debtsResponse] = await Promise.all([
        getExpensesByGroup(groupResponse.group.id),
        getDebts(groupResponse.group.id)
      ]);

      setGroup(groupResponse.group);
      setParticipants(groupResponse.participants);
      setExpenses(expensesResponse);
      // Note: debts are loaded but not currently displayed in the UI
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading group data...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="body">
        <div className="logo-header">
        <img src={FreesplitLogo} alt="Freesplit Logo" />
        </div>
        <div className="section content-v-centered">
          <div className="content-container">
            <h2>Group not found</h2>
            <p>Please check the URL is correct, or click below to create a new group</p>
            <button
            onClick={() => navigate('/')}
            className="btn"
            >
              Create new group
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="body">
        {/* Header */}
          <div className="header">
            <p>{group.name}</p>
            <button className="a" onClick={() => setShareOpen(true)}>Share</button>
          </div>
        {/* Expenses */}
          <div className="section">
            {expenses.length === 0 ? (
              <div className="content-container">
                <FontAwesomeIcon icon={faReceipt} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
                <h2>No expenses</h2>
                <p>Add an expense to track your group debts.</p>
                <button
                  onClick={() => navigate(`/group/${urlSlug}/expenses/add`)}
                  className="btn"
                >
                  <span>Add an expense</span>
                  <FontAwesomeIcon icon={faPlus} className="icon" style={{ fontSize: 20 }} aria-hidden="true" />
                </button>
              </div>
            ) : (
              expenses.slice(0, 5).map((expense) => (
                  <div key={expense.id} className="expenses-container">
                    <button onClick={() => navigate(`/group/${urlSlug}/expenses/${expense.id}/edit`)} className="expense">
                      <span className="expense-emoji">{expense.emoji}</span>
                      <div className="expense-details">
                        <p>{expense.name}</p>
                        <p className="p2">{getParticipantName(expense.payer_id)} paid <span className="is-green">{group.currency} {expense.cost.toFixed(2)}</span></p>
                      </div>
                      <FontAwesomeIcon icon={faChevronRight} className="icon" style={{ fontSize: 20 }} aria-hidden="true" />
                    </button>
                  </div>
              ))
            )}
          </div>
          <div className="section">
            <button
              onClick={() => navigate(`/group/${urlSlug}/expenses/add`)}
              className="btn"
            >
              <span>Add an expense</span>
              <FontAwesomeIcon icon={faPlus} className="icon" style={{ fontSize: 20 }} aria-hidden="true" />
            </button>
          </div>

      {isShareOpen && (
        <ShareLink group={group} onClose={() => setShareOpen(false)} />
      )}
      <button
        type="button"
        className="floating-action-button"
        onClick={() => navigate(`/group/${urlSlug}/expenses/add`)}
        aria-label="Add an expense"
      >
        <Plus className="floating-action-button__icon" />
      </button>
      <NavBar />
      </div>
  );
};

export default GroupDashboard;
