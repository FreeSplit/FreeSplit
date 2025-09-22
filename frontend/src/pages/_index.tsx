import FreesplitLogo from '../images/freesplit-logo.svg';
import React from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons'

function Index() {
  return (
    <div className="body">
      <div className="logo-header">
        <img src={FreesplitLogo} alt="Freesplit Logo" />
      </div>
      <div className="home-content">
        <p>Settle group expenses for free.</p>
        <Link to="/create-a-group/" className="btn">
            Create a group
          </Link>
          <div className="home-values">
            <div className="bullet"><FontAwesomeIcon icon={faCircleCheck} className="is-green" style={{ fontSize: 16 }} aria-hidden="true" /><p className="p2">Track & split debts</p></div>
            <div className="bullet"><FontAwesomeIcon icon={faCircleCheck} className="is-green" style={{ fontSize: 16 }} aria-hidden="true" /><p className="p2">Simplify transactions</p></div>
            <div className="bullet"><FontAwesomeIcon icon={faCircleCheck} className="is-green" style={{ fontSize: 16 }} aria-hidden="true" /><p className="p2">Unlimited expenses</p></div>
          </div>
      </div>
      <footer>
        <p className="p2">Created by <a href="https://thomasforsyth.design">Thomas</a> & <a href="https://www.linkedin.com/in/kmfsousa/">Kris</a></p>
      </footer>
      
    </div>   
  );
};

export default Index;
