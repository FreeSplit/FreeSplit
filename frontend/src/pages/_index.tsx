import FreesplitLogo from '../images/FreeSplit.svg';
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faUserPlus, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { localStorageService } from '../services/localStorage'

function Index() {
  const [hasGroups, setHasGroups] = useState(false);

  useEffect(() => {
    const checkForGroups = async () => {
      try {
        const groups = await localStorageService.getUserGroups();
        setHasGroups(groups.length > 0);
      } catch (error) {
        console.error('Error checking for groups:', error);
        setHasGroups(false);
      }
    };

    checkForGroups();
  }, []);

  return (
    <div className="page">
      <div className="body">
        <div className="logo-header">
          <img src={FreesplitLogo} alt="Freesplit Logo" />
        </div>
        <div className="content-section v-centered">
          <div className="content-container">
            <div className="v-flex gap-8px text-is-centered">
              <h1>The easy way to split group costs</h1>
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
        {hasGroups && (
          <div className="footer-cta">
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <Link to="/groups" className="btn" style={{ fontSize: '0.7em' }}>
                <span>Your groups</span>
                <FontAwesomeIcon icon={faChevronRight} aria-hidden="true"/>
              </Link>
            </div>
          </div>
        )}
        <footer>
          <p className="p2">Created by <a href="https://thomasforsyth.design">Thomas</a> & <a href="https://www.linkedin.com/in/kmfsousa/">Kris</a></p>
        </footer>
      </div>  
    </div>   
  );
};

export default Index;
