import React from 'react';
import ReactDOM from 'react-dom/client';
import './features/i18n/config';
import App from './App';
import './styles/dashboard.css';
import './styles/digital-twin.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
