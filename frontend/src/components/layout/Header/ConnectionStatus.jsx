import React from 'react';
import { useSessionContext } from '../../../context/SessionContext/SessionContext';

// Temporary wrapper around existing ConnectionStatus
import OriginalConnectionStatus from '../../ConnectionStatus';

/**
 * Enhanced Connection Status with new architecture
 * Currently wraps existing component while migration is in progress
 */
const ConnectionStatus = ({ isConnected, sessionId, status, ...props }) => {
  const { isConnected: contextIsConnected, currentSessionId } = useSessionContext();

  return (
    <OriginalConnectionStatus
      isConnected={isConnected !== undefined ? isConnected : contextIsConnected}
      sessionId={sessionId || currentSessionId}
      {...props}
    />
  );
};

export default ConnectionStatus;
