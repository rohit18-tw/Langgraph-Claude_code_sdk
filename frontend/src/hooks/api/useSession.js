import { useCallback, useEffect } from 'react';
import { useSessionContext } from '../../context/SessionContext/SessionContext';
import { useChatContext } from '../../context/ChatContext/ChatContext';
import { useUIContext } from '../../context/UIContext/UIContext';
import { sessionService } from '../../services/api/sessions';
import { sessionStorageService } from '../../services/storage/sessionStorage';
import { handleError, createErrorMessage } from '../../utils/errors/errorHandler';

/**
 * Custom hook for session management
 */
export const useSession = () => {
  const {
    currentSessionId,
    uploadedFiles,
    sessions,
    setSessionId,
    createNewSession,
    setUploadedFiles,
    setDirectoryStructure,
    loadSessions,
    addSession,
    updateSession,
    removeSession,
    clearSessionData
  } = useSessionContext();

  const {
    messages,
    clearMessages,
    loadMessages
  } = useChatContext();

  const { addNotification, setLoadingState } = useUIContext();

  /**
   * Save current session data to localStorage
   */
  const saveCurrentSession = useCallback(() => {
    if (!currentSessionId || !messages.length) return;

    try {
      // Save session data
      sessionStorageService.saveSessionData(currentSessionId, messages, uploadedFiles);

      // Create and save session metadata
      const metadata = sessionStorageService.createSessionMetadata(currentSessionId, messages);
      sessionStorageService.saveSessionMetadata(metadata);

      // Update sessions list
      updateSession(currentSessionId, metadata);

    } catch (error) {
      console.error('Error saving session:', error);
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save session data'
      });
    }
  }, [currentSessionId, messages, uploadedFiles, updateSession, addNotification]);

  /**
   * Load session data from localStorage
   * @param {string} sessionId - Session ID to load
   */
  const loadSessionData = useCallback((sessionId) => {
    if (!sessionId) return;

    try {
      const { messages: savedMessages, files: savedFiles } = sessionStorageService.loadSessionData(sessionId);
      loadMessages(savedMessages);
      setUploadedFiles(savedFiles);

    } catch (error) {
      console.error('Error loading session:', error);
      addNotification({
        type: 'error',
        title: 'Load Failed',
        message: 'Failed to load session data'
      });
    }
  }, [loadMessages, setUploadedFiles, addNotification]);

  /**
   * Create a new session
   * @param {boolean} saveCurrentFirst - Whether to save current session first
   */
  const handleNewSession = useCallback((saveCurrentFirst = true) => {
    // Save current session if requested and has data
    if (saveCurrentFirst && messages.length > 0) {
      saveCurrentSession();
    }

    // Create new session
    const newSessionId = createNewSession();

    // Clear messages
    clearMessages();

    addNotification({
      type: 'success',
      title: 'New Session',
      message: 'Started a new chat session'
    });

    return newSessionId;
  }, [messages.length, saveCurrentSession, createNewSession, clearMessages, addNotification]);

  /**
   * Switch to a different session
   * @param {string} sessionId - Session ID to switch to
   */
  const switchToSession = useCallback((sessionId) => {
    if (sessionId === currentSessionId) return;

    // Save current session data
    if (messages.length > 0) {
      saveCurrentSession();
    }

    // Switch to new session
    setSessionId(sessionId);

    // Load session data
    loadSessionData(sessionId);

    addNotification({
      type: 'info',
      title: 'Session Switched',
      message: 'Loaded selected session'
    });
  }, [currentSessionId, messages.length, saveCurrentSession, setSessionId, loadSessionData, addNotification]);

  /**
   * Delete a session
   * @param {string} sessionId - Session ID to delete
   */
  const deleteSession = useCallback(async (sessionId) => {
    const loadingKey = `delete-session-${sessionId}`;

    try {
      setLoadingState(loadingKey, true);

      // Delete from server
      await sessionService.clearSession(sessionId);

      // Delete from localStorage
      sessionStorageService.deleteSessionData(sessionId);
      sessionStorageService.deleteSessionMetadata(sessionId);

      // Remove from sessions list
      removeSession(sessionId);

      // If current session was deleted, create new one
      if (sessionId === currentSessionId) {
        handleNewSession(false); // Don't save the deleted session
      }

      addNotification({
        type: 'success',
        title: 'Session Deleted',
        message: 'Session deleted successfully'
      });

    } catch (error) {
      const parsedError = handleError(error, 'Session.deleteSession');
      const errorMessage = createErrorMessage(error, 'Failed to delete session');

      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: errorMessage
      });

      console.error('Failed to delete session:', parsedError);
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [currentSessionId, removeSession, handleNewSession, addNotification, setLoadingState]);

  /**
   * Clear current session
   */
  const clearSession = useCallback(async () => {
    if (!currentSessionId) return;

    const loadingKey = `clear-session-${currentSessionId}`;

    try {
      setLoadingState(loadingKey, true);

      // Clear session on server
      await sessionService.clearSession(currentSessionId);

      // Clear local data
      clearMessages();
      clearSessionData();

      addNotification({
        type: 'success',
        title: 'Session Cleared',
        message: 'All files and messages have been removed'
      });

    } catch (error) {
      const parsedError = handleError(error, 'Session.clearSession');
      const errorMessage = createErrorMessage(error, 'Failed to clear session');

      addNotification({
        type: 'error',
        title: 'Clear Failed',
        message: errorMessage
      });

      console.error('Failed to clear session:', parsedError);
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [currentSessionId, clearMessages, clearSessionData, addNotification, setLoadingState]);

  /**
   * Load sessions from localStorage on mount
   */
  useEffect(() => {
    const savedSessions = sessionStorageService.loadSessionMetadata();
    loadSessions(savedSessions);
  }, [loadSessions]);

  /**
   * Load session data if it exists
   */
  useEffect(() => {
    if (currentSessionId && sessionStorageService.hasSessionData(currentSessionId)) {
      loadSessionData(currentSessionId);
    }
  }, [currentSessionId, loadSessionData]);

  return {
    // State
    currentSessionId,
    sessions,
    hasMessages: messages.length > 0,
    hasFiles: uploadedFiles && uploadedFiles.length > 0,

    // Actions
    handleNewSession,
    switchToSession,
    deleteSession,
    clearSession,
    saveCurrentSession,
    loadSessionData
  };
};

export default useSession;
