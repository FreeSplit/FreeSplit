import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBillTransfer, faReceipt, faUsers } from '@fortawesome/free-solid-svg-icons';

const NavBar: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const buildPath = (suffix: string) => {
    if (!urlSlug) {
      return suffix ? `/${suffix.replace(/^\//, '')}` : '/';
    }
    const base = `/groups/${urlSlug}`;
    return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
  };
  const items = [
    { path: buildPath(''), label: 'Expenses', icon: faReceipt },
    { path: buildPath('debts'), label: 'Debts', icon: faMoneyBillTransfer },
    { path: buildPath('members'), label: 'Members', icon: faUsers },
  ];

  const normalizePath = (path: string) => path.replace(/\/+$/, '') || '/';
  const currentPath = normalizePath(location.pathname);

  return (
    <div className="nav-bar">
      {items.map(({ path, label, icon }) => {
        const normalized = normalizePath(path);
        const isActive = currentPath === normalized;

        return (
          <button
            key={label}
            type="button"
            onClick={() => navigate(path)}
            className={`nav-item${isActive ? ' is-active' : ''}`}
          >
            {isActive && <div className="nav-indicator" />}
            <FontAwesomeIcon
              icon={icon}
              className={`nav-bar-icon${isActive ? ' is-active' : ''}`}
              aria-hidden="true"
            />
            <p className={`nav-bar-text${isActive ? ' is-active' : ''}`}>{label}</p>
          </button>
        );
      })}
    </div>
  );
};

export default NavBar;
