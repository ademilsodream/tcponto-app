
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { CurrencyProvider } from '@/contexts/CurrencyContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryProvider>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </QueryProvider>
  </React.StrictMode>,
);
