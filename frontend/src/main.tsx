import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const container = document.getElementById('root');

// Checked rather than asserted with `!`: if index.html ever loses the mount
// point, a named error is far easier to diagnose than a null dereference
// inside React.
if (!container) {
  throw new Error('Unable to start: no #root element was found in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
