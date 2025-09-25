import FreesplitLogo from '../images/FreeSplit.svg';
import React from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faUserPlus } from '@fortawesome/free-solid-svg-icons'

function Index() {
  return (
    <div className="page">
      <div className="body">
        <div className="logo-header">
          <img src={FreesplitLogo} alt="Freesplit Logo" />
        </div>
        <div className="content-section v-centered">
          <div className="content-container">
            <div className="v-flex gap-8px text-is-centered">
              <h1>Split group costs the easy way</h1>
              <p>Simplify payments, and settle up without the hassle.</p>
            </div>
            <Link to="/create-a-group/" className="btn">
              <span>Create a group</span>
              <FontAwesomeIcon icon={faUserPlus} aria-hidden="true"/>
            </Link>
            <div className="bullet-list">
              <div className="bullet-point"><FontAwesomeIcon icon={faCircleCheck} className="is-green" style={{ fontSize: 16 }} aria-hidden="true" /><p className="p2">Smart settling</p></div>
              <div className="bullet-point"><FontAwesomeIcon icon={faCircleCheck} className="is-green" style={{ fontSize: 16 }} aria-hidden="true" /><p className="p2">Simple sharing</p></div>
              <div className="bullet-point"><FontAwesomeIcon icon={faCircleCheck} className="is-green" style={{ fontSize: 16 }} aria-hidden="true" /><p className="p2">No limits</p></div>
            </div>
          </div>
        </div>
        <footer>
          <p className="p2">Created by <a href="https://thomasforsyth.design">Thomas</a> & <a href="https://www.linkedin.com/in/kmfsousa/">Kris</a></p>
        </footer>
      </div>  
    </div>   
  );
};

export default Index;
