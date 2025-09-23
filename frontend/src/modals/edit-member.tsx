import React, { useCallback, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { Participant } from '../services/api';
import { updateParticipant, deleteParticipant } from '../services/api';
import toast from 'react-hot-toast';

type EditMemberModalProps = {
  participant: Participant;
  onClose: () => void;
  onMemberUpdated?: (participant: Participant) => void;
  onMemberDeleted?: (participantId: number) => void;
};

const EditMemberModal: React.FC<EditMemberModalProps> = ({ participant, onClose, onMemberUpdated, onMemberDeleted }) => {
  const [name, setName] = useState(participant.name);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Please enter a name');
      return;
    }

    try {
      setSubmitting(true);
      const updated = await updateParticipant({
        name: trimmedName,
        participant_id: participant.id,
      });
      toast.success('Member updated successfully');
      onMemberUpdated?.(updated);
      onClose();
    } catch (error) {
      toast.error('Failed to update member');
      console.error('Error updating member:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${participant.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      await deleteParticipant(participant.id);
      toast.success('Member deleted');
      onMemberDeleted?.(participant.id);
      onClose();
    } catch (error) {
      toast.error('Failed to delete member');
      console.error('Error deleting member:', error);
    } finally {
      setDeleting(false);
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
          <h2>Edit member</h2>
          <button type="button" onClick={onClose} aria-label="Close edit member modal">
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form" id="edit-member">
          <div className="form-input-container">
            <input
              id="edit-member-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="form-input"
              placeholder="Enter member name"
              disabled={submitting || deleting}
              required
            />
          </div>
        </form>
        <button
          type="button"
          className="h-flex align-center gap-4px link text-is-red"
          onClick={handleDelete}
          disabled={submitting || deleting}
        >
          <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
          {deleting ? 'Deleting…' : 'Delete member'}
        </button>
          <div className="h-flex align-center gap-16px has-full-width">
            <button
              type="button"
              className="btn--secondary has-full-width"
              onClick={onClose}
              disabled={submitting || deleting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-member"
              className="btn has-full-width"
              disabled={submitting || deleting}
            >
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
      </div>
    </div>
  );
};

export default EditMemberModal;
