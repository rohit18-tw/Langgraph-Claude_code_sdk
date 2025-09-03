import React from 'react';
import AppProvider from './context/AppProvider';
import ChatPage from './pages/ChatPage/ChatPage';

// Import global styles
import './styles/globals.css';
import './App.css';

/**
 * Main App Component
 * Simplified and clean with new architecture
 */
function App() {
  return (
    <AppProvider>
      <div className="App">
        <ChatPage />
      </div>
    </AppProvider>
  );
}

export default App;
