import React from 'react';

const SigFooter: React.FC = () => {

  return (
    <footer>
      <div className="v-flex align-center gap-8px">
        <p className="p2">
          🧱 Created by <a href="https://thomasforsyth.design" target="_blank" rel="noopener noreferrer">Thomas</a> & <a href="https://www.linkedin.com/in/kmfsousa/" target="_blank" rel="noopener noreferrer">Kris</a>.
        </p> 
        <p className="p2">💬 <a href="https://docs.google.com/forms/d/e/1FAIpQLSdWTIo2DnKLBNX2TBrNlJq4KB3tRBGf2EaRVS39hbe2NMBJXA/viewform?usp=header" target="_blank" rel="noopener noreferrer">
          Submit feedback</a>.
        </p>
      </div>
    </footer>
  )
}

export default SigFooter;
