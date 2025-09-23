import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroup, getExpenseWithSplits, updateExpense, deleteExpense } from '../services/api';
import { Group, Participant, Expense, Split } from '../services/api';
import toast from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faPlus, faChevronDown, faTrash } from '@fortawesome/free-solid-svg-icons';

const EditExpense: React.FC = () => {
  const { urlSlug, expenseId } = useParams<{ urlSlug: string; expenseId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    emoji: '💰',
    payer_id: 0,
    split_type: 'equal',
  });

  const [splits, setSplits] = useState<{ [key: number]: number }>({});
  const [shares, setShares] = useState<{ [key: number]: number }>({});
  const [percentages, setPercentages] = useState<{ [key: number]: number }>({});

  const adjustShare = (participantId: number, delta: number) => {
    const current = shares[participantId] || 1;
    const next = Math.max(1, current + delta);
    handleShareChange(participantId, String(next));
  };

  const roundToTwoDecimals = (num: number): number => {
    return Math.round(num * 100) / 100;
  };

  const distributeWithRemainder = (amounts: number[], total: number): number[] => {
    const rounded = amounts.map(roundToTwoDecimals);
    const sum = rounded.reduce((acc, val) => acc + val, 0);
    const remainder = roundToTwoDecimals(total - sum);

    if (remainder !== 0 && rounded.length > 0) {
      rounded[rounded.length - 1] = roundToTwoDecimals(rounded[rounded.length - 1] + remainder);
    }

    return rounded;
  };

  const calculateAmountsFromShares = (sharesData: { [key: number]: number }, cost: number): { [key: number]: number } => {
    const amounts: { [key: number]: number } = {};
    const totalShares = Object.values(sharesData).reduce((sum, val) => sum + val, 0);

    if (totalShares > 0) {
      const amountsArray = Object.entries(sharesData).map(([id, share]) => (share / totalShares) * cost);
      const distributed = distributeWithRemainder(amountsArray, cost);

      Object.keys(sharesData).forEach((id, index) => {
        amounts[Number(id)] = distributed[index];
      });
    }

    return amounts;
  };

  const calculateAmountsFromPercentages = (percentagesData: { [key: number]: number }, cost: number): { [key: number]: number } => {
    const amounts: { [key: number]: number } = {};

    Object.entries(percentagesData).forEach(([id, percentage]) => {
      amounts[Number(id)] = roundToTwoDecimals((percentage / 100) * cost);
    });

    return amounts;
  };

  const expenseIdNumber = expenseId ? parseInt(expenseId, 10) : null;

  const loadExpenseData = useCallback(async () => {
    if (!urlSlug || !expenseIdNumber) return;

    try {
      setLoading(true);
      const [groupResponse, expenseResponse] = await Promise.all([
        getGroup(urlSlug),
        getExpenseWithSplits(expenseIdNumber),
      ]);

      setGroup(groupResponse.group);
      setParticipants(groupResponse.participants);

      const expense = expenseResponse.expense;
      setFormData({
        name: expense.name || '',
        cost: (expense.cost ?? 0).toString(),
        emoji: expense.emoji || '💰',
        payer_id: expense.payer_id || 0,
        split_type: expense.split_type || 'equal',
      });

      const initialSplits: { [key: number]: number } = {};
      const initialShares: { [key: number]: number } = {};
      const initialPercentages: { [key: number]: number } = {};

      groupResponse.participants.forEach((participant) => {
        initialSplits[participant.id] = 0;
        initialShares[participant.id] = 1;
        initialPercentages[participant.id] = 0;
      });

      expenseResponse.splits.forEach((split) => {
        initialSplits[split.participant_id] = split.split_amount;
      });

      if (expense.split_type === 'equal') {
        const cost = expense.cost || 0;
        const equalAmount = groupResponse.participants.length > 0 ? cost / groupResponse.participants.length : 0;
        groupResponse.participants.forEach((participant) => {
          initialSplits[participant.id] = equalAmount;
        });
      } else if (expense.split_type === 'shares') {
        const cost = expense.cost || 0;
        const equalAmount = groupResponse.participants.length > 0 ? cost / groupResponse.participants.length : 0;
        groupResponse.participants.forEach((participant) => {
          const amount = initialSplits[participant.id] || 0;
          initialShares[participant.id] = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
        });
      } else if (expense.split_type === 'percentage') {
        const cost = expense.cost || 0;
        groupResponse.participants.forEach((participant) => {
          const amount = initialSplits[participant.id] || 0;
          initialPercentages[participant.id] = cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
        });
      }

      setSplits(initialSplits);
      setShares(initialShares);
      setPercentages(initialPercentages);
    } catch (error) {
      toast.error('Failed to load expense data');
      console.error('Error loading expense data:', error);
    } finally {
      setLoading(false);
    }
  }, [urlSlug, expenseIdNumber]);

  useEffect(() => {
    loadExpenseData();
  }, [loadExpenseData]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    const costValue = field === 'cost' ? parseFloat(String(value)) || 0 : parseFloat(formData.cost) || 0;

    if (field === 'split_type') {
      const newSplitType = value as string;

      if (newSplitType === 'equal') {
        const equalAmount = participants.length > 0 ? costValue / participants.length : 0;
        const newSplits: { [key: number]: number } = {};
        participants.forEach((participant) => {
          newSplits[participant.id] = equalAmount;
        });
        setSplits(newSplits);
      } else if (newSplitType === 'shares') {
        const newShares: { [key: number]: number } = {};
        const equalAmount = participants.length > 0 ? costValue / participants.length : 0;
        participants.forEach((participant) => {
          const amount = splits[participant.id] || 0;
          newShares[participant.id] = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
        });
        setShares(newShares);
      } else if (newSplitType === 'percentage') {
        const newPercentages: { [key: number]: number } = {};
        participants.forEach((participant) => {
          const amount = splits[participant.id] || 0;
          newPercentages[participant.id] = costValue > 0 ? roundToTwoDecimals((amount / costValue) * 100) : 0;
        });
        setPercentages(newPercentages);
      }
    }

    if (field === 'cost') {
      if (formData.split_type === 'equal') {
        const equalAmount = participants.length > 0 ? costValue / participants.length : 0;
        const newSplits: { [key: number]: number } = {};
        participants.forEach((participant) => {
          newSplits[participant.id] = equalAmount;
        });
        setSplits(newSplits);
      } else if (formData.split_type === 'shares') {
        const newAmounts = calculateAmountsFromShares(shares, costValue);
        setSplits(newAmounts);
      } else if (formData.split_type === 'percentage') {
        const newAmounts = calculateAmountsFromPercentages(percentages, costValue);
        setSplits(newAmounts);
      }
    }
  };

  const handleSplitChange = (participantId: number, amount: string) => {
    const valueNum = parseFloat(amount) || 0;
    setSplits((prev) => ({
      ...prev,
      [participantId]: valueNum,
    }));
  };

  const handleShareChange = (participantId: number, share: string) => {
    const valueNum = Math.max(1, Math.round(parseFloat(share) || 1));
    setShares((prev) => ({
      ...prev,
      [participantId]: valueNum,
    }));

    const costValue = parseFloat(formData.cost) || 0;
    const newShares = { ...shares, [participantId]: valueNum };
    const newAmounts = calculateAmountsFromShares(newShares, costValue);
    setSplits(newAmounts);
  };

  const handlePercentageChange = (participantId: number, percentage: string) => {
    const valueNum = Math.max(0, Math.min(100, roundToTwoDecimals(parseFloat(percentage) || 0)));
    setPercentages((prev) => ({
      ...prev,
      [participantId]: valueNum,
    }));

    const costValue = parseFloat(formData.cost) || 0;
    const newPercentages = { ...percentages, [participantId]: valueNum };
    const newAmounts = calculateAmountsFromPercentages(newPercentages, costValue);
    setSplits(newAmounts);
  };

  const validateSplits = () => {
    const totalCost = parseFloat(formData.cost) || 0;
    const totalSplits = Object.values(splits).reduce((sum, amount) => sum + amount, 0);

    if (formData.split_type === 'percentage') {
      const totalPercentage = Object.values(percentages).reduce((sum, pct) => sum + pct, 0);
      return Math.abs(100 - totalPercentage) < 0.01;
    }

    return Math.abs(totalCost - totalSplits) < 0.01;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!group || !expenseIdNumber) return;

    if (!validateSplits()) {
      toast.error('Split amounts must equal the total cost');
      return;
    }

    if (formData.payer_id === 0) {
      toast.error('Please select who paid for this expense');
      return;
    }

    try {
      setSubmitting(true);

      const expense: Expense = {
        id: expenseIdNumber,
        name: formData.name,
        cost: parseFloat(formData.cost) || 0,
        emoji: formData.emoji,
        payer_id: formData.payer_id,
        split_type: formData.split_type,
        split_ids: [],
        group_id: group.id,
      };

      const allSplits: { [key: number]: number } = { ...splits };

      participants.forEach((participant) => {
        if (!(participant.id in allSplits)) {
          allSplits[participant.id] = 0;
        }
      });

      if (formData.split_type === 'equal') {
        const costValue = parseFloat(formData.cost) || 0;
        const equalAmount = participants.length > 0 ? costValue / participants.length : 0;
        participants.forEach((participant) => {
          allSplits[participant.id] = equalAmount;
        });
      }

      const splitArray: Split[] = Object.entries(allSplits)
        .filter(([_, amount]) => formData.split_type === 'equal' || amount > 0)
        .map(([participantId, amount]) => ({
          split_id: 0,
          group_id: group.id,
          expense_id: expenseIdNumber,
          participant_id: parseInt(participantId, 10),
          split_amount: amount,
        }));

      await updateExpense({
        expense,
        splits: splitArray,
      });

      toast.success('Expense updated successfully!');
      navigate(`/group/${urlSlug}`);
    } catch (error) {
      toast.error('Failed to update expense');
      console.error('Error updating expense:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!expenseIdNumber) return;
    if (!window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      await deleteExpense(expenseIdNumber);
      toast.success('Expense deleted successfully');
      navigate(`/group/${urlSlug}`);
    } catch (error) {
      toast.error('Failed to delete expense');
      console.error('Error deleting expense:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="content-section v-centered">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading expense data...</p>
        </div>
    );
  }

  if (!group) {
    return null;
  }

  const totalAssigned = Object.values(splits).reduce((sum, amount) => sum + amount, 0);
  const remainingAmount = (parseFloat(formData.cost) || 0) - totalAssigned;

  return (
    <div className="page">
      <div className="body">
        <div className="header">
          <button
            className="a"
            onClick={() => navigate(`/group/${urlSlug}`)}
          >
            Cancel
          </button>
          <p className="is-bold">Edit expense</p>
          <button
            className="a"
            type="submit"
            form="edit-expense"
            disabled={submitting || deleting || !validateSplits()}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="content-section">
          <form onSubmit={handleSubmit} className="form" id="edit-expense">
            <div className="h-div">
                  <div>
                    <input
                      type="text"
                      id="emoji"
                      value={formData.emoji}
                      onChange={(e) => handleInputChange('emoji', e.target.value)}
                      className="emoji-input"
                      maxLength={2}
                    />
                  </div>
                  <div className="form-item">
                    <label htmlFor="name" className="form-label">
                      Title
                    </label>
                    <div className="form-input-container">
                      <input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="form-input"
                        placeholder="e.g., Dinner at Restaurant"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="form-item">
                  <label htmlFor="cost" className="form-label">
                    Cost
                  </label>
                  <div className="h-div has-space-between">
                    <p className="p2 is-black">{group.currency}</p>
                    <div className="form-input-container">
                      <input
                        type="number"
                        id="cost"
                        value={formData.cost}
                        onChange={(e) => handleInputChange('cost', e.target.value)}
                        className="form-input"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required
                        disabled={submitting || deleting}
                      />
                    </div>
                  </div>
                </div>

            <div className="form-item">
              <label htmlFor="emoji" className="form-label">
                Emoji
              </label>
              <div className="form-input-container">
                <input
                  type="text"
                  id="emoji"
                  value={formData.emoji}
                  onChange={(e) => handleInputChange('emoji', e.target.value)}
                  className="form-input"
                  maxLength={2}
                  disabled={submitting || deleting}
                />
              </div>
            </div>

            <div className="form-item">
              <label htmlFor="payer" className="form-label">
                Paid by
              </label>
              <div className="form-input-container">
                <select
                  id="payer"
                  value={formData.payer_id}
                  onChange={(e) => handleInputChange('payer_id', parseInt(e.target.value, 10))}
                  className="form-input"
                  required
                  disabled={submitting || deleting}
                >
                  <option value={0}>Select payer</option>
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="split-breakdown-container">
              <div className="split-breakdown-header">
                <label htmlFor="split_type" className="form-label">
                  Split
                </label>
                <div className="split-breakdown-dropdown">
                  <select
                    id="split_type"
                    className="split-breakdown-dropdown"
                    value={formData.split_type}
                    onChange={(e) => handleInputChange('split_type', e.target.value)}
                    disabled={submitting || deleting}
                  >
                    <option value="equal">Equal</option>
                    <option value="amount">Amount</option>
                    <option value="shares">Shares</option>
                    <option value="percentage">Percentage</option>
                  </select>
                  <span className="select-icon">
                    <FontAwesomeIcon icon={faChevronDown} />
                  </span>
                </div>
              </div>

              {participants.map((participant) => (
                <div key={participant.id} className="split-breakdown-participant-container">
                  <div className="split-breakdown-details-container">
                    <div className="checkbox">A</div>
                    <div className="split-breakdown-participant-details">
                      <p>{participant.name}</p>
                      <p className="p2">{group.currency}{(splits[participant.id] ?? 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {formData.split_type === 'equal' && (
                    <div className="split-breakdown-even-split-container">
                      <span>{group.currency}{(splits[participant.id] ?? 0).toFixed(2)}</span>
                    </div>
                  )}

                  {formData.split_type === 'amount' && (
                    <div className="split-breakdown-amount-split-container">
                      <p>{group.currency}</p>
                      <input
                        type="number"
                        value={(splits[participant.id] ?? 0).toFixed(2)}
                        onChange={(e) => handleSplitChange(participant.id, e.target.value)}
                        className="form-input"
                        step="0.01"
                        min="0"
                        disabled={submitting || deleting}
                      />
                    </div>
                  )}

                  {formData.split_type === 'shares' && (
                    <div className="share-adjust">
                      <button
                        type="button"
                        className="share-adjust__button"
                        onClick={() => adjustShare(participant.id, -1)}
                        disabled={(shares[participant.id] || 1) <= 1 || submitting || deleting}
                        aria-label={`Decrease shares for ${participant.name}`}
                      >
                        <FontAwesomeIcon icon={faMinus} />
                      </button>
                      <input
                        type="number"
                        value={shares[participant.id] || 1}
                        onChange={(e) => handleShareChange(participant.id, e.target.value)}
                        className="share-adjust__input"
                        min="1"
                        step="1"
                        disabled={submitting || deleting}
                        style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                      />
                      <button
                        type="button"
                        className="share-adjust__button"
                        onClick={() => adjustShare(participant.id, 1)}
                        disabled={submitting || deleting}
                        aria-label={`Increase shares for ${participant.name}`}
                      >
                        <FontAwesomeIcon icon={faPlus} />
                      </button>
                    </div>
                  )}

                  {formData.split_type === 'percentage' && (
                    <div className="split-breakdown-amount-split-container">
                      <input
                        type="number"
                        value={(percentages[participant.id] ?? 0).toFixed(2)}
                        onChange={(e) => handlePercentageChange(participant.id, e.target.value)}
                        className="form-input"
                        min="0"
                        max="100"
                        step="0.01"
                        disabled={submitting || deleting}
                      />
                      <p>%</p>
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="link text-is-red"
                onClick={handleDelete}
                disabled={submitting || deleting}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}
              >
                <FontAwesomeIcon icon={faTrash} />
                {deleting ? 'Deleting…' : 'Delete expense'}
              </button>
            </div>
          </form>
        </div>

        <footer className="has-gradient-bg">
            <div className="breakdown-container">
              <div className="breakdown-details">
                <p>Total Attributed: </p>
                <h2>
                  {group.currency}{totalAssigned.toFixed(2)}
                </h2>
              </div>
              {formData.split_type === 'amount' && (
                <div className="p2">
                  Remaining: {group.currency}{remainingAmount.toFixed(2)}
                </div>
              )}
              {formData.split_type === 'shares' && (
                <div className="p2">
                  Total Shares: {Object.values(shares).reduce((sum, share) => sum + share, 0)}
                </div>
              )}
              {formData.split_type === 'percentage' && (
                <div className="p2">
                  Total Percentage: {Object.values(percentages).reduce((sum, pct) => sum + pct, 0).toFixed(2)}%
                </div>
              )}
            </div>
            <div className="footer-two-buttons">
              <button
                type="button"
                onClick={() => navigate(`/group/${urlSlug}`)}
                className="btn--secondary has-full-width"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-expense"
                disabled={submitting || !validateSplits()} 
                className="btn has-full-width"
              >
                Add
              </button>
            </div>
          </footer>
      </div>
    </div>
  );
};

export default EditExpense;
