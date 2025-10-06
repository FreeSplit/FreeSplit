import React, { useCallback, useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { Group, Participant } from '../services/api';
import { addParticipant } from '../services/api';
import toast from 'react-hot-toast';
import '../styles/participants-form.css';

type AddMemberModalProps = {
  group: Group;
  onClose: () => void;
  onMemberAdded?: (participant: Participant) => void;
};

const AddMemberModal: React.FC<AddMemberModalProps> = ({ group, onClose, onMemberAdded }) => {
  const [pendingMembers, setPendingMembers] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<number | null>(null);

  // Auto-focus the input when modal opens and clear timers when unmounted
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }

    return () => {
      if (errorTimerRef.current) {
        window.clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    };
  }, []);

  const normalizeMembers = useCallback((list: string[]) => {
    const seen = new Set<string>();
    return list
      .map((name) => name.replace(/,+/g, ' ').trim())
      .filter(Boolean)
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }, []);

  const showInputError = useCallback((message: string) => {
    setInputError(message);
    if (errorTimerRef.current) {
      window.clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = window.setTimeout(() => {
      setInputError(null);
      errorTimerRef.current = null;
    }, 2000);
  }, []);

  const handleMembersChange = useCallback((list: string[]) => {
    const normalized = normalizeMembers(list);
    setPendingMembers(normalized);
    if (normalized.length) {
      setInputError(null);
    }
  }, [normalizeMembers]);

  const addMembersFromString = useCallback((raw: string) => {
    const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (!items.length) {
      return;
    }

    const currentKeys = new Set(pendingMembers.map((name) => name.toLowerCase()));
    const addedKeys = new Set<string>();
    const uniqueItems: string[] = [];
    let foundDuplicate = false;

    items.forEach((item) => {
      const normalized = item.replace(/,+/g, ' ').trim();
      if (!normalized) {
        return;
      }
      const key = normalized.toLowerCase();
      if (currentKeys.has(key) || addedKeys.has(key)) {
        foundDuplicate = true;
        return;
      }
      addedKeys.add(key);
      uniqueItems.push(normalized);
    });

    if (uniqueItems.length) {
      handleMembersChange([...pendingMembers, ...uniqueItems]);
    }

    if (foundDuplicate) {
      showInputError('Members must have a unique name.');
    }
  }, [pendingMembers, handleMembersChange, showInputError]);

  const removeMemberAt = useCallback((index: number) => {
    handleMembersChange(pendingMembers.filter((_, i) => i !== index));
    inputRef.current?.focus();
  }, [pendingMembers, handleMembersChange]);

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === ',' || event.key === 'Enter') {
      event.preventDefault();
      if (inputValue.trim()) {
        addMembersFromString(inputValue);
        setInputValue('');
      }
    } else if (event.key === 'Backspace' && inputValue === '' && pendingMembers.length) {
      event.preventDefault();
      removeMemberAt(pendingMembers.length - 1);
    }
  }, [inputValue, pendingMembers.length, addMembersFromString, removeMemberAt]);

  const handleInputPaste = useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (text.includes(',')) {
      event.preventDefault();
      addMembersFromString(text);
      setInputValue('');
    }
  }, [addMembersFromString]);

  const handleInputBlur = useCallback(() => {
    if (inputValue.trim()) {
      addMembersFromString(inputValue);
      setInputValue('');
    }
  }, [inputValue, addMembersFromString]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const containerClasses = ['form-input-container'];
  const chipsInputClasses = ['form-input', 'chips-input'];
  if (inputError) {
    containerClasses.push('is-error');
    chipsInputClasses.push('is-error');
  } else if (pendingMembers.length) {
    containerClasses.push('is-complete');
    chipsInputClasses.push('is-complete');
  }

  const isSubmitDisabled = submitting || (!pendingMembers.length && !inputValue.trim());

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedInput = inputValue.trim();
    let membersToAdd = pendingMembers;

    if (trimmedInput) {
      const combined = normalizeMembers([...pendingMembers, trimmedInput]);
      if (combined.length === pendingMembers.length) {
        showInputError('Members must have a unique name.');
      }
      membersToAdd = combined;
      setPendingMembers(combined);
      setInputValue('');
    }

    if (!membersToAdd.length) {
      showInputError('Please enter at least one member.');
      return;
    }

    try {
      setSubmitting(true);
      const createdParticipants: Participant[] = [];

      for (const name of membersToAdd) {
        // eslint-disable-next-line no-await-in-loop
        const participant = await addParticipant({
          name,
          group_id: group.id,
        });
        createdParticipants.push(participant);
        onMemberAdded?.(participant);
      }

      const successMessage = createdParticipants.length > 1
        ? `Added ${createdParticipants.length} members successfully.`
        : 'Member added successfully';
      toast.success(successMessage);
      setPendingMembers([]);
      setInputValue('');
      onClose();
    } catch (error) {
      toast.error('Failed to add member(s)');
      console.error('Error adding member(s):', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className="card">
        <div className="modal-header">
          <h2>Add new members</h2>
          <button className="icon-link-container w-hover" type="button" onClick={onClose} aria-label="Close add member modal">
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-item" id="new-member">
          <div className={containerClasses.join(' ')}>
            <div
              className={chipsInputClasses.join(' ')}
              onClick={() => inputRef.current?.focus()}
              role="group"
              aria-label="Members to add"
            >
              {pendingMembers.map((name, index) => (
                <span key={name.toLowerCase()} className="chip" aria-label={name}>
                  <span className="chip-text">{name}</span>
                  <button
                    type="button"
                    className="chip-remove"
                    aria-label={`Remove ${name}`}
                    onClick={() => removeMemberAt(index)}
                    disabled={submitting}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                id="add-member-input"
                className="chips-input__control"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleInputKeyDown}
                onPaste={handleInputPaste}
                onBlur={handleInputBlur}
                placeholder={pendingMembers.length === 0 ? 'Use enter or comma to separate names.' : ''}
                aria-label="Add member"
                aria-invalid={Boolean(inputError)}
                disabled={submitting}
              />
            </div>
          </div>
          {inputError && (
            <p className="form-error" role="alert">
              {inputError}
            </p>
          )}
        </form>
        <div className="h-flex align-center gap-16px has-full-width">
          <button type="button" className="btn--secondary has-full-width" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            className={`btn has-full-width${isSubmitDisabled ? ' is-disabled' : ''}`}
            form="new-member"
            disabled={isSubmitDisabled}
          >
            {submitting ? 'Adding...' : pendingMembers.length > 1 ? 'Add members' : 'Add member'}
          </button>
        </div> 
      </div>
    </div>
  );
};

export default AddMemberModal;
