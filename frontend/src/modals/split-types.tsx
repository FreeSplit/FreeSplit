import React, { useCallback, } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

type SplitTypeProps = {
  onClose: () => void;
};

const SplitTypeModal: React.FC<SplitTypeProps> = ({ onClose }) => {

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
          <h2>Split types</h2>
          <button className="icon-link-container w-hover" type="button" onClick={onClose} aria-label="Close share modal">
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} aria-hidden="true" />
          </button>
        </div>
        <div className="v-flex gap-8px">
          <p className="has-full-width"><span className="is-bold">Equal:</span> everyone pays the same amount.</p>
          <div className="light-divider" />
          <p className="has-full-width"><span className="is-bold">Amount:</span> you enter exactly how much each person pays.</p>
          <div className="light-divider" />
          <p className="has-full-width"><span className="is-bold">Shares:</span> the cost is divided proportionally based on each person's number of shares.</p>
          <div className="light-divider" />
          <p className="has-full-width"><span className="is-bold">Percentage:</span> you assign what % of the total cost each person covers.</p>
        </div>
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

export default SplitTypeModal;
