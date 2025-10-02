import FreesplitLogo from '../images/FreeSplit.svg';
import { Link } from 'react-router-dom'
import React from 'react';

const LogoHeader: React.FC = () => {

  return (
    <div className="logo-header">
        <Link to="/">
            <img src={FreesplitLogo} alt="Freesplit Logo" />
        </Link>
    </div>
  )
}

export default LogoHeader;
