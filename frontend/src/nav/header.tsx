import React, { useEffect, useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faHouse, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { getGroup, Group } from '../services/api';
import ShareLink from '../modals/share-link';
import IconLogo from '../images/FreeSplit-icon.svg';
import { localStorageService, UserGroup } from '../services/localStorage';

const Header: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isShareOpen, setShareOpen] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const truncateGroupName = (name: string) => {
    if (name.length <= 15) {
      return name;
    }

    return `${name.slice(0, 15)}...`;
  };

  const getGroupDisplayName = (slug: string | null | undefined) => {
    if (!slug) {
      return 'Select a group';
    }

    if (slug === urlSlug && group?.name) {
      return group.name;
    }

    return groupNames[slug] ?? 'Loading...';
  };

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

  useEffect(() => {
    const loadUserGroups = async () => {
      try {
        const groups = await localStorageService.getUserGroups();
        setUserGroups(groups);
      } catch (error) {
        console.error('Failed to load user groups for header', error);
        setUserGroups([]);
      }
    };

    loadUserGroups();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const populateGroupNames = async () => {
      try {
        const entries = await Promise.all(
          userGroups.map(async (userGroup) => {
            try {
              const response = await getGroup(userGroup.groupUrlSlug);
              return [userGroup.groupUrlSlug, response.group.name] as const;
            } catch (error) {
              console.error('Failed to load group name for header dropdown', error);
              return [userGroup.groupUrlSlug, userGroup.groupUrlSlug] as const;
            }
          })
        );

        if (!isCancelled) {
          setGroupNames(Object.fromEntries(entries));
        }
      } catch (error) {
        console.error('Unexpected error loading group names for header dropdown', error);
      }
    };

    populateGroupNames();

    return () => {
      isCancelled = true;
    };
  }, [userGroups]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleGroupSelect = (groupUrlSlug: string) => {
    setDropdownOpen(false);
    if (groupUrlSlug === urlSlug) {
      return;
    }

    let targetPath = `/groups/${groupUrlSlug}`;
    const pathname = location.pathname;

    if (pathname.startsWith('/groups/')) {
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length > 1) {
        const trailingSegments = segments.slice(2);
        if (trailingSegments.length > 0) {
          targetPath = `/groups/${groupUrlSlug}/${trailingSegments.join('/')}`;
        }
      }
    }

    const search = location.search || '';
    const hash = location.hash || '';
    navigate(`${targetPath}${search}${hash}`);
  };

  return (
    <div className="header">
      <Link to="/" className="icon-link-container">
        <FontAwesomeIcon className="has-color-white" icon={faHouse} style={{ fontSize: 20 }} aria-hidden="true" />
      </Link>
      <div className="relative" ref={dropdownRef}>
        <button
          className="dropdown-button header-dropdown"
          style={{ position: 'relative', zIndex: 2 }}
          onClick={() => setDropdownOpen((prev) => !prev)}
          title="Switch groups"
        >
          <h1 className="h2">{truncateGroupName(getGroupDisplayName(urlSlug))}</h1>
          <FontAwesomeIcon icon={faChevronDown} />
        </button>
        {isDropdownOpen && (
          <div
            className="dropdown-container left"
          >
            <div className="list">
              {userGroups.map((userGroup) => (
                <button
                  key={userGroup.groupUrlSlug}
                  className="item"
                  style={{
                    backgroundColor:
                      userGroup.groupUrlSlug === urlSlug
                        ? 'var(--color-primary-darkest)'
                        : undefined
                  }}
                  onClick={() => handleGroupSelect(userGroup.groupUrlSlug)}
                >
                  {truncateGroupName(getGroupDisplayName(userGroup.groupUrlSlug))}
                </button>
              ))}
              <div className="dropdown-divider" />
              <Link
                to="/groups/"
                className="item"
                onClick={() => setDropdownOpen(false)}
              >
                View my groups
              </Link>
              <Link
                to="/create-a-group/"
                className="item"
                onClick={() => setDropdownOpen(false)}
              >
                Create a group
              </Link>
            </div>
          </div>
        )}
      </div>
      <button
        className="icon-link-container"
        onClick={() => setShareOpen(true)}
        aria-label="Share group"
      >
        <FontAwesomeIcon className="has-color-white" icon={faLink} style={{ fontSize: 20 }} aria-hidden="true" />
      </button>

      {isShareOpen && group && (
        <ShareLink group={group} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
};

export default Header;
