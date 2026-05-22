import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './services/AuthContext';
import { db } from './services/firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

// Suppress benign Vite websocket errors in preview environment
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('[vite] failed to connect to websocket')) {
    return;
  }
  if (typeof args[0] === 'string' && args[0].includes('WebSocket closed without opened')) {
    return;
  }
  if (args[0] instanceof Error && args[0].message.includes('WebSocket closed without opened')) {
    return;
  }
  originalConsoleError(...args);
};
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('[vite]')) {
    if (args.some(arg => typeof arg === 'string' && arg.includes('WebSocket closed without opened'))) return;
  }
  originalConsoleLog(...args);
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
