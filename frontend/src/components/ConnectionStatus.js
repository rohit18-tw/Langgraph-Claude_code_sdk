import React from 'react';

const ConnectionStatus = ({ isConnected, sessionId }) => {
  return (
    <div className="connection-status">
      <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </span>
      <span className="session-id">Session: {sessionId.substring(0, 8)}...</span>
    </div>
  );
};

export default ConnectionStatus;
