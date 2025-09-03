import React from 'react';
import { UIProvider } from './UIContext/UIContext';
import { SessionProvider } from './SessionContext/SessionContext';
import { ChatProvider } from './ChatContext/ChatContext';

/**
 * App Provider
 * Combines all context providers into a single wrapper
 */
const AppProvider = ({ children }) => {
  return (
    <UIProvider>
      <SessionProvider>
        <ChatProvider>
          {children}
        </ChatProvider>
      </SessionProvider>
    </UIProvider>
  );
};

export default AppProvider;
