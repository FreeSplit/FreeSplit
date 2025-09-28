import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/global.css';
import './styles/tokens.css';
import './styles/components.css';
import './styles/participants-form.css';
import './styles/split-breakdown.css';
import './styles/simplify-animation.css';
import App from './App';
// import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA
// serviceWorkerRegistration.register(); // Disabled to prevent caching issues
