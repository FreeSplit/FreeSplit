import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getGroup, getExpenseWithSplits, updateExpense, deleteExpense } from '../services/api';
import { Group, Participant, Expense, Split } from '../services/api';
import { useGroupTracking } from '../hooks/useGroupTracking';
import toast from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faPlus, faChevronDown, faXmark, faTrash, faCheck } from '@fortawesome/free-solid-svg-icons';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { ring } from 'ldrs'; ring.register();

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

const calculateAmountsFromShares = (shares: { [key: number]: number }, cost: number): { [key: number]: number } => {
  const amounts: { [key: number]: number } = {};
  const totalShares = Object.values(shares).reduce((sum, val) => sum + val, 0);

  if (totalShares > 0) {
    const amountsArray = Object.entries(shares).map(([id, share]) => (share / totalShares) * cost);
    const distributed = distributeWithRemainder(amountsArray, cost);

    Object.keys(shares).forEach((id, index) => {
      amounts[Number(id)] = distributed[index];
    });
  }

  return amounts;
};

const calculateAmountsFromPercentages = (percentages: { [key: number]: number }, cost: number): { [key: number]: number } => {
  const amounts: { [key: number]: number } = {};

  Object.entries(percentages).forEach(([id, percentage]) => {
    amounts[Number(id)] = roundToTwoDecimals((percentage / 100) * cost);
  });

  return amounts;
};

const sanitizeDecimalInput = (value: string): string => {
  const digitsOnly = value.replace(/[^0-9.]/g, '');
  const [whole, ...decimalParts] = digitsOnly.split('.');
  if (decimalParts.length > 0) {
    return `${whole}.${decimalParts.join('')}`;
  }
  return whole;
};

