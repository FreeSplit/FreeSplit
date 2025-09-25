import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createGroup } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faUserPlus } from '@fortawesome/free-solid-svg-icons'
import '../styles/participants-form.css';

const CreateGroup: React.FC = () => {
  const navigate = useNavigate();
  type FormErrors = {
    name?: string;
    currency?: string;
    participants?: string;
  };

  const [formData, setFormData] = useState<{ name: string; currency: string; participants: string[] }>({
    name: '',
    currency: '',
    participants: [] // Managed by chips input
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const participantInputRef = useRef<HTMLInputElement | null>(null);
  const [participantValue, setParticipantValue] = useState('');
  const [participantError, setParticipantError] = useState<string | null>(null);
  const participantErrorTimerRef = useRef<number | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  // Derived form completeness state
  const currentValidParticipants = formData.participants.filter(name => name.trim() !== '');
  const isFormComplete =
    formData.name.trim() !== '' &&
    formData.currency.trim() !== '' &&
    currentValidParticipants.length >= 2;
  const hasEnoughParticipants = currentValidParticipants.length >= 2;
  const isButtonDisabled = !isFormComplete;
  const nameHasError = Boolean(errors.name);
  const currencyHasError = Boolean(errors.currency);
  const participantsHaveError = Boolean(errors.participants) || Boolean(participantError);

  const nameContainerClasses = ['form-input-container'];
  if (nameHasError) {
    nameContainerClasses.push('is-error');
  } else if (formData.name.trim()) {
    nameContainerClasses.push('is-complete');
  }

  const currencyContainerClasses = ['form-input-container'];
  if (currencyHasError) {
    currencyContainerClasses.push('is-error');
  } else if (formData.currency.trim()) {
    currencyContainerClasses.push('is-complete');
  }

  const participantContainerClasses = ['form-input-container'];
  if (participantsHaveError) {
    participantContainerClasses.push('is-error');
  } else if (hasEnoughParticipants) {
    participantContainerClasses.push('is-complete');
  }

  const nameInputClasses = ['form-input'];

  const currencyInputClasses = ['form-input'];

  const participantInputClasses = ['form-input', 'chips-input'];
  if (participantsHaveError) {
    participantInputClasses.push('is-error');
  } else if (hasEnoughParticipants) {
    participantInputClasses.push('is-complete');
  }

  const normalizeParticipants = useCallback((list: string[]) => {
    const seen = new Set<string>();
    return list
      .map((s) => s.replace(/,+/g, ' ').trim())
      .filter(Boolean)
      .filter((s) => {
        const key = s.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, []);

  useEffect(() => {
    return () => {
      if (participantErrorTimerRef.current) {
        window.clearTimeout(participantErrorTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let rafId = 0;

    const updateFromViewport = () => {
      if (!window.visualViewport) {
        setKeyboardOffset(0);
        return;
      }
      const { height, offsetTop } = window.visualViewport;
      const bottomInset = Math.max(0, window.innerHeight - (height + offsetTop));
      setKeyboardOffset(bottomInset);
    };

    const scheduleUpdate = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(updateFromViewport);
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', scheduleUpdate);
      vv.addEventListener('scroll', scheduleUpdate);
      scheduleUpdate();
    }

    let removeVirtualKeyboardListener: (() => void) | null = null;
    const maybeVirtualKeyboard = (navigator as any).virtualKeyboard;
    if (maybeVirtualKeyboard && 'overlaysContent' in maybeVirtualKeyboard) {
      try {
        maybeVirtualKeyboard.overlaysContent = true;
      } catch (error) {
        // Ignore: overlaysContent may throw on unsupported platforms
      }

      const handleGeometryChange = () => {
        const rect = maybeVirtualKeyboard.boundingRect;
        if (rect && rect.height > 0) {
          const inset = Math.max(0, window.innerHeight - rect.top);
          setKeyboardOffset(inset);
        } else {
          updateFromViewport();
        }
      };

      if (typeof maybeVirtualKeyboard.addEventListener === 'function') {
        maybeVirtualKeyboard.addEventListener('geometrychange', handleGeometryChange);
        removeVirtualKeyboardListener = () => {
          maybeVirtualKeyboard.removeEventListener('geometrychange', handleGeometryChange);
          try {
            maybeVirtualKeyboard.overlaysContent = false;
          } catch (error) {
            // Ignore: reset may fail on unsupported platforms
          }
        };
      }
    }

    const handleWindowResize = () => scheduleUpdate();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', scheduleUpdate);
        vv.removeEventListener('scroll', scheduleUpdate);
      }
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', handleWindowResize);
      if (removeVirtualKeyboardListener) {
        removeVirtualKeyboardListener();
      }
    };
  }, []);

  const showParticipantError = useCallback((message: string) => {
    setParticipantError(message);
    if (participantErrorTimerRef.current) {
      window.clearTimeout(participantErrorTimerRef.current);
    }
    participantErrorTimerRef.current = window.setTimeout(() => {
      setParticipantError(null);
      participantErrorTimerRef.current = null;
    }, 2000);
  }, []);

  const handleInputChange = useCallback((field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    setErrors(prev => {
      if (field === 'name' && typeof value === 'string') {
        return value.trim() ? { ...prev, name: undefined } : prev;
      }
      if (field === 'currency' && typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return prev;
        const currencyFormat = /^([$€£¥]|[A-Za-z]{2,3})$/;
        return currencyFormat.test(trimmed) ? { ...prev, currency: undefined } : prev;
      }
      return prev;
    });
  }, []);

  const handleParticipantsChange = useCallback((list: string[]) => {
    const normalized = normalizeParticipants(list);
    handleInputChange('participants', normalized);
    const validNames = normalized.filter(name => name.trim() !== '');
    setErrors(prev => (validNames.length >= 2 ? { ...prev, participants: undefined } : prev));
  }, [handleInputChange, normalizeParticipants]);

  const addParticipantsFromString = useCallback((raw: string) => {
    const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;

    const currentKeys = new Set(formData.participants.map((n) => n.toLowerCase()));
    const addedKeys = new Set<string>();
    const uniqueItems: string[] = [];
    let foundDuplicate = false;

    items.forEach((item) => {
      const normalized = item.replace(/,+/g, ' ').trim();
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (currentKeys.has(key) || addedKeys.has(key)) {
        foundDuplicate = true;
        return;
      }
      addedKeys.add(key);
      uniqueItems.push(normalized);
    });

    if (uniqueItems.length) {
      const nextList = normalizeParticipants([...formData.participants, ...uniqueItems]);
      handleParticipantsChange(nextList);
      setParticipantError(null);
    }

    if (foundDuplicate) {
      showParticipantError('Participants must have a unique name.');
    }
  }, [formData.participants, handleParticipantsChange, normalizeParticipants, showParticipantError]);

  const removeParticipantAt = useCallback((index: number) => {
    const nextList = formData.participants.filter((_, i) => i !== index);
    handleParticipantsChange(nextList);
    participantInputRef.current?.focus();
  }, [formData.participants, handleParticipantsChange]);

  const handleParticipantKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      if (participantValue.trim()) {
        addParticipantsFromString(participantValue);
        setParticipantValue('');
      }
    } else if (e.key === 'Backspace' && participantValue === '' && formData.participants.length) {
      e.preventDefault();
      removeParticipantAt(formData.participants.length - 1);
    }
  }, [participantValue, addParticipantsFromString, formData.participants, removeParticipantAt]);

  const handleParticipantPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.includes(',')) {
      e.preventDefault();
      addParticipantsFromString(text);
      setParticipantValue('');
    }
  }, [addParticipantsFromString]);

  const handleParticipantBlur = useCallback(() => {
    if (participantValue.trim()) {
      addParticipantsFromString(participantValue);
      setParticipantValue('');
    }
  }, [participantValue, addParticipantsFromString]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = formData.name.trim();
    const trimmedCurrency = formData.currency.trim();
    const validParticipants = formData.participants.filter(name => name.trim() !== '');

    const nextErrors: FormErrors = {};
    const currencyFormat = /^([$€£¥]|[A-Za-z]{2,3})$/;

    if (!trimmedName) {
      nextErrors.name = 'Please enter a group name.';
    }

    if (!trimmedCurrency) {
      nextErrors.currency = 'Please enter a currency.';
    } else if (!currencyFormat.test(trimmedCurrency)) {
      nextErrors.currency = 'Use a symbol or 2-3 letter currency code.';
    }

    if (validParticipants.length < 2) {
      nextErrors.participants = 'Please add at least two participants.';
    }

    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    try {
      const response = await createGroup({
        name: formData.name,
        currency: formData.currency,
        participant_names: validParticipants
      });

      setErrors({});
      navigate(`/group/${response.url_slug}`);
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  return (
    <div className="page">
      <div className="body">
        <div className="content-section">
          <div className="modal-header">
            <h2>Create a group</h2>
            <Link
              to="/"
              aria-label="Close create a group"
              className="is-black"
            >
              <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} className="is-black"/>
            </Link>
          </div>
          <form onSubmit={handleSubmit} className="form" id="create-group-form" noValidate>
            <div className="form-item">
              <label htmlFor="groupName" className="form-label">
                Group Name
              </label>
              <div className={nameContainerClasses.join(' ')}>
                <input
                  type="text"
                  id="groupName"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={nameInputClasses.join(' ')}
                  aria-invalid={nameHasError}
                  placeholder="Weekend Trip"
                />
              </div>
              {nameHasError && (
                <p className="form-error" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="form-item">
              <label htmlFor="currency" className="form-label">
                Currency
              </label>
              <div className={currencyContainerClasses.join(' ')}>
                <input
                  type="text"
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className={currencyInputClasses.join(' ')}
                  aria-invalid={currencyHasError}
                  maxLength={3}
                  pattern="[$€£¥]|[A-Za-z]{2,3}"
                  placeholder="$, kr, or USD"
                />
              </div>
              {currencyHasError && (
                <p className="form-error" role="alert">
                  {errors.currency}
                </p>
              )}
            </div>

            <div className="form-item">
              <label className="form-label">Participants</label>
              <div className={participantContainerClasses.join(' ')}>
              <div
                className={participantInputClasses.join(' ')}
                onClick={() => participantInputRef.current?.focus()}
                role="group"
                aria-label="Participants"
              >
                {formData.participants.map((name, index) => (
                  <span key={name.toLowerCase()} className="chip" aria-label={name}>
                    <span className="chip-text">{name}</span>
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeParticipantAt(index)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  ref={participantInputRef}
                  className="chips-input__control"
                  value={participantValue}
                  onChange={(e) => setParticipantValue(e.target.value)}
                  onKeyDown={handleParticipantKeyDown}
                  onPaste={handleParticipantPaste}
                  onBlur={handleParticipantBlur}
                  placeholder={formData.participants.length === 0 ? 'Use enter to separate names.' : ''}
                  aria-label="Add participant"
                  aria-invalid={participantsHaveError}
                />
              </div>
              </div>
              {participantError && (
                <p className="form-error" role="alert">
                  {participantError}
                </p>
              )}
              {errors.participants && (
                <p className="form-error" role="alert">
                  {errors.participants}
                </p>
              )}
            </div>
            
  
          </form>
        </div>
        <footer
          className="has-gradient-bg keyboard-aware-footer"
          style={keyboardOffset > 0 ? { transform: `translate3d(0, -${Math.max(0, keyboardOffset - 16)}px, 0)` } : undefined}
        >
          <button
            type="submit"
            className={`btn has-full-width${isButtonDisabled ? ' is-disabled' : ''}`}
            form="create-group-form"
            aria-disabled={isButtonDisabled}
          >
            <span>Create group</span>
            <FontAwesomeIcon icon={faUserPlus} aria-hidden="true"/>
          </button>
        </footer>
      </div>
    </div>   
  );
};

export default CreateGroup;
