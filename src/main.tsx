import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AdminPage } from './components/AdminPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/^\/admin(?:\/|$)/.test(window.location.pathname) ? <AdminPage /> : <App />}
  </StrictMode>,
);