const parseDecimalValue = (value: string): number => {
  const sanitized = sanitizeDecimalInput(value);
  if (!sanitized) {
    return 0;
  }
  const parsed = parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
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

const toFixedString = (value: number): string => value.toFixed(2);

const EditExpense: React.FC = () => {
  const { urlSlug, expenseId } = useParams<{ urlSlug: string; expenseId: string }>();
  const navigate = useNavigate();
  type FormErrors = {
    name?: string;
    cost?: string;
    payer?: string;
  };

  // Track group visit for user groups feature
  useGroupTracking();

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
  const [draftSplits, setDraftSplits] = useState<{ [key: number]: string }>({});
  const [draftShares, setDraftShares] = useState<{ [key: number]: string }>({});
  const [draftPercentages, setDraftPercentages] = useState<{ [key: number]: string }>({});
  const [lockedAmountParticipants, setLockedAmountParticipants] = useState<{ [key: number]: boolean }>({});
  const [lockedPercentageParticipants, setLockedPercentageParticipants] = useState<{ [key: number]: boolean }>({});
  const [includedParticipants, setIncludedParticipants] = useState<{ [key: number]: boolean }>({});
  const [existingSplitIds, setExistingSplitIds] = useState<{ [key: number]: number }>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [isEmojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const [isSplitTypeDropdownOpen, setSplitTypeDropdownOpen] = useState(false);
  const splitTypeDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isPayerDropdownOpen, setPayerDropdownOpen] = useState(false);
  const payerDropdownRef = useRef<HTMLDivElement | null>(null);

  const expenseIdNumber = expenseId ? parseInt(expenseId, 10) : null;

  const nameHasError = Boolean(errors.name);
  const costHasError = Boolean(errors.cost);
  const payerHasError = Boolean(errors.payer);

  const nameContainerClasses = ['form-input-container'];
  if (nameHasError) {
    nameContainerClasses.push('is-error');
  } else if (formData.name.trim()) {
    nameContainerClasses.push('is-complete');
  }

  const costContainerClasses = ['form-input-container'];
  if (costHasError) {
    costContainerClasses.push('is-error');
  } else if (formData.cost.trim()) {
    costContainerClasses.push('is-complete');
  }

  const payerContainerClasses = ['form-input-container'];
  if (payerHasError) {
    payerContainerClasses.push('is-error');
  } else if (formData.payer_id) {
    payerContainerClasses.push('is-complete');
  }

  const selectedPayer = participants.find(participant => participant.id === formData.payer_id);
  const splitTypeOptions = [
    { value: 'equal', label: 'Equal' },
    { value: 'amount', label: 'Amount' },
    { value: 'shares', label: 'Shares' },
    { value: 'percentage', label: 'Percentage' }
  ];
  const selectedSplitType = splitTypeOptions.find(option => option.value === formData.split_type)?.label ?? 'Equal';

  const openEmojiPicker = useCallback(() => {
    if (deleting) {
      return;
    }
    setEmojiPickerOpen(true);
  }, [deleting]);

  const closeEmojiPicker = useCallback(() => {
    setEmojiPickerOpen(false);
  }, []);

  const handleEmojiSelect = useCallback((emoji: { native?: string }) => {
    const nextEmoji = emoji?.native;
    if (!nextEmoji) {
      setEmojiPickerOpen(false);
      return;
    }

    setFormData(prev => ({
      ...prev,
      emoji: nextEmoji,
    }));
    setEmojiPickerOpen(false);
  }, []);

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return;
    }

    let frame: number | null = null;

    const applyHostStyles = () => {
      const host = emojiPickerRef.current?.querySelector<HTMLElement>('em-emoji-picker');

      if (!host) {
        frame = requestAnimationFrame(applyHostStyles);
        return;
      }

      host.style.width = '100%';
      host.style.maxWidth = '100%';
      host.style.display = 'block';
      host.style.minWidth = '100%';
    };

    applyHostStyles();

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [isEmojiPickerOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!splitTypeDropdownRef.current) {
        return;
      }

      if (!splitTypeDropdownRef.current.contains(event.target as Node)) {
        setSplitTypeDropdownOpen(false);
      }
    };

    if (isSplitTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSplitTypeDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!payerDropdownRef.current) {
        return;
      }

      if (!payerDropdownRef.current.contains(event.target as Node)) {
        setPayerDropdownOpen(false);
      }
    };

    if (isPayerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPayerDropdownOpen]);

  useEffect(() => {
    if (submitting || deleting) {
      setSplitTypeDropdownOpen(false);
      setPayerDropdownOpen(false);
    }
  }, [submitting, deleting]);

  const handleSplitTypeSelect = (nextSplitType: string) => {
    if (submitting || deleting) {
      return;
    }
    setSplitTypeDropdownOpen(false);
    if (nextSplitType === formData.split_type) {
      return;
    }
    handleInputChange('split_type', nextSplitType);
  };

  const handlePayerSelect = (participantId: number) => {
    if (submitting || deleting) {
      return;
    }
    setPayerDropdownOpen(false);
    handleInputChange('payer_id', participantId);
  };

  const adjustShare = (participantId: number, delta: number) => {
    if (!includedParticipants[participantId] || submitting || deleting) {
      return;
    }

    const current = customShares[participantId] || shares[participantId] || 1;
    const next = current + delta;
    applyShareValue(participantId, next);
  };

  const redistributeSplits = (overrides?: {
    inclusion?: { [key: number]: boolean };
    customSplitsState?: { [key: number]: number };
    customSharesState?: { [key: number]: number };
    customPercentagesState?: { [key: number]: number };
    splitType?: string;
    costValue?: number;
    lockedAmountState?: { [key: number]: boolean };
    lockedPercentageState?: { [key: number]: boolean };
  }) => {
    if (!participants.length) {
      return;
    }

    const inclusion = overrides?.inclusion ?? includedParticipants;
    const splitType = overrides?.splitType ?? formData.split_type;
    const costValue = overrides?.costValue ?? parseDecimalValue(formData.cost);
    const customSplitsState = overrides?.customSplitsState ?? customSplits;
    const customSharesState = overrides?.customSharesState ?? customShares;
    const customPercentagesState = overrides?.customPercentagesState ?? customPercentages;
    const lockedAmountState = overrides?.lockedAmountState ?? lockedAmountParticipants;
    const lockedPercentageState = overrides?.lockedPercentageState ?? lockedPercentageParticipants;

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
      let totalLockedPercentage = 0;

      activeParticipants.forEach(participant => {
        const participantId = participant.id;
        const isLocked = lockedPercentageState[participantId];
        const rawValue = Math.max(0, customPercentagesState[participantId] ?? percentages[participantId] ?? 0);
        if (isLocked) {
          const clamped = Math.min(100, rawValue);
          totalLockedPercentage += clamped;
          nextCustomPercentages[participantId] = clamped;
          nextPercentages[participantId] = clamped;
        }
      });

      const remainingParticipants = activeParticipants.filter(participant => !lockedPercentageState[participant.id]);
      const remainingCount = remainingParticipants.length;
      let remainingPercentage = roundToTwoDecimals(100 - totalLockedPercentage);
      if (remainingPercentage < 0) {
        remainingPercentage = 0;
      }

      if (remainingCount > 0) {
        const basePercentages = remainingParticipants.map(participant => {
          const value = Math.max(0, customPercentagesState[participant.id] ?? percentages[participant.id] ?? 0);
          return value;
        });
        const totalBase = basePercentages.reduce((sum, value) => sum + value, 0);
        let scaled: number[];
        if (remainingPercentage <= 0) {
          scaled = new Array(remainingCount).fill(0);
        } else if (totalBase <= 0) {
          scaled = new Array(remainingCount).fill(remainingPercentage / remainingCount);
        } else {
          const scale = remainingPercentage / totalBase;
          scaled = basePercentages.map(value => value * scale);
        }

        const distributed = distributeWithRemainder(scaled, remainingPercentage);
        remainingParticipants.forEach((participant, index) => {
          const participantId = participant.id;
          const percentage = Math.min(100, Math.max(0, roundToTwoDecimals(distributed[index] ?? 0)));
          nextCustomPercentages[participantId] = percentage;
          nextPercentages[participantId] = percentage;
        });
      }

      const percentageMap: { [key: number]: number } = {};
      activeParticipants.forEach(participant => {
        const participantId = participant.id;
        const percentage = Math.max(0, nextCustomPercentages[participantId] ?? 0);
        percentageMap[participantId] = percentage;
      });

      const amounts = calculateAmountsFromPercentages(percentageMap, costValue);

      activeParticipants.forEach(participant => {
        const participantId = participant.id;
        const amount = roundToTwoDecimals(amounts[participantId] ?? 0);
        nextSplits[participantId] = amount;
        nextShares[participantId] = 0;
        nextCustomShares[participantId] = 0;
        nextCustomSplits[participantId] = amount;
      });
    } else if (splitType === 'amount') {
      let totalLockedAmount = 0;

      activeParticipants.forEach(participant => {
        const participantId = participant.id;
        if (lockedAmountState[participantId]) {
          const current = Math.max(0, customSplitsState[participantId] ?? splits[participantId] ?? 0);
          const amount = roundToTwoDecimals(current);
          totalLockedAmount += amount;
          nextCustomSplits[participantId] = amount;
          nextSplits[participantId] = amount;
          nextShares[participantId] = 0;
          nextCustomShares[participantId] = 0;
          nextPercentages[participantId] = costValue > 0 ? roundToTwoDecimals((amount / costValue) * 100) : 0;
          nextCustomPercentages[participantId] = nextPercentages[participantId];
        }
      });

      const remainingParticipants = activeParticipants.filter(participant => !lockedAmountState[participant.id]);
      const remainingCount = remainingParticipants.length;
      let remainingCost = roundToTwoDecimals(costValue - totalLockedAmount);
      if (remainingCost < 0) {
        remainingCost = 0;
      }

      if (remainingCount > 0) {
        const baseAmounts = remainingParticipants.map(participant => {
          const current = Math.max(0, customSplitsState[participant.id] ?? splits[participant.id] ?? 0);
          return current;
        });
        const totalBase = baseAmounts.reduce((sum, value) => sum + value, 0);
        let scaled: number[];
        if (remainingCost <= 0) {
          scaled = new Array(remainingCount).fill(0);
        } else if (totalBase <= 0) {
          scaled = new Array(remainingCount).fill(remainingCost / remainingCount);
        } else {
          const scale = remainingCost / totalBase;
          scaled = baseAmounts.map(value => value * scale);
        }

        const distributed = distributeWithRemainder(scaled, remainingCost);
        remainingParticipants.forEach((participant, index) => {
          const participantId = participant.id;
          const amount = roundToTwoDecimals(distributed[index] ?? 0);
          nextCustomSplits[participantId] = amount;
          nextSplits[participantId] = amount;
          nextShares[participantId] = 0;
          nextCustomShares[participantId] = 0;
          nextPercentages[participantId] = costValue > 0 ? roundToTwoDecimals((amount / costValue) * 100) : 0;
          nextCustomPercentages[participantId] = nextPercentages[participantId];
        });
      }
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

  const loadExpenseData = useCallback(async () => {
    if (!urlSlug || !expenseIdNumber) {
      return;
    }

    try {
      setLoading(true);
      const [groupResponse, expenseResponse] = await Promise.all([
        getGroup(urlSlug),
        getExpenseWithSplits(expenseIdNumber),
      ]);

      setGroup(groupResponse.group);
      setParticipants(groupResponse.participants);

      const expense = expenseResponse.expense;
      const splitsFromApi = expenseResponse.splits;
      const costNumber = expense.cost ?? 0;

      setFormData({
        name: expense.name || '',
        cost: formatAmount(costNumber),
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
      const splitIdMap: { [key: number]: number } = {};
      const initialLockedAmounts: { [key: number]: boolean } = {};
      const initialLockedPercentages: { [key: number]: boolean } = {};

      groupResponse.participants.forEach(participant => {
        initialSplits[participant.id] = 0;
        initialShares[participant.id] = 1;
        initialPercentages[participant.id] = 0;
        initialCustomSplits[participant.id] = 0;
        initialCustomShares[participant.id] = 1;
        initialCustomPercentages[participant.id] = 0;
        inclusion[participant.id] = false;
      });

      splitsFromApi.forEach(split => {
        const participantId = split.participant_id;
        const amount = roundToTwoDecimals(split.split_amount ?? 0);
        splitIdMap[participantId] = split.split_id;
        inclusion[participantId] = true;
        initialSplits[participantId] = amount;
        initialCustomSplits[participantId] = amount;
      });

      const activeParticipants = groupResponse.participants.filter(participant => inclusion[participant.id]);
      const activeCount = activeParticipants.length;

      if (expense.split_type === 'equal') {
        if (activeCount > 0) {
          const equalAmount = costNumber / activeCount;
          const distributed = distributeWithRemainder(new Array(activeCount).fill(equalAmount), costNumber);
          activeParticipants.forEach((participant, index) => {
            const amount = roundToTwoDecimals(distributed[index] ?? 0);
            initialSplits[participant.id] = amount;
            initialCustomSplits[participant.id] = amount;
            initialShares[participant.id] = 1;
            initialCustomShares[participant.id] = 1;
            const percentage = costNumber > 0 ? roundToTwoDecimals((amount / costNumber) * 100) : 0;
            initialPercentages[participant.id] = percentage;
            initialCustomPercentages[participant.id] = percentage;
          });
        }
      } else if (expense.split_type === 'shares') {
        const workingShares: { [key: number]: number } = {};
        const equalAmount = activeCount > 0 ? costNumber / activeCount : 0;

        activeParticipants.forEach(participant => {
          const amount = initialSplits[participant.id] || 0;
          const shareValue = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
          workingShares[participant.id] = shareValue;
        });

        const shareAmounts = calculateAmountsFromShares(workingShares, costNumber);

        activeParticipants.forEach(participant => {
          const shareValue = workingShares[participant.id] ?? 1;
          const amount = roundToTwoDecimals(shareAmounts[participant.id] ?? 0);
          initialShares[participant.id] = shareValue;
          initialCustomShares[participant.id] = shareValue;
          initialSplits[participant.id] = amount;
          initialCustomSplits[participant.id] = amount;
          const percentage = costNumber > 0 ? roundToTwoDecimals((amount / costNumber) * 100) : 0;
          initialPercentages[participant.id] = percentage;
          initialCustomPercentages[participant.id] = percentage;
        });
      } else if (expense.split_type === 'percentage') {
        if (activeCount > 0) {
          const basePercentages = activeParticipants.map(participant => {
            const amount = initialSplits[participant.id] || 0;
            return costNumber > 0 ? roundToTwoDecimals((amount / costNumber) * 100) : 0;
          });
          const distributedPercentages = distributeWithRemainder(basePercentages, 100);
          const percentageMap: { [key: number]: number } = {};

          activeParticipants.forEach((participant, index) => {
            const percentage = Math.max(0, roundToTwoDecimals(distributedPercentages[index] ?? 0));
            percentageMap[participant.id] = percentage;
            initialPercentages[participant.id] = percentage;
            initialCustomPercentages[participant.id] = percentage;
            if (percentage > 0) {
              initialLockedPercentages[participant.id] = true;
            }
          });

          const amounts = calculateAmountsFromPercentages(percentageMap, costNumber);
          activeParticipants.forEach(participant => {
            const amount = roundToTwoDecimals(amounts[participant.id] ?? 0);
            initialSplits[participant.id] = amount;
            initialCustomSplits[participant.id] = amount;
          });
        }
      } else if (expense.split_type === 'amount') {
        activeParticipants.forEach(participant => {
          const amount = roundToTwoDecimals(initialSplits[participant.id] ?? 0);
          initialSplits[participant.id] = amount;
          initialCustomSplits[participant.id] = amount;
          const percentage = costNumber > 0 ? roundToTwoDecimals((amount / costNumber) * 100) : 0;
          initialPercentages[participant.id] = percentage;
          initialCustomPercentages[participant.id] = percentage;
          initialShares[participant.id] = 0;
          initialCustomShares[participant.id] = 0;
          if (amount > 0) {
            initialLockedAmounts[participant.id] = true;
          }
        });
      }

      groupResponse.participants.forEach(participant => {
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
      setExistingSplitIds(splitIdMap);
      setLockedAmountParticipants(initialLockedAmounts);
      setLockedPercentageParticipants(initialLockedPercentages);
      setDraftSplits({});
      setDraftShares({});
      setDraftPercentages({});
    } catch (error) {
      toast.error('Failed to load expense data');
      console.error('Error loading expense data:', error);
    } finally {
      setLoading(false);
    }
  }, [expenseIdNumber, urlSlug]);

  useEffect(() => {
    loadExpenseData();
  }, [loadExpenseData]);

  useEffect(() => {
    if (!participants.length) {
      return;
    }

    setIncludedParticipants(prev => {
      const next = { ...prev };
      let changed = false;

      participants.forEach(participant => {
        if (next[participant.id] === undefined) {
          next[participant.id] = false;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [participants]);

  const handleInputChange = (field: string, value: string | number) => {
    let nextValue = value;

    if (field === 'cost') {
      nextValue = sanitizeDecimalInput(String(value));
    }

    setFormData(prev => ({
      ...prev,
      [field]: nextValue,
    }));

    const cost = field === 'cost'
      ? parseDecimalValue(String(nextValue))
      : parseDecimalValue(formData.cost);

    setErrors(prev => {
      if (field === 'name' && typeof nextValue === 'string') {
        if (!nextValue.trim() || !prev.name) {
          return prev;
        }
        const next = { ...prev };
        delete next.name;
        return next;
      }

      if (field === 'cost') {
        const stringValue = typeof nextValue === 'string' ? nextValue : String(nextValue);
        if (!stringValue.trim() || !prev.cost) {
          return prev;
        }
        const next = { ...prev };
        delete next.cost;
        return next;
      }

      if (field === 'payer_id') {
        const numericValue = typeof nextValue === 'number' ? nextValue : parseInt(String(nextValue), 10);
        if (numericValue > 0 && prev.payer) {
          const next = { ...prev };
          delete next.payer;
          return next;
        }
        return prev;
      }

      return prev;
    });

    if (field === 'split_type') {
      const newSplitType = nextValue as string;
      const inclusion = includedParticipants;
      const activeParticipants = participants.filter(participant => inclusion[participant.id]);

      const updatedCustomSplits: { [key: number]: number } = { ...customSplits };
      const updatedCustomShares: { [key: number]: number } = { ...customShares };
      const updatedCustomPercentages: { [key: number]: number } = { ...customPercentages };
      const nextLockedAmounts = newSplitType === 'amount' ? lockedAmountParticipants : {};
      const nextLockedPercentages = newSplitType === 'percentage' ? lockedPercentageParticipants : {};

      if (newSplitType === 'shares') {
        const equalAmount = activeParticipants.length > 0 ? cost / activeParticipants.length : 0;
        activeParticipants.forEach(participant => {
          const amount = splits[participant.id] ?? 0;
          updatedCustomShares[participant.id] = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
        });
      } else if (newSplitType === 'percentage') {
        activeParticipants.forEach(participant => {
          const amount = splits[participant.id] ?? 0;
          updatedCustomPercentages[participant.id] = cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
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
      setDraftSplits({});
      setDraftShares({});
      setDraftPercentages({});
      if (newSplitType !== 'amount' && Object.keys(lockedAmountParticipants).length > 0) {
        setLockedAmountParticipants({});
      }
      if (newSplitType !== 'percentage' && Object.keys(lockedPercentageParticipants).length > 0) {
        setLockedPercentageParticipants({});
      }

      redistributeSplits({
        splitType: newSplitType,
        inclusion,
        customSplitsState: updatedCustomSplits,
        customSharesState: updatedCustomShares,
        customPercentagesState: updatedCustomPercentages,
        costValue: cost,
        lockedAmountState: nextLockedAmounts,
        lockedPercentageState: nextLockedPercentages,
      });

      return;
    }

    if (field === 'cost') {
      redistributeSplits({ costValue: cost });
    }
  };

  const handleSplitDraftChange = (participantId: number, amount: string) => {
    const sanitized = sanitizeDecimalInput(amount);
    setDraftSplits(prev => ({ ...prev, [participantId]: sanitized }));
  };

  const beginSplitEdit = (participantId: number, currentValue: number) => {
    setDraftSplits(prev => {
      if (prev.hasOwnProperty(participantId)) {
        return prev;
      }
      return {
        ...prev,
        [participantId]: sanitizeDecimalInput(toFixedString(currentValue)),
      };
    });
  };

  const commitSplitChange = (participantId: number, fallbackValue: number) => {
    if (!includedParticipants[participantId]) {
      setDraftSplits(prev => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
      if (lockedAmountParticipants.hasOwnProperty(participantId)) {
        const nextLocked = { ...lockedAmountParticipants };
        delete nextLocked[participantId];
        setLockedAmountParticipants(nextLocked);
        redistributeSplits({
          customSplitsState: { ...customSplits, [participantId]: 0 },
          lockedAmountState: nextLocked,
        });
      }
      return;
    }

    const raw = draftSplits[participantId];
    const sanitized = raw !== undefined ? sanitizeDecimalInput(raw) : sanitizeDecimalInput(toFixedString(fallbackValue));
    const parsed = parseDecimalValue(sanitized);

    let nextLockedAmounts = lockedAmountParticipants;
    if (parsed > 0) {
      nextLockedAmounts = { ...lockedAmountParticipants, [participantId]: true };
    } else if (lockedAmountParticipants.hasOwnProperty(participantId)) {
      nextLockedAmounts = { ...lockedAmountParticipants };
      delete nextLockedAmounts[participantId];
    }
    if (nextLockedAmounts !== lockedAmountParticipants) {
      setLockedAmountParticipants(nextLockedAmounts);
    }

    const updatedCustomSplits = {
      ...customSplits,
      [participantId]: parsed,
    };

    setCustomSplits(updatedCustomSplits);
    redistributeSplits({
      customSplitsState: updatedCustomSplits,
      lockedAmountState: nextLockedAmounts,
    });

    setDraftSplits(prev => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
  };

  const handleShareDraftChange = (participantId: number, share: string) => {
    const digitsOnly = share.replace(/[^0-9]/g, '');
    setDraftShares(prev => ({ ...prev, [participantId]: digitsOnly }));
  };

  const beginShareEdit = (participantId: number, currentValue: number) => {
    setDraftShares(prev => {
      if (prev.hasOwnProperty(participantId)) {
        return prev;
      }
      return {
        ...prev,
        [participantId]: String(currentValue),
      };
    });
  };

  const applyShareValue = (participantId: number, nextShare: number) => {
    if (nextShare <= 0) {
      handleParticipantToggle(participantId, false);
      return;
    }

    const shareValue = Math.max(1, Math.round(nextShare));
    const updatedCustomShares = {
      ...customShares,
      [participantId]: shareValue,
    };

    setCustomShares(updatedCustomShares);
    setDraftShares(prev => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
    redistributeSplits({ customSharesState: updatedCustomShares });
  };

  const commitShareChange = (participantId: number, fallbackValue: number) => {
    if (!includedParticipants[participantId]) {
      setDraftShares(prev => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
      if (lockedAmountParticipants.hasOwnProperty(participantId)) {
        const nextLocked = { ...lockedAmountParticipants };
        delete nextLocked[participantId];
        setLockedAmountParticipants(nextLocked);
      }
      return;
    }

    const raw = draftShares[participantId];
    const numeric = raw ? parseInt(raw, 10) : fallbackValue;
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setDraftShares(prev => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
      handleParticipantToggle(participantId, false);
      return;
    }
    applyShareValue(participantId, numeric);
  };

  const handlePercentageDraftChange = (participantId: number, percentage: string) => {
    const sanitized = sanitizeDecimalInput(percentage);
    setDraftPercentages(prev => ({ ...prev, [participantId]: sanitized }));
  };

  const beginPercentageEdit = (participantId: number, currentValue: number) => {
    setDraftPercentages(prev => {
      if (prev.hasOwnProperty(participantId)) {
        return prev;
      }
      return {
        ...prev,
        [participantId]: sanitizeDecimalInput(toFixedString(currentValue)),
      };
    });
  };

  const commitPercentageChange = (participantId: number, fallbackValue: number) => {
    if (!includedParticipants[participantId]) {
      setDraftPercentages(prev => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
      if (lockedPercentageParticipants.hasOwnProperty(participantId)) {
        const nextLocked = { ...lockedPercentageParticipants };
        delete nextLocked[participantId];
        setLockedPercentageParticipants(nextLocked);
        redistributeSplits({
          customPercentagesState: { ...customPercentages, [participantId]: 0 },
          lockedPercentageState: nextLocked,
        });
      }
      return;
    }

    const raw = draftPercentages[participantId];
    const sanitized = raw !== undefined ? sanitizeDecimalInput(raw) : sanitizeDecimalInput(toFixedString(fallbackValue));
    const parsed = parseDecimalValue(sanitized);
    const clamped = Math.min(100, Math.max(0, parsed));

    let nextLockedPercentages = lockedPercentageParticipants;
    if (clamped > 0) {
      nextLockedPercentages = { ...lockedPercentageParticipants, [participantId]: true };
    } else if (lockedPercentageParticipants.hasOwnProperty(participantId)) {
      nextLockedPercentages = { ...lockedPercentageParticipants };
      delete nextLockedPercentages[participantId];
    }
    if (nextLockedPercentages !== lockedPercentageParticipants) {
      setLockedPercentageParticipants(nextLockedPercentages);
    }

    const updatedCustomPercentages = {
      ...customPercentages,
      [participantId]: clamped,
    };

    setCustomPercentages(updatedCustomPercentages);
    redistributeSplits({
      customPercentagesState: updatedCustomPercentages,
      lockedPercentageState: nextLockedPercentages,
    });

    setDraftPercentages(prev => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
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

    const updatedLockedAmounts = { ...lockedAmountParticipants };
    const updatedLockedPercentages = { ...lockedPercentageParticipants };

    if (!checked) {
      delete updatedLockedAmounts[participantId];
      delete updatedLockedPercentages[participantId];
    }

    setIncludedParticipants(updatedInclusion);
    setCustomSplits(updatedCustomSplits);
    setCustomShares(updatedCustomShares);
    setCustomPercentages(updatedCustomPercentages);
    setDraftSplits(prev => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
    setDraftShares(prev => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
    setDraftPercentages(prev => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
    setLockedAmountParticipants(updatedLockedAmounts);
    setLockedPercentageParticipants(updatedLockedPercentages);

    redistributeSplits({
      inclusion: updatedInclusion,
      customSplitsState: updatedCustomSplits,
      customSharesState: updatedCustomShares,
      customPercentagesState: updatedCustomPercentages,
      lockedAmountState: updatedLockedAmounts,
      lockedPercentageState: updatedLockedPercentages,
    });
  };

  const validateSplits = () => {
    const activeParticipants = participants.filter(participant => includedParticipants[participant.id]);
    if (!activeParticipants.length) {
      return false;
    }

    const totalCost = parseDecimalValue(formData.cost);
    const totalSplits = activeParticipants.reduce((sum, participant) => sum + (splits[participant.id] || 0), 0);

    if (formData.split_type === 'percentage') {
      const totalPercentage = activeParticipants.reduce((sum, participant) => sum + (percentages[participant.id] || 0), 0);
      return Math.abs(100 - totalPercentage) < 0.01;
    }

    return Math.abs(totalCost - totalSplits) < 0.01;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!group || !expenseIdNumber) {
      return;
    }

    const trimmedName = formData.name.trim();
    const costValue = parseDecimalValue(formData.cost);
    const nextErrors: FormErrors = {};

    if (!trimmedName) {
      nextErrors.name = 'Please enter a title for this expense.';
    }

    if (!formData.cost.trim() || costValue <= 0) {
      nextErrors.cost = 'Please enter the expense cost.';
    }

    if (formData.payer_id === 0) {
      nextErrors.payer = 'Please select who paid for this expense.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstError = nextErrors.name || nextErrors.cost || nextErrors.payer;
      if (firstError) {
        toast.error(firstError);
      }
      return;
    }

    const activeParticipants = participants.filter(participant => includedParticipants[participant.id]);
    if (!activeParticipants.length) {
      toast.error('Include at least one participant in the expense.');
      return;
    }

    if (!validateSplits()) {
      toast.error('Split values must balance with the total cost.');
      return;
    }

    try {
      setSubmitting(true);

      const expense: Expense = {
        id: expenseIdNumber,
        name: trimmedName,
        cost: roundToTwoDecimals(costValue),
        emoji: formData.emoji,
        payer_id: formData.payer_id,
        split_type: formData.split_type,
        split_ids: [],
        group_id: group.id,
      };

      const splitArray: Split[] = activeParticipants.map(participant => ({
        split_id: existingSplitIds[participant.id] ?? 0,
        group_id: group.id,
        expense_id: expenseIdNumber,
        participant_id: participant.id,
        split_amount: roundToTwoDecimals(splits[participant.id] ?? 0),
      }));

      await updateExpense({
        expense,
        splits: splitArray,
      });

      toast.success('Expense updated successfully!');
      navigate(`/groups/${urlSlug}`);
    } catch (error) {
      toast.error('Failed to update expense');
      console.error('Error updating expense:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!expenseIdNumber) {
      return;
    }
    if (!window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      await deleteExpense(expenseIdNumber);
      toast.success('Expense deleted successfully');
      navigate(`/groups/${urlSlug}`);
    } catch (error) {
      toast.error('Failed to delete expense');
      console.error('Error deleting expense:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="body">
          <div className="content-section align-center">
            <div className="content-container">
              <l-ring size="44" color="var(--color-primary)" />
              <h2>Loading expense data...</h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return null;
  }

  const activeParticipantsList = participants.filter(participant => includedParticipants[participant.id]);
  const costValue = parseDecimalValue(formData.cost);
  const totalAssigned = activeParticipantsList.reduce((sum, participant) => sum + (splits[participant.id] || 0), 0);
  const remainingAmount = costValue - totalAssigned;
  const totalShares = activeParticipantsList.reduce((sum, participant) => sum + (shares[participant.id] || 0), 0);
  const totalPercentage = activeParticipantsList.reduce((sum, participant) => sum + (percentages[participant.id] || 0), 0);
  const isFormComplete = Boolean(
    formData.emoji &&
    formData.name.trim() &&
    formData.cost.trim() &&
    costValue > 0 &&
    formData.payer_id
  );
  const totalsMatch = Math.abs(totalAssigned - costValue) < 0.01;

  return (
    <>
      <div className="page">
        <div className="body">
          <div className="content-section">
            <div className="modal-header">
              <h2>Edit expense</h2>
              <Link
                to={`/groups/${urlSlug}`}
                aria-label="Close edit expense"
                className="is-black"
              >
                <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} className="is-black" />
              </Link>
            </div>

            <form onSubmit={handleSubmit} className="form" id="edit-expense" noValidate>
              <div className="h-flex align-center gap-8px">
                <div>
                  <button
                    type="button"
                    id="emoji"
                    className="emoji-input"
                    onClick={openEmojiPicker}
                    aria-label="Choose an emoji for the expense"
                    disabled={deleting}
                  >
                    <span aria-hidden="true">{formData.emoji}</span>
                  </button>
                </div>
                <div className="form-item">
                  <label htmlFor="name" className="form-label">
                    Title
                  </label>
                  <div className={nameContainerClasses.join(' ')}>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="form-input"
                      placeholder="Dinner at restaurant"
                      aria-invalid={nameHasError}
                      aria-describedby={nameHasError ? 'edit-expense-name-error' : undefined}
                      required
                      disabled={submitting || deleting}
                    />
                  </div>
                  {nameHasError && (
                    <p className="form-error" id="edit-expense-name-error" role="alert">
                      {errors.name}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-item">
                <label htmlFor="cost" className="form-label">
                  Cost
                </label>
                <div className={costContainerClasses.join(' ')}>
                  <p className="is-black">
                    {group.currency}
                  </p>
                  <input
                    type="text"
                    id="cost"
                    value={formData.cost}
                    onChange={(e) => handleInputChange('cost', e.target.value)}
                    className="form-input"
                    placeholder="0.00"
                    inputMode="decimal"
                    pattern="[0-9]*\\.?[0-9]*"
                    onFocus={() => {
                      setFormData(prev => {
                        if (!prev.cost) {
                          return prev;
                        }
                        const sanitizedCost = sanitizeDecimalInput(prev.cost);
                        if (sanitizedCost === prev.cost) {
                          return prev;
                        }
                        return {
                          ...prev,
                          cost: sanitizedCost,
                        };
                      });
                    }}
                    onBlur={() => {
                      setFormData(prev => {
                        if (!prev.cost) {
                          return prev;
                        }
                        const sanitizedCost = sanitizeDecimalInput(prev.cost);
                        if (!sanitizedCost) {
                          return {
                            ...prev,
                            cost: '',
                          };
                        }
                        const parsed = parseDecimalValue(sanitizedCost);
                        const formatted = formatAmount(parsed);
                        if (formatted === prev.cost) {
                          return prev;
                        }
                        return {
                          ...prev,
                          cost: formatted,
                        };
                      });
                    }}
                    aria-invalid={costHasError}
                    aria-describedby={costHasError ? 'edit-expense-cost-error' : undefined}
                    required
                    disabled={submitting || deleting}
                  />
                </div>
                {costHasError && (
                  <p className="form-error" id="edit-expense-cost-error" role="alert">
                    {errors.cost}
                  </p>
                )}
              </div>

              <div className="form-item">
                <label htmlFor="payer" className="form-label">
                  Paid by
                </label>
                <div className={payerContainerClasses.join(' ')}>
                  <div className="relative" ref={payerDropdownRef} style={{ flex: 1 }}>
                    <button
                      type="button"
                      id="payer"
                      className="name-select dropdown-button"
                      style={{ position: 'relative', zIndex: 2, width: '100%' }}
                      onClick={() => {
                        if (submitting || deleting) {
                          return;
                        }
                        setPayerDropdownOpen(prev => !prev);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={isPayerDropdownOpen}
                      aria-invalid={payerHasError}
                      aria-describedby={payerHasError ? 'edit-expense-payer-error' : undefined}
                      disabled={submitting || deleting}
                    >
                      <span>{selectedPayer?.name ?? 'Select payer'}</span>
                      <FontAwesomeIcon icon={faChevronDown} />
                    </button>
                    {isPayerDropdownOpen && (
                      <div
                        className="absolute top-full left-0 mt-1 rounded-lg p-2 shadow-lg dropdown-container z-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        <div className="flex flex-col gap-1">
                          {participants.map(participant => (
                            <button
                              key={participant.id}
                              className={`px-3 py-2 rounded-md text-base font-medium transition-colors text-left whitespace-nowrap ${
                                participant.id === formData.payer_id ? 'text-white' : 'text-white hover:opacity-80'
                              }`}
                              style={
                                participant.id === formData.payer_id
                                  ? { backgroundColor: 'var(--color-primary-dark)' }
                                  : undefined
                              }
                              onClick={() => handlePayerSelect(participant.id)}
                              disabled={submitting || deleting}
                            >
                              {participant.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {payerHasError && (
                  <p className="form-error" id="edit-expense-payer-error" role="alert">
                    {errors.payer}
                  </p>
                )}
              </div>

              <div className="split-breakdown-container">
                <div className="split-breakdown-header">
                  <label htmlFor="split_type" className="form-label">
                    Split
                  </label>
                  <div className="split-breakdown-dropdown-menu" ref={splitTypeDropdownRef}>
                    <button
                      type="button"
                      id="split_type"
                      className="dropdown-pill dropdown-button"
                      style={{ position: 'relative', zIndex: 2 }}
                      onClick={() => {
                        if (submitting || deleting) {
                          return;
                        }
                        setSplitTypeDropdownOpen(prev => !prev);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={isSplitTypeDropdownOpen}
                      disabled={submitting || deleting}
                    >
                      <span>{selectedSplitType}</span>
                      <FontAwesomeIcon icon={faChevronDown} />
                    </button>
                    {isSplitTypeDropdownOpen && (
                      <div
                        className="absolute top-full left-0 mt-1 rounded-lg p-2 shadow-lg dropdown-container z-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        <div className="flex flex-col gap-1">
                          {splitTypeOptions.map(option => (
                            <button
                              key={option.value}
                              className={`px-3 py-2 rounded-md text-base font-medium transition-colors text-left whitespace-nowrap ${
                                option.value === formData.split_type ? 'text-white' : 'text-white hover:opacity-80'
                              }`}
                              style={
                                option.value === formData.split_type
                                  ? { backgroundColor: 'var(--color-primary-dark)' }
                                  : undefined
                              }
                              onClick={() => handleSplitTypeSelect(option.value)}
                              disabled={submitting || deleting}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {participants.map(participant => {
                  const isIncluded = includedParticipants[participant.id] ?? false;
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
                        <div className="split-breakdown-amount-split-container amount hide-scrollbar">
                          <p className={isIncluded ? undefined : 'text-is-muted'}>
                            {group.currency}
                          </p>
                          <input
                            type="text"
                            value={draftSplits.hasOwnProperty(participant.id)
                              ? draftSplits[participant.id]
                              : toFixedString(displayedSplit)}
                            onFocus={() => beginSplitEdit(participant.id, displayedSplit)}
                            onChange={(e) => handleSplitDraftChange(participant.id, e.target.value)}
                            onBlur={() => commitSplitChange(participant.id, displayedSplit)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitSplitChange(participant.id, displayedSplit);
                              }
                            }}
                            className="split-input"
                            
                            disabled={!isIncluded || submitting || deleting}
                            inputMode="decimal"
                            pattern="[0-9]*\\.?[0-9]*"
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
                            type="text"
                            value={draftShares.hasOwnProperty(participant.id)
                              ? draftShares[participant.id]
                              : String(participantShare)}
                            onFocus={() => beginShareEdit(participant.id, participantShare)}
                            onChange={(e) => handleShareDraftChange(participant.id, e.target.value)}
                            onBlur={() => commitShareChange(participant.id, participantShare)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitShareChange(participant.id, participantShare);
                              }
                            }}
                            className="share-adjust__input"
                            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                            disabled={!isIncluded || submitting || deleting}
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
                        <div className="split-breakdown-amount-split-container percent">
                          <input
                            type="text"
                            value={draftPercentages.hasOwnProperty(participant.id)
                              ? draftPercentages[participant.id]
                              : toFixedString(participantPercentage)}
                            onFocus={() => beginPercentageEdit(participant.id, participantPercentage)}
                            onChange={(e) => handlePercentageDraftChange(participant.id, e.target.value)}
                            onBlur={() => commitPercentageChange(participant.id, participantPercentage)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitPercentageChange(participant.id, participantPercentage);
                              }
                            }}
                            className="split-input percent right-align-text"
                            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                            disabled={!isIncluded || submitting || deleting}
                            inputMode="decimal"
                            pattern="[0-9]*\\.?[0-9]*"
                          />
                          <p className={isIncluded ? undefined : 'text-is-muted'}>%</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                
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
                  Remaining: <span className={Math.abs(remainingAmount) < 0.01 ? 'text-is-success' : 'text-is-error'}>
                    {group.currency}{formatAmount(remainingAmount)}
                  </span>
                </div>
              )}
              {formData.split_type === 'shares' && (
                <div className="p2">
                  Total Shares: {totalShares}
                </div>
              )}
              {formData.split_type === 'percentage' && (
                <div className="p2">
                  Total Percentage: <span className={Math.abs(totalPercentage - 100) < 0.01 ? 'text-is-success' : 'text-is-error'}>
                    {totalPercentage.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <div className="footer-two-buttons">
              <button
                  type="button"
                  className="btn--delete has-full-width"
                  onClick={handleDelete}
                  disabled={submitting || deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              <button
                type="submit"
                form="edit-expense"
                disabled={
                  submitting ||
                  deleting ||
                  !isFormComplete ||
                  !validateSplits() ||
                  !totalsMatch
                }
                className="btn has-full-width"
              >
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </footer>
        </div>
      </div>

      {isEmojiPickerOpen && (
        <div
          className="emoji-picker-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Choose emoji"
          onClick={closeEmojiPicker}
        >
          <div
            className="emoji-picker-container"
            role="document"
            onClick={(event) => event.stopPropagation()}
            ref={emojiPickerRef}
          >
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              previewPosition="none"
              skinTonePosition="none"
              className="has-full-width"
              set="native"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default EditExpense;
