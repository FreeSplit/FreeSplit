import React, { useCallback, } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import SimplifyAnimation from '../animations/simplify-animation';

type SimplifyProps = {
  onClose: () => void;
};

const SimplifyModal: React.FC<SimplifyProps> = ({ onClose }) => {

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className="card">
          <div className="modal-header">
            <h2>How we simplify</h2>
            <button type="button" onClick={onClose} aria-label="Close share modal">
              <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} aria-hidden="true" />
            </button>
          </div>
        < SimplifyAnimation />
        <p className="has-full-width">FreeSplit calculates the smallest number of transactions required to ensure everyone is repaid, so you can settle up in no time.</p>
        <button
          type="button"
          className="btn--secondary has-full-width"
          onClick={onClose}
          aria-label="Close share modal"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default SimplifyModal;
