import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShareNodes } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router-dom';
import { getGroup, Group } from '../services/api';
import ShareLink from '../modals/share-link';

const Header: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const [isShareOpen, setShareOpen] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);

  useEffect(() => {
    const loadGroup = async () => {
      if (!urlSlug) return;
      try {
        const response = await getGroup(urlSlug);
        setGroup(response.group);
      } catch (error) {
        console.error('Failed to load group for header', error);
        setGroup(null);
      }
    };

    loadGroup();
  }, [urlSlug]);

  return (
    <div className="header">
      <p className="is-bold">{group?.name ?? ''}</p>
      <button
        className="a"
        onClick={() => setShareOpen(true)}
        aria-label="Share group"
      >
        <FontAwesomeIcon icon={faShareNodes} className="icon" style={{ fontSize: 16 }} aria-hidden="true" />
      </button>

      {isShareOpen && group && (
        <ShareLink group={group} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
};

export default Header;
