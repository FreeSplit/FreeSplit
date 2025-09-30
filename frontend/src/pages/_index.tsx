import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUserPlus, } from '@fortawesome/free-solid-svg-icons'
import { localStorageService } from '../services/localStorage'
import LogoHeader from '../nav/logo-header'
import SigFooter from '../nav/sig-footer'

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
        < LogoHeader />
        <div className="content-section v-centered">
          <div className="content-container">
            <div className="v-flex gap-8px text-is-centered">
              <h1>The easy way to split group costs</h1>
              <p>Split expenses, simplify payments and settle debts without limits.</p>
            </div>
            <Link to="/create-a-group/" className="btn">
              <span>Create a new group</span>
              <FontAwesomeIcon icon={faUserPlus} aria-hidden="true"/>
            </Link>
            {hasGroups && (
              <Link to="/groups" className="a">
                View my groups
              </Link>
            )}
          </div>
        </div>
        < SigFooter />
      </div>  
    </div>   
  );
};

export default Index;
