import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroup, getExpenseWithSplits, updateExpense, deleteExpense } from '../services/api';
import { Group, Participant, Expense, Split } from '../services/api';
import toast from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faPlus, faChevronDown, faTrash, faCheck } from '@fortawesome/free-solid-svg-icons';

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

const formatAmount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0.00';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

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
  const [customSplits, setCustomSplits] = useState<{ [key: number]: number }>({});
  const [customShares, setCustomShares] = useState<{ [key: number]: number }>({});
  const [customPercentages, setCustomPercentages] = useState<{ [key: number]: number }>({});
  const [includedParticipants, setIncludedParticipants] = useState<{ [key: number]: boolean }>({});

  const adjustShare = (participantId: number, delta: number) => {
    if (!includedParticipants[participantId]) {
      return;
    }

    const current = customShares[participantId] || shares[participantId] || 1;
    const next = Math.max(1, current + delta);
    handleShareChange(participantId, String(next));
  };

  const redistributeSplits = (overrides?: {
    inclusion?: { [key: number]: boolean };
    customSplitsState?: { [key: number]: number };
    customSharesState?: { [key: number]: number };
    customPercentagesState?: { [key: number]: number };
    splitType?: string;
    costValue?: number;
  }) => {
    if (!participants.length) {
      return;
    }

    const inclusion = overrides?.inclusion ?? includedParticipants;
    const splitType = overrides?.splitType ?? formData.split_type;
    const fallbackCost = parseFloat(formData.cost);
    const costValue = overrides?.costValue ?? (Number.isFinite(fallbackCost) ? fallbackCost : 0);
    const customSplitsState = overrides?.customSplitsState ?? customSplits;
    const customSharesState = overrides?.customSharesState ?? customShares;
    const customPercentagesState = overrides?.customPercentagesState ?? customPercentages;

    const activeParticipants = participants.filter(participant => inclusion[participant.id]);
    const activeCount = activeParticipants.length;

    const nextSplits: { [key: number]: number } = {};
    const nextShares: { [key: number]: number } = {};
    const nextPercentages: { [key: number]: number } = {};
    const nextCustomSplits: { [key: number]: number } = { ...customSplitsState };
    const nextCustomShares: { [key: number]: number } = { ...customSharesState };
    const nextCustomPercentages: { [key: number]: number } = { ...customPercentagesState };

    if (activeCount === 0) {
      participants.forEach(participant => {
        nextSplits[participant.id] = 0;
        nextShares[participant.id] = 0;
        nextPercentages[participant.id] = 0;
        nextCustomSplits[participant.id] = 0;
        nextCustomShares[participant.id] = 0;
        nextCustomPercentages[participant.id] = 0;
      });

      setSplits(nextSplits);
      setShares(nextShares);
      setPercentages(nextPercentages);
      setCustomSplits(nextCustomSplits);
      setCustomShares(nextCustomShares);
      setCustomPercentages(nextCustomPercentages);
      return;
    }

    if (splitType === 'equal') {
      const equalAmount = activeCount > 0 ? costValue / activeCount : 0;
      const distributed = distributeWithRemainder(new Array(activeCount).fill(equalAmount), costValue);

      activeParticipants.forEach((participant, index) => {
        const amount = roundToTwoDecimals(distributed[index] ?? 0);
        nextSplits[participant.id] = amount;
        nextShares[participant.id] = 1;
        nextPercentages[participant.id] = costValue > 0 ? roundToTwoDecimals((amount / costValue) * 100) : 0;
        nextCustomSplits[participant.id] = amount;
        nextCustomShares[participant.id] = 1;
        nextCustomPercentages[participant.id] = nextPercentages[participant.id];
      });
    } else if (splitType === 'shares') {
      const workingShares: { [key: number]: number } = {};
      let totalShares = 0;

      activeParticipants.forEach(participant => {
        const rawShare = customSharesState[participant.id] || shares[participant.id] || 1;
        const shareValue = Math.max(1, Math.round(rawShare));
        workingShares[participant.id] = shareValue;
        nextCustomShares[participant.id] = shareValue;
        totalShares += shareValue;
      });

      if (totalShares === 0) {
        activeParticipants.forEach(participant => {
          workingShares[participant.id] = 1;
          nextCustomShares[participant.id] = 1;
        });
      }

      const shareAmounts = calculateAmountsFromShares(workingShares, costValue);

      activeParticipants.forEach(participant => {
        const amount = roundToTwoDecimals(shareAmounts[participant.id] ?? 0);
        nextSplits[participant.id] = amount;
        nextShares[participant.id] = workingShares[participant.id];
        nextPercentages[participant.id] = costValue > 0 ? roundToTwoDecimals((amount / costValue) * 100) : 0;
        nextCustomSplits[participant.id] = amount;
        nextCustomPercentages[participant.id] = nextPercentages[participant.id];
      });
    } else if (splitType === 'percentage') {
      let total = 0;
      activeParticipants.forEach(participant => {
        const value = Math.max(0, customPercentagesState[participant.id] ?? percentages[participant.id] ?? 0);
        total += value;
      });

      if (total <= 0) {
        const equalPercent = 100 / activeCount;
        activeParticipants.forEach(participant => {
          nextCustomPercentages[participant.id] = roundToTwoDecimals(equalPercent);
        });
        total = 100;
      }

      const normalized = activeParticipants.map(participant => {
        const value = Math.max(0, nextCustomPercentages[participant.id] ?? 0);
        return total > 0 ? (value / total) * 100 : 0;
      });

      const distributedPercentages = distributeWithRemainder(normalized, 100);
      const percentageMap: { [key: number]: number } = {};

      activeParticipants.forEach((participant, index) => {
        const percentage = roundToTwoDecimals(distributedPercentages[index] ?? 0);
        nextCustomPercentages[participant.id] = percentage;
        percentageMap[participant.id] = percentage;
      });

      const amounts = calculateAmountsFromPercentages(percentageMap, costValue);

      activeParticipants.forEach(participant => {
        const amount = roundToTwoDecimals(amounts[participant.id] ?? 0);
        nextSplits[participant.id] = amount;
        nextPercentages[participant.id] = nextCustomPercentages[participant.id];
        nextShares[participant.id] = 0;
        nextCustomSplits[participant.id] = amount;
        nextCustomShares[participant.id] = 0;
      });
    } else if (splitType === 'amount') {
      const baseAmounts = activeParticipants.map(participant => {
        const amount = Math.max(0, customSplitsState[participant.id] ?? splits[participant.id] ?? 0);
        nextCustomSplits[participant.id] = amount;
        return amount;
      });

      const totalBase = baseAmounts.reduce((sum, value) => sum + value, 0);
      let scaled: number[];

      if (totalBase <= 0) {
        const equalAmount = activeCount > 0 ? costValue / activeCount : 0;
        scaled = new Array(activeCount).fill(equalAmount);
      } else {
        const scale = costValue > 0 ? costValue / totalBase : 0;
        scaled = baseAmounts.map(amount => amount * scale);
      }

      const distributed = distributeWithRemainder(scaled, costValue);

      activeParticipants.forEach((participant, index) => {
        const amount = roundToTwoDecimals(distributed[index] ?? 0);
        nextSplits[participant.id] = amount;
        nextCustomSplits[participant.id] = amount;
        nextPercentages[participant.id] = costValue > 0 ? roundToTwoDecimals((amount / costValue) * 100) : 0;
        nextCustomPercentages[participant.id] = nextPercentages[participant.id];
        nextShares[participant.id] = 0;
        nextCustomShares[participant.id] = 0;
      });
    }

    participants.forEach(participant => {
      if (!inclusion[participant.id]) {
        nextSplits[participant.id] = 0;
        nextShares[participant.id] = 0;
        nextPercentages[participant.id] = 0;
        nextCustomSplits[participant.id] = 0;
        nextCustomShares[participant.id] = 0;
        nextCustomPercentages[participant.id] = 0;
      }
    });

    setSplits(nextSplits);
    setShares(nextShares);
    setPercentages(nextPercentages);
    setCustomSplits(nextCustomSplits);
    setCustomShares(nextCustomShares);
    setCustomPercentages(nextCustomPercentages);
  };

  const expenseIdNumber = expenseId ? parseInt(expenseId, 10) : null;

  useEffect(() => {
    if (!urlSlug || !expenseIdNumber) {
      return;
    }

    const loadExpenseData = async () => {
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
        const initialCustomSplits: { [key: number]: number } = {};
        const initialCustomShares: { [key: number]: number } = {};
        const initialCustomPercentages: { [key: number]: number } = {};
        const inclusion: { [key: number]: boolean } = {};

        groupResponse.participants.forEach((participant) => {
          initialSplits[participant.id] = 0;
          initialShares[participant.id] = 1;
          initialPercentages[participant.id] = 0;
          initialCustomSplits[participant.id] = 0;
          initialCustomShares[participant.id] = 1;
          initialCustomPercentages[participant.id] = 0;
          inclusion[participant.id] = false;
        });

        expenseResponse.splits.forEach((split) => {
          initialSplits[split.participant_id] = split.split_amount;
          initialCustomSplits[split.participant_id] = split.split_amount;
          inclusion[split.participant_id] = true;
        });

        const cost = expense.cost || 0;
        const activeParticipants = groupResponse.participants.filter((participant) => inclusion[participant.id]);
        const activeCount = activeParticipants.length;

        if (expense.split_type === 'equal') {
          if (activeCount > 0) {
            const equalAmount = cost / activeCount;
            const distributed = distributeWithRemainder(new Array(activeCount).fill(equalAmount), cost);
            activeParticipants.forEach((participant, index) => {
              const amount = roundToTwoDecimals(distributed[index] ?? 0);
              initialSplits[participant.id] = amount;
              initialCustomSplits[participant.id] = amount;
              initialShares[participant.id] = 1;
              initialCustomShares[participant.id] = 1;
              const percentage = cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
              initialPercentages[participant.id] = percentage;
              initialCustomPercentages[participant.id] = percentage;
            });
          }
        } else if (expense.split_type === 'shares') {
          const workingShares: { [key: number]: number } = {};
          const equalAmount = activeCount > 0 ? cost / activeCount : 0;

          activeParticipants.forEach((participant) => {
            const amount = initialSplits[participant.id] || 0;
            const shareValue = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
            workingShares[participant.id] = shareValue;
          });

          const shareAmounts = calculateAmountsFromShares(workingShares, cost);

          activeParticipants.forEach((participant) => {
            const shareValue = workingShares[participant.id] ?? 1;
            const amount = roundToTwoDecimals(shareAmounts[participant.id] ?? 0);
            initialShares[participant.id] = shareValue;
            initialCustomShares[participant.id] = shareValue;
            initialSplits[participant.id] = amount;
            initialCustomSplits[participant.id] = amount;
            const percentage = cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
            initialPercentages[participant.id] = percentage;
            initialCustomPercentages[participant.id] = percentage;
          });
        } else if (expense.split_type === 'percentage') {
          if (activeCount > 0) {
            const rawPercentages = activeParticipants.map((participant) => {
              const amount = initialSplits[participant.id] || 0;
              return cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
            });
            const distributedPercentages = distributeWithRemainder(rawPercentages, 100);
            const percentageMap: { [key: number]: number } = {};

            activeParticipants.forEach((participant, index) => {
              const percentage = roundToTwoDecimals(distributedPercentages[index] ?? 0);
              percentageMap[participant.id] = percentage;
              initialPercentages[participant.id] = percentage;
              initialCustomPercentages[participant.id] = percentage;
            });

            const amounts = calculateAmountsFromPercentages(percentageMap, cost);
            activeParticipants.forEach((participant) => {
              const amount = roundToTwoDecimals(amounts[participant.id] ?? 0);
              initialSplits[participant.id] = amount;
              initialCustomSplits[participant.id] = amount;
            });
          }
        } else if (expense.split_type === 'amount') {
          activeParticipants.forEach((participant) => {
            const amount = roundToTwoDecimals(initialSplits[participant.id] ?? 0);
            initialSplits[participant.id] = amount;
            initialCustomSplits[participant.id] = amount;
            const percentage = cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
            initialPercentages[participant.id] = percentage;
            initialCustomPercentages[participant.id] = percentage;
            initialShares[participant.id] = 0;
            initialCustomShares[participant.id] = 0;
          });
        }

        groupResponse.participants.forEach((participant) => {
          if (!inclusion[participant.id]) {
            initialSplits[participant.id] = 0;
            initialShares[participant.id] = 0;
            initialPercentages[participant.id] = 0;
            initialCustomSplits[participant.id] = 0;
            initialCustomShares[participant.id] = 0;
            initialCustomPercentages[participant.id] = 0;
          }
        });

        setSplits(initialSplits);
        setShares(initialShares);
        setPercentages(initialPercentages);
        setCustomSplits(initialCustomSplits);
        setCustomShares(initialCustomShares);
        setCustomPercentages(initialCustomPercentages);
        setIncludedParticipants(inclusion);
      } catch (error) {
        toast.error('Failed to load expense data');
        console.error('Error loading expense data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExpenseData();
  }, [urlSlug, expenseIdNumber]);

  useEffect(() => {
    if (!participants.length) {
      return;
    }

    setIncludedParticipants(prev => {
      const next = { ...prev };
      let changed = false;

      participants.forEach(participant => {
        if (next[participant.id] === undefined) {
          next[participant.id] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [participants]);

  const handleInputChange = (field: string, value: string | number) => {
    let nextValue = value;

    if (field === 'cost') {
      const stringValue = String(value);
      const digitsOnly = stringValue.replace(/[^0-9.]/g, '');
      const [whole, ...decimals] = digitsOnly.split('.');
      const rebuilt = decimals.length > 0 ? `${whole}.${decimals.join('')}` : whole;
      nextValue = rebuilt;
    }

    setFormData(prev => ({
      ...prev,
      [field]: nextValue,
    }));

    const costValue = field === 'cost'
      ? parseFloat(String(nextValue)) || 0
      : parseFloat(formData.cost) || 0;

    if (field === 'split_type') {
      const newSplitType = nextValue as string;
      const inclusion = includedParticipants;
      const activeParticipants = participants.filter(participant => inclusion[participant.id]);

      const updatedCustomSplits: { [key: number]: number } = { ...customSplits };
      const updatedCustomShares: { [key: number]: number } = { ...customShares };
      const updatedCustomPercentages: { [key: number]: number } = { ...customPercentages };

      if (newSplitType === 'shares') {
        const equalAmount = activeParticipants.length > 0 ? costValue / activeParticipants.length : 0;
        activeParticipants.forEach(participant => {
          const amount = splits[participant.id] ?? 0;
          updatedCustomShares[participant.id] = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
        });
      } else if (newSplitType === 'percentage') {
        activeParticipants.forEach(participant => {
          const amount = splits[participant.id] ?? 0;
          updatedCustomPercentages[participant.id] = costValue > 0 ? roundToTwoDecimals((amount / costValue) * 100) : 0;
        });
      } else if (newSplitType === 'amount') {
        activeParticipants.forEach(participant => {
          updatedCustomSplits[participant.id] = splits[participant.id] ?? 0;
        });
      }

      participants.forEach(participant => {
        if (!inclusion[participant.id]) {
          updatedCustomSplits[participant.id] = 0;
          updatedCustomShares[participant.id] = 0;
          updatedCustomPercentages[participant.id] = 0;
        }
      });

      setCustomSplits(updatedCustomSplits);
      setCustomShares(updatedCustomShares);
      setCustomPercentages(updatedCustomPercentages);

      redistributeSplits({
        splitType: newSplitType,
        inclusion,
        customSplitsState: updatedCustomSplits,
        customSharesState: updatedCustomShares,
        customPercentagesState: updatedCustomPercentages,
        costValue,
      });

      return;
    }

    if (field === 'cost') {
      redistributeSplits({ costValue });
    }
  };

  const handleSplitChange = (participantId: number, amount: string) => {
    if (!includedParticipants[participantId]) {
      return;
    }

    const value = Math.max(0, parseFloat(amount) || 0);
    const updatedCustomSplits = {
      ...customSplits,
      [participantId]: value,
    };

    setCustomSplits(updatedCustomSplits);
    redistributeSplits({ customSplitsState: updatedCustomSplits });
  };

  const handleShareChange = (participantId: number, share: string) => {
    if (!includedParticipants[participantId]) {
      return;
    }

    const sanitized = share.replace(/[^0-9]/g, '');
    const value = Math.max(1, Math.round(parseFloat(sanitized) || 1));
    const updatedCustomShares = {
      ...customShares,
      [participantId]: value,
    };

    setCustomShares(updatedCustomShares);
    redistributeSplits({ customSharesState: updatedCustomShares });
  };

  const handlePercentageChange = (participantId: number, percentage: string) => {
    if (!includedParticipants[participantId]) {
      return;
    }

    const value = Math.max(0, Math.min(100, roundToTwoDecimals(parseFloat(percentage) || 0)));
    const updatedCustomPercentages = {
      ...customPercentages,
      [participantId]: value,
    };

    setCustomPercentages(updatedCustomPercentages);
    redistributeSplits({ customPercentagesState: updatedCustomPercentages });
  };

  const handleParticipantToggle = (participantId: number, checked: boolean) => {
    if (submitting || deleting) {
      return;
    }

    const currentlyIncluded = participants.filter(participant => includedParticipants[participant.id]);
    if (!checked && currentlyIncluded.length <= 1) {
      toast.error('At least one participant must be included in the expense.');
      return;
    }

    const updatedInclusion = {
      ...includedParticipants,
      [participantId]: checked,
    };

    const updatedCustomSplits = { ...customSplits };
    const updatedCustomShares = { ...customShares };
    const updatedCustomPercentages = { ...customPercentages };

    if (!checked) {
      updatedCustomSplits[participantId] = 0;
      updatedCustomShares[participantId] = 0;
      updatedCustomPercentages[participantId] = 0;
    }

    setIncludedParticipants(updatedInclusion);
    setCustomSplits(updatedCustomSplits);
    setCustomShares(updatedCustomShares);
    setCustomPercentages(updatedCustomPercentages);

    redistributeSplits({
      inclusion: updatedInclusion,
      customSplitsState: updatedCustomSplits,
      customSharesState: updatedCustomShares,
      customPercentagesState: updatedCustomPercentages,
    });
  };

  const validateSplits = () => {
    const activeParticipants = participants.filter(participant => includedParticipants[participant.id]);
    if (!activeParticipants.length) {
      return false;
    }

    const totalCost = parseFloat(formData.cost) || 0;
    const totalSplits = activeParticipants.reduce((sum, participant) => sum + (splits[participant.id] || 0), 0);

    if (formData.split_type === 'percentage') {
      const totalPercentage = activeParticipants.reduce((sum, participant) => sum + (percentages[participant.id] || 0), 0);
      return Math.abs(100 - totalPercentage) < 0.01;
    }

    return Math.abs(totalCost - totalSplits) < 0.01;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!group || !expenseIdNumber) return;

    if (formData.payer_id === 0) {
      toast.error('Please select who paid for this expense');
      return;
    }

    const activeParticipants = participants.filter(participant => includedParticipants[participant.id]);
    if (!activeParticipants.length) {
      toast.error('Include at least one participant in the expense.');
      return;
    }

    if (!validateSplits()) {
      toast.error('Split amounts must equal the total cost');
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

      const costValue = parseFloat(formData.cost) || 0;
      const allSplits: { [key: number]: number } = {};

      if (formData.split_type === 'equal') {
        const equalAmount = activeParticipants.length > 0 ? costValue / activeParticipants.length : 0;
        const distributed = distributeWithRemainder(new Array(activeParticipants.length).fill(equalAmount), costValue);
        activeParticipants.forEach((participant, index) => {
          allSplits[participant.id] = roundToTwoDecimals(distributed[index] ?? 0);
        });
      } else {
        activeParticipants.forEach(participant => {
          allSplits[participant.id] = roundToTwoDecimals(splits[participant.id] ?? 0);
        });
      }

      const splitArray: Split[] = activeParticipants.map(participant => ({
        split_id: 0,
        group_id: group.id,
        expense_id: expenseIdNumber,
        participant_id: participant.id,
        split_amount: allSplits[participant.id] ?? 0,
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

  const activeParticipants = participants.filter(participant => includedParticipants[participant.id]);
  const totalAssigned = activeParticipants.reduce((sum, participant) => sum + (splits[participant.id] || 0), 0);
  const remainingAmount = (parseFloat(formData.cost) || 0) - totalAssigned;
  const totalShares = activeParticipants.reduce((sum, participant) => sum + (shares[participant.id] || 0), 0);
  const totalPercentage = activeParticipants.reduce((sum, participant) => sum + (percentages[participant.id] || 0), 0);

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
                        inputMode="decimal"
                        pattern="[0-9]*\\.?[0-9]*"
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

              {participants.map((participant) => {
                const isIncluded = includedParticipants[participant.id] ?? true;
                const rawSplit = splits[participant.id] ?? 0;
                const displayedSplit = isIncluded ? rawSplit : 0;
                const shareValue = shares[participant.id] ?? 1;
                const participantShare = isIncluded ? shareValue : 0;
                const percentValue = percentages[participant.id] ?? 0;
                const participantPercentage = isIncluded ? percentValue : 0;

                return (
                  <div
                    key={participant.id}
                    className={`split-breakdown-participant-container${isIncluded ? '' : ' is-excluded'}`}
                  >
                    <div className="split-breakdown-details-container">
                      <label className="split-breakdown-checkbox">
                        <input
                          type="checkbox"
                          checked={isIncluded}
                          onChange={(e) => handleParticipantToggle(participant.id, e.target.checked)}
                          aria-label={`Include ${participant.name} in this expense`}
                          disabled={submitting || deleting}
                        />
                        <span className="checkbox-indicator">
                          {isIncluded && <FontAwesomeIcon icon={faCheck} />}
                        </span>
                      </label>
                      <div className="split-breakdown-participant-details">
                        <p className={isIncluded ? undefined : 'text-is-muted'}>{participant.name}</p>
                        <p className={isIncluded ? 'p2' : 'p2 text-is-muted'}>
                          {group.currency}{formatAmount(displayedSplit)}
                        </p>
                      </div>
                    </div>

                    {formData.split_type === 'equal' && (
                      <div className={`split-breakdown-even-split-container${isIncluded ? '' : ' is-disabled'}`}>
                        <span>{group.currency}{formatAmount(displayedSplit)}</span>
                      </div>
                    )}

                    {formData.split_type === 'amount' && (
                      <div className="split-breakdown-amount-split-container">
                        <p className={isIncluded ? undefined : 'text-is-muted'}>{group.currency}</p>
                        <input
                          type="number"
                          value={displayedSplit.toFixed(2)}
                          onChange={(e) => handleSplitChange(participant.id, e.target.value)}
                          className="form-input"
                          step="0.01"
                          min="0"
                          disabled={!isIncluded || submitting || deleting}
                        />
                      </div>
                    )}

                    {formData.split_type === 'shares' && (
                      <div className="share-adjust">
                        <button
                          type="button"
                          className="share-adjust__button"
                          onClick={() => adjustShare(participant.id, -1)}
                          disabled={!isIncluded || participantShare <= 1 || submitting || deleting}
                          aria-label={`Decrease shares for ${participant.name}`}
                        >
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <input
                          type="number"
                          value={participantShare}
                          onChange={(e) => handleShareChange(participant.id, e.target.value)}
                          className="share-adjust__input"
                          min="1"
                          step="1"
                          disabled={!isIncluded || submitting || deleting}
                          style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                          inputMode="numeric"
                          pattern="[0-9]*"
                        />
                        <button
                          type="button"
                          className="share-adjust__button"
                          onClick={() => adjustShare(participant.id, 1)}
                          disabled={!isIncluded || submitting || deleting}
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
                          value={participantPercentage.toFixed(2)}
                          onChange={(e) => handlePercentageChange(participant.id, e.target.value)}
                          className="form-input right-align-text"
                          min="0"
                          max="99.99"
                          step="0.01"
                          disabled={!isIncluded || submitting || deleting}
                          style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                        />
                        <p className={isIncluded ? undefined : 'text-is-muted'}>%</p>
                      </div>
                    )}
                  </div>
                );
              })}

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
                  {group.currency}{formatAmount(totalAssigned)}
                </h2>
              </div>
              {formData.split_type === 'amount' && (
                <div className="p2">
                  Remaining: {group.currency}{formatAmount(remainingAmount)}
                </div>
              )}
              {formData.split_type === 'shares' && (
                <div className="p2">
                  Total Shares: {totalShares}
                </div>
              )}
              {formData.split_type === 'percentage' && (
                <div className="p2">
                  Total Percentage: {totalPercentage.toFixed(2)}%
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
