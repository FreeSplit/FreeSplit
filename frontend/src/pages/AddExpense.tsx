import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getGroup, createExpense } from '../services/api';
import { Group, Participant, Expense, Split } from '../services/api';
import toast from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faPlus, faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

const AddExpense: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  type FormErrors = {
    name?: string;
    cost?: string;
    payer?: string;
  };

  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    emoji: '💰',
    payer_id: 0,
    split_type: 'equal'
  });

  const [splits, setSplits] = useState<{ [key: number]: number }>({});
  const [shares, setShares] = useState<{ [key: number]: number }>({});
  const [percentages, setPercentages] = useState<{ [key: number]: number }>({});
  const [customSplits, setCustomSplits] = useState<{ [key: number]: number }>({});
  const [customShares, setCustomShares] = useState<{ [key: number]: number }>({});
  const [customPercentages, setCustomPercentages] = useState<{ [key: number]: number }>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [isEmojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

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

  const openEmojiPicker = useCallback(() => {
    setEmojiPickerOpen(true);
  }, [setEmojiPickerOpen]);

  const closeEmojiPicker = useCallback(() => {
    setEmojiPickerOpen(false);
  }, [setEmojiPickerOpen]);

  const handleEmojiSelect = useCallback((emoji: { native?: string }) => {
    const nextEmoji = emoji?.native;
    if (!nextEmoji) {
      setEmojiPickerOpen(false);
      return;
    }

    setFormData(prev => ({
      ...prev,
      emoji: nextEmoji
    }));
    setEmojiPickerOpen(false);
  }, [setEmojiPickerOpen, setFormData]);

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

  const adjustShare = (participantId: number, delta: number) => {
    const current = shares[participantId] || 1;
    const next = Math.max(1, current + delta);
    handleShareChange(participantId, String(next));
  };

  // Helper function to round to 2 decimal places
  const roundToTwoDecimals = (num: number): number => {
    return Math.round(num * 100) / 100;
  };

  // Helper function to distribute remainder to last person
  const distributeWithRemainder = (amounts: number[], total: number): number[] => {
    const rounded = amounts.map(roundToTwoDecimals);
    const sum = rounded.reduce((acc, val) => acc + val, 0);
    const remainder = roundToTwoDecimals(total - sum);
    
    if (remainder !== 0 && rounded.length > 0) {
      rounded[rounded.length - 1] = roundToTwoDecimals(rounded[rounded.length - 1] + remainder);
    }
    
    return rounded;
  };


  // Calculate amounts from shares
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

  // Calculate amounts from percentages
  const calculateAmountsFromPercentages = (percentages: { [key: number]: number }, cost: number): { [key: number]: number } => {
    const amounts: { [key: number]: number } = {};
    
    Object.entries(percentages).forEach(([id, percentage]) => {
      amounts[Number(id)] = roundToTwoDecimals((percentage / 100) * cost);
    });
    
    return amounts;
  };

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getGroup(urlSlug!);
      setGroup(response.group);
      setParticipants(response.participants);
      
      // Initialize splits for equal splitting
      const equalAmount = 0; // Will be calculated when cost is entered
      const initialSplits: { [key: number]: number } = {};
      const initialShares: { [key: number]: number } = {};
      const initialPercentages: { [key: number]: number } = {};
      const initialCustomSplits: { [key: number]: number } = {};
      const initialCustomShares: { [key: number]: number } = {};
      const initialCustomPercentages: { [key: number]: number } = {};
      
      response.participants.forEach((participant: any) => {
        initialSplits[participant.id] = equalAmount;
        initialShares[participant.id] = 1; // Default to 1 share each
        initialPercentages[participant.id] = 0; // Will be calculated
        initialCustomSplits[participant.id] = equalAmount;
        initialCustomShares[participant.id] = 1;
        initialCustomPercentages[participant.id] = 0;
      });
      
      setSplits(initialSplits);
      setShares(initialShares);
      setPercentages(initialPercentages);
      setCustomSplits(initialCustomSplits);
      setCustomShares(initialCustomShares);
      setCustomPercentages(initialCustomPercentages);
    } catch (error) {
      toast.error('Failed to load group data');
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

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Use the new value for cost calculations, not the old formData.cost
    const cost = field === 'cost' ? parseFloat(value as string) || 0 : parseFloat(formData.cost) || 0;

    setErrors(prev => {
      if (field === 'name' && typeof value === 'string') {
        if (!value.trim() || !prev.name) {
          return prev;
        }
        const next = { ...prev };
        delete next.name;
        return next;
      }

      if (field === 'cost') {
        const stringValue = typeof value === 'string' ? value : String(value);
        if (!stringValue.trim() || !prev.cost) {
          return prev;
        }
        const next = { ...prev };
        delete next.cost;
        return next;
      }

      if (field === 'payer_id') {
        const numericValue = typeof value === 'number' ? value : parseInt(value as string, 10);
        if (numericValue > 0 && prev.payer) {
          const next = { ...prev };
          delete next.payer;
          return next;
        }
        return prev;
      }

      return prev;
    });

    // Handle split type changes with seamless conversion
    if (field === 'split_type') {
      const newSplitType = value as string;
      
      if (newSplitType === 'equal') {
        // Always show equal distribution, don't affect custom splits
        const equalAmount = participants.length > 0 ? cost / participants.length : 0;
        const newSplits: { [key: number]: number } = {};
        participants.forEach(participant => {
          newSplits[participant.id] = equalAmount;
        });
        setSplits(newSplits);
      } else if (newSplitType === 'shares') {
        // Restore custom shares or convert from current amounts
        if (Object.keys(customShares).length > 0 && Object.values(customShares).some(v => v > 0)) {
          setShares(customShares);
          const newAmounts = calculateAmountsFromShares(customShares, cost);
          setSplits(newAmounts);
        } else {
          // Convert current amounts to shares
          const newShares: { [key: number]: number } = {};
          const equalAmount = participants.length > 0 ? cost / participants.length : 0;
          participants.forEach(participant => {
            const amount = splits[participant.id] || 0;
            newShares[participant.id] = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
          });
          setShares(newShares);
          setCustomShares(newShares);
          const newAmounts = calculateAmountsFromShares(newShares, cost);
          setSplits(newAmounts);
        }
      } else if (newSplitType === 'percentage') {
        // Restore custom percentages or convert from current amounts
        if (Object.keys(customPercentages).length > 0 && Object.values(customPercentages).some(v => v > 0)) {
          setPercentages(customPercentages);
          const newAmounts = calculateAmountsFromPercentages(customPercentages, cost);
          setSplits(newAmounts);
        } else {
          // Convert current amounts to percentages
          const newPercentages: { [key: number]: number } = {};
          participants.forEach(participant => {
            const amount = splits[participant.id] || 0;
            newPercentages[participant.id] = cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
          });
          setPercentages(newPercentages);
          setCustomPercentages(newPercentages);
          const newAmounts = calculateAmountsFromPercentages(newPercentages, cost);
          setSplits(newAmounts);
        }
      } else if (newSplitType === 'amount') {
        // Restore custom amounts or keep current amounts
        if (Object.keys(customSplits).length > 0 && Object.values(customSplits).some(v => v > 0)) {
          setSplits(customSplits);
        } else {
          // Keep current amounts but ensure they sum to cost
          const currentTotal = Object.values(splits).reduce((sum, val) => sum + val, 0);
          if (currentTotal > 0 && cost > 0) {
            const multiplier = cost / currentTotal;
            const amounts = participants.map(p => (splits[p.id] || 0) * multiplier);
            const distributed = distributeWithRemainder(amounts, cost);
            const newSplits: { [key: number]: number } = {};
            participants.forEach((participant, index) => {
              newSplits[participant.id] = distributed[index];
            });
            setSplits(newSplits);
            setCustomSplits(newSplits);
          }
        }
      }
    }
    
    // Recalculate splits when cost changes
    if (field === 'cost') {
      if (formData.split_type === 'equal') {
        const equalAmount = participants.length > 0 ? cost / participants.length : 0;
        const newSplits: { [key: number]: number } = {};
        participants.forEach(participant => {
          newSplits[participant.id] = equalAmount;
        });
        setSplits(newSplits);
      } else if (formData.split_type === 'shares') {
        const newAmounts = calculateAmountsFromShares(shares, cost);
        setSplits(newAmounts);
      } else if (formData.split_type === 'percentage') {
        const newAmounts = calculateAmountsFromPercentages(percentages, cost);
        setSplits(newAmounts);
      } else if (formData.split_type === 'amount') {
        // Scale custom amounts proportionally to match the new cost
        const currentTotal = Object.values(customSplits).reduce((sum, val) => sum + val, 0);
        if (currentTotal > 0 && cost > 0) {
          const multiplier = cost / currentTotal;
          const amounts = participants.map(p => (customSplits[p.id] || 0) * multiplier);
          const distributed = distributeWithRemainder(amounts, cost);
          const newSplits: { [key: number]: number } = {};
          participants.forEach((participant, index) => {
            newSplits[participant.id] = distributed[index];
          });
          setSplits(newSplits);
          setCustomSplits(newSplits);
        } else if (cost > 0) {
          // If no existing amounts, distribute equally
          const equalAmount = participants.length > 0 ? cost / participants.length : 0;
          const newSplits: { [key: number]: number } = {};
          participants.forEach(participant => {
            newSplits[participant.id] = equalAmount;
          });
          setSplits(newSplits);
          setCustomSplits(newSplits);
        }
      }
    }
  };

  const handleSplitChange = (participantId: number, amount: string) => {
    const value = parseFloat(amount) || 0;
    const cost = parseFloat(formData.cost) || 0;
    
    // Update the splits
    setSplits(prev => ({
      ...prev,
      [participantId]: value
    }));
    
    // Update custom splits
    setCustomSplits(prev => ({
      ...prev,
      [participantId]: value
    }));
    
    // Update shares and percentages to reflect the new amounts
    if (cost > 0) {
      // Convert amounts to shares
      const equalAmount = participants.length > 0 ? cost / participants.length : 0;
      const newShares: { [key: number]: number } = {};
      participants.forEach(participant => {
        const amount = participant.id === participantId ? value : (splits[participant.id] || 0);
        newShares[participant.id] = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
      });
      setShares(newShares);
      setCustomShares(newShares);
      
      // Convert amounts to percentages
      const newPercentages: { [key: number]: number } = {};
      participants.forEach(participant => {
        const amount = participant.id === participantId ? value : (splits[participant.id] || 0);
        newPercentages[participant.id] = cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
      });
      setPercentages(newPercentages);
      setCustomPercentages(newPercentages);
    }
  };

  const handleShareChange = (participantId: number, share: string) => {
    const value = Math.max(1, Math.round(parseFloat(share) || 1));
    const cost = parseFloat(formData.cost) || 0;
    
    // Update shares
    setShares(prev => ({
      ...prev,
      [participantId]: value
    }));
    
    // Update custom shares
    setCustomShares(prev => ({
      ...prev,
      [participantId]: value
    }));
    
    // Recalculate amounts from shares
    const newShares = { ...shares, [participantId]: value };
    const newAmounts = calculateAmountsFromShares(newShares, cost);
    setSplits(newAmounts);
    setCustomSplits(newAmounts);
    
    // Update percentages to reflect the new amounts
    const newPercentages: { [key: number]: number } = {};
    participants.forEach(participant => {
      const amount = newAmounts[participant.id] || 0;
      newPercentages[participant.id] = cost > 0 ? roundToTwoDecimals((amount / cost) * 100) : 0;
    });
    setPercentages(newPercentages);
    setCustomPercentages(newPercentages);
  };

  const handlePercentageChange = (participantId: number, percentage: string) => {
    const value = Math.max(0, Math.min(100, roundToTwoDecimals(parseFloat(percentage) || 0)));
    const cost = parseFloat(formData.cost) || 0;
    
    // Update percentages
    setPercentages(prev => ({
      ...prev,
      [participantId]: value
    }));
    
    // Update custom percentages
    setCustomPercentages(prev => ({
      ...prev,
      [participantId]: value
    }));
    
    // Recalculate amounts from percentages
    const newPercentages = { ...percentages, [participantId]: value };
    const newAmounts = calculateAmountsFromPercentages(newPercentages, cost);
    setSplits(newAmounts);
    setCustomSplits(newAmounts);
    
    // Update shares to reflect the new amounts
    const equalAmount = participants.length > 0 ? cost / participants.length : 0;
    const newShares: { [key: number]: number } = {};
    participants.forEach(participant => {
      const amount = newAmounts[participant.id] || 0;
      newShares[participant.id] = equalAmount > 0 ? Math.max(1, Math.round(amount / equalAmount)) : 1;
    });
    setShares(newShares);
    setCustomShares(newShares);
  };

  const validateSplits = () => {
    const totalCost = parseFloat(formData.cost) || 0;
    const totalSplits = Object.values(splits).reduce((sum, amount) => sum + amount, 0);
    
    if (formData.split_type === 'percentage') {
      const totalPercentage = Object.values(percentages).reduce((sum, pct) => sum + pct, 0);
      return Math.abs(100 - totalPercentage) < 0.01; // Must sum to 100%
    }
    
    return Math.abs(totalCost - totalSplits) < 0.01; // Allow small floating point differences
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = formData.name.trim();
    const costValue = formData.cost.trim();
    const nextErrors: FormErrors = {};

    if (!trimmedName) {
      nextErrors.name = 'Please enter a title for this expense.';
    }

    if (!costValue) {
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

    if (!validateSplits()) {
      toast.error('Split amounts must equal the total cost');
      return;
    }

    try {
      setSubmitting(true);
      setErrors({});
      
      const expense: Expense = {
        id: 0, // Will be set by backend
        name: formData.name,
        cost: parseFloat(formData.cost),
        emoji: formData.emoji,
        payer_id: formData.payer_id,
        split_type: formData.split_type,
        split_ids: [], // Will be set by backend
        group_id: group!.id
      };

      // Ensure all current group members are included in splits
      const allSplits: { [key: number]: number } = { ...splits };
      
      // Add any missing participants
      participants.forEach(participant => {
        if (!(participant.id in allSplits)) {
          allSplits[participant.id] = 0;
        }
      });
      
      // If equal split, recalculate for all participants
      if (formData.split_type === 'equal') {
        const cost = parseFloat(formData.cost) || 0;
        const equalAmount = participants.length > 0 ? cost / participants.length : 0;
        participants.forEach(participant => {
          allSplits[participant.id] = equalAmount;
        });
      }
      
      const splitArray: Split[] = Object.entries(allSplits)
        .filter(([_, amount]) => formData.split_type === 'equal' || amount > 0)
        .map(([participantId, amount]) => ({
          split_id: 0, // Will be set by backend
          group_id: group!.id,
          expense_id: 0, // Will be set by backend
          participant_id: parseInt(participantId),
          split_amount: amount
        }));

      await createExpense({
        expense,
        splits: splitArray
      });

      toast.success('Expense added successfully!');
      navigate(`/group/${urlSlug}`);
    } catch (error) {
      toast.error('Failed to add expense');
      console.error('Error adding expense:', error);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!loading && !group && urlSlug) {
      navigate(`/group/${urlSlug}`);
    }
  }, [loading, group, urlSlug, navigate]);

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
    return null;
  }

  const totalAssigned = Object.values(splits).reduce((sum, amount) => sum + amount, 0);
  const remainingAmount = (parseFloat(formData.cost) || 0) - totalAssigned;

  return (
    <>
      <div className="page">
        <div className="body">
        <div className="content-section">

          {/* Header */}
            <div className="modal-header">
              <h2>Add an expense</h2>
              <Link
                to={`/group/${urlSlug}`}
                aria-label="Close add an expense"
                className="is-black"
              >
                <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} className="is-black"/>
              </Link>
            </div>

          {/* Form */}
            <form onSubmit={handleSubmit} className="form" id="add-expense" noValidate>
              
              {/* Basic Info */}
                <div className="h-flex align-center gap-8px">
                  <div>
                    <button
                      type="button"
                      id="emoji"
                      className="emoji-input"
                      onClick={openEmojiPicker}
                      aria-label="Choose an emoji for the expense"
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
                        aria-describedby={nameHasError ? 'add-expense-name-error' : undefined}
                        required
                      />
                    </div>
                    {nameHasError && (
                      <p className="form-error" id="add-expense-name-error" role="alert">
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
                      <p className="p2 is-black">
                        {group.currency}
                      </p>
                      <input
                        type="number"
                        id="cost"
                        value={formData.cost}
                        onChange={(e) => handleInputChange('cost', e.target.value)}
                        className="form-input"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        aria-invalid={costHasError}
                        aria-describedby={costHasError ? 'add-expense-cost-error' : undefined}
                        required
                      />
                    </div>
                  {costHasError && (
                    <p className="form-error" id="add-expense-cost-error" role="alert">
                      {errors.cost}
                    </p>
                  )}
                </div>

                <div className="form-item">
                  <label htmlFor="payer" className="form-label">
                    Paid by
                  </label>
                  <div className={payerContainerClasses.join(' ')}>
                    <select
                      id="payer"
                      value={formData.payer_id}
                      onChange={(e) => handleInputChange('payer_id', parseInt(e.target.value))}
                      className="form-input"
                      aria-invalid={payerHasError}
                      aria-describedby={payerHasError ? 'add-expense-payer-error' : undefined}
                      required
                    >
                    <option value={0} disabled hidden>Select payer</option>
                      {participants.map(participant => (
                        <option key={participant.id} value={participant.id}>
                          {participant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {payerHasError && (
                    <p className="form-error" id="add-expense-payer-error" role="alert">
                      {errors.payer}
                    </p>
                  )}
                </div>

              {/* Split Type */}
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

                  {/* Split Details */}
                    {participants.map(participant => (
                      <div key={participant.id} className="split-breakdown-participant-container">
                        <div className="split-breakdown-details-container">
                          <div className="checkbox">
                            A
                          </div>
                          <div className="split-breakdown-participant-details">
                            <p>
                              {participant.name}
                            </p>
                            <p className="p2">{group.currency}{(splits[participant.id] ?? 0).toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Equal Input */}
                          {formData.split_type === 'equal' && (
                            <div className="split-breakdown-even-split-container">
                              <span>
                                {group.currency}{(splits[participant.id] ?? 0).toFixed(2)}
                              </span>
                            </div>
                          )}

                        {/* Amount Input */}
                          {formData.split_type === 'amount' && (
                            <div className="split-breakdown-amount-split-container">
                              <p>
                                {group.currency}
                              </p>
                              <input
                                type="number"
                                value={(splits[participant.id] ?? 0).toFixed(2)}
                                onChange={(e) => handleSplitChange(participant.id, e.target.value)}
                                className="form-input"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          )}
                      
                        {/* Shares Input */}
                          {formData.split_type === 'shares' && (
                            <div className="share-adjust">
                              <button
                                type="button"
                                className="share-adjust__button"
                                onClick={() => adjustShare(participant.id, -1)}
                                disabled={(shares[participant.id] || 1) <= 1}
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
                                style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                              />
                              <button
                                type="button"
                                className="share-adjust__button"
                                onClick={() => adjustShare(participant.id, 1)}
                                aria-label={`Increase shares for ${participant.name}`}
                              >
                                <FontAwesomeIcon icon={faPlus} />
                              </button>
                            </div>
                          )}
                      
                        {/* Percentage Input */}
                          {formData.split_type === 'percentage' && (
                            <div className="split-breakdown-amount-split-container">
                                <input
                                  type="number"
                                  value={(percentages[participant.id] ?? 0).toFixed(2)}
                                  onChange={(e) => handlePercentageChange(participant.id, e.target.value)}
                                  className="form-input right-align-text"
                                  min="0"
                                  max="99.99"
                                  step="0.01"
                                  style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                                />
                                <p>%</p>
                            </div>
                          )}
                      </div>
                    ))}
              
                  {/* Summary */}
                  
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
                form="add-expense"
                disabled={submitting || !validateSplits()} 
                className="btn has-full-width"
              >
                Add
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

export default AddExpense;
