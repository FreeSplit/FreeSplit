import React, { useCallback, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { Group, Participant } from '../services/api';
import { addParticipant } from '../services/api';
import toast from 'react-hot-toast';

type AddMemberModalProps = {
  group: Group;
  onClose: () => void;
  onMemberAdded?: (participant: Participant) => void;
};

const AddMemberModal: React.FC<AddMemberModalProps> = ({ group, onClose, onMemberAdded }) => {
  const [newMemberName, setNewMemberName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newMemberName.trim();
    if (!trimmedName) {
      toast.error('Please enter a name');
      return;
    }

    try {
      setSubmitting(true);
      const participant = await addParticipant({
        name: trimmedName,
        group_id: group.id,
      });
      toast.success('Member added successfully');
      onMemberAdded?.(participant);
      onClose();
    } catch (error) {
      toast.error('Failed to add member');
      console.error('Error adding member:', error);
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
          <h2>Add new member</h2>
          <button type="button" onClick={onClose} aria-label="Close add member modal">
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-item" id="new-member">
          <div className="form-input-container">
            <input
              id="new-member-name"
              type="text"
              value={newMemberName}
              onChange={(event) => setNewMemberName(event.target.value)}
              className="form-input"
              placeholder="Enter member name"
              disabled={submitting}
              required
            />
          </div>
        </form>
        <div className="h-flex align-center gap-16px has-full-width">
          <button type="button" className="btn--secondary has-full-width" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn has-full-width" form="new-member" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add member'}
          </button>
        </div> 
      </div>
    </div>
  );
};

export default AddMemberModal;
