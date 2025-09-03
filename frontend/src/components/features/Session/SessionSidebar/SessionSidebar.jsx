import React from 'react';
import { useSession } from '../../../../hooks/api/useSession';
import { useSessionContext } from '../../../../context/SessionContext/SessionContext';

// Temporary wrapper around existing SessionSidebar
import OriginalSessionSidebar from '../../../SessionSidebar';

/**
 * Enhanced Session Sidebar with new architecture
 * Currently wraps existing component while migration is in progress
 */
const SessionSidebar = ({ onNewSession, onSelectSession, onSessionDeleted, ...props }) => {
  const { currentSessionId } = useSessionContext();
  const { handleNewSession, switchToSession, deleteSession } = useSession();

  const handleNewSessionClick = (saveCurrentSession) => {
    if (onNewSession) {
      onNewSession(saveCurrentSession);
    } else {
      handleNewSession(true);
    }
  };

  const handleSelectSessionClick = (sessionId) => {
    if (onSelectSession) {
      onSelectSession(sessionId);
    } else {
      switchToSession(sessionId);
    }
  };

  const handleSessionDeletedClick = (sessionId) => {
    if (onSessionDeleted) {
      onSessionDeleted(sessionId);
    } else {
      deleteSession(sessionId);
    }
  };

  return (
    <OriginalSessionSidebar
      currentSessionId={currentSessionId}
      onNewSession={handleNewSessionClick}
      onSelectSession={handleSelectSessionClick}
      onSessionDeleted={handleSessionDeletedClick}
      {...props}
    />
  );
};

export default SessionSidebar;
