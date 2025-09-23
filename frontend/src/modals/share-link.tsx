import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { Group } from '../services/api';
import toast from 'react-hot-toast';

type ShareLinkProps = {
  group: Group;
  onClose: () => void;
};

const ShareModal: React.FC<ShareLinkProps> = ({ group, onClose }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const shareUrl = window.location.href;

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    toast.success('URL copied');

    setCopySuccess(true);
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopySuccess(false);
      resetTimerRef.current = null;
    }, 2000);
  }, []);

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
          <h2>Share {group.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close share modal">
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} aria-hidden="true" />
          </button>
        </div>
        <p>Share the link below with your friends to invite them to the group.</p>
        <div
          className="link-share-container"
          title={window.location.href}
          onClick={handleCopy}
        >
          <p>{window.location.href}</p>
        </div>
        <button
          type="button"
          className="btn has-full-width"
          onClick={handleCopy}
        >
          Copy link
        </button>
      </div>
    </div>
  );
};

export default ShareModal;
