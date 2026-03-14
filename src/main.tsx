import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress Vite HMR websocket errors which are expected in this environment
if (typeof window !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalDebug = console.debug;

  const isViteNoise = (msg: any) => {
    if (typeof msg !== 'string') return false;
    return msg.includes('[vite] failed to connect to websocket') || 
           msg.includes('WebSocket connection to') ||
           msg.includes('[vite] connecting...') ||
           msg.includes('WebSocket closed without opened');
  };

  console.error = (...args) => {
    if (args[0] && isViteNoise(args[0])) return;
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    if (args[0] && isViteNoise(args[0])) return;
    originalWarn.apply(console, args);
  };

  console.log = (...args) => {
    if (args[0] && isViteNoise(args[0])) return;
    originalLog.apply(console, args);
  };

  console.debug = (...args) => {
    if (args[0] && isViteNoise(args[0])) return;
    originalDebug.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : '');
    if (isViteNoise(msg)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('error', (event) => {
    if (isViteNoise(event.message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
