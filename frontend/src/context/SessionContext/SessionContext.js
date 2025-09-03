import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Session Context for managing session state
 */

// Initial state
const initialState = {
  currentSessionId: null,
  uploadedFiles: [],
  directoryStructure: null,
  isConnected: true,
  sessions: [] // Session metadata list
};

// Action types
export const SESSION_ACTIONS = {
  SET_SESSION_ID: 'SET_SESSION_ID',
  SET_UPLOADED_FILES: 'SET_UPLOADED_FILES',
  SET_DIRECTORY_STRUCTURE: 'SET_DIRECTORY_STRUCTURE',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  LOAD_SESSIONS: 'LOAD_SESSIONS',
  ADD_SESSION: 'ADD_SESSION',
  UPDATE_SESSION: 'UPDATE_SESSION',
  REMOVE_SESSION: 'REMOVE_SESSION',
  CLEAR_SESSION_DATA: 'CLEAR_SESSION_DATA'
};

// Reducer
const sessionReducer = (state, action) => {
  switch (action.type) {
    case SESSION_ACTIONS.SET_SESSION_ID:
      return {
        ...state,
        currentSessionId: action.payload
      };

    case SESSION_ACTIONS.SET_UPLOADED_FILES:
      return {
        ...state,
        uploadedFiles: action.payload || []
      };

    case SESSION_ACTIONS.SET_DIRECTORY_STRUCTURE:
      return {
        ...state,
        directoryStructure: action.payload
      };

    case SESSION_ACTIONS.SET_CONNECTION_STATUS:
      return {
        ...state,
        isConnected: action.payload
      };

    case SESSION_ACTIONS.LOAD_SESSIONS:
      return {
        ...state,
        sessions: action.payload || []
      };

    case SESSION_ACTIONS.ADD_SESSION:
      return {
        ...state,
        sessions: [action.payload, ...state.sessions]
      };

    case SESSION_ACTIONS.UPDATE_SESSION:
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.id
            ? { ...session, ...action.payload.updates }
            : session
        )
      };

    case SESSION_ACTIONS.REMOVE_SESSION:
      return {
        ...state,
        sessions: state.sessions.filter(session => session.id !== action.payload)
      };

    case SESSION_ACTIONS.CLEAR_SESSION_DATA:
      return {
        ...state,
        uploadedFiles: [],
        directoryStructure: null
      };

    default:
      return state;
  }
};

// Context
const SessionContext = createContext();

// Provider component
export const SessionProvider = ({ children }) => {
  const [state, dispatch] = useReducer(sessionReducer, {
    ...initialState,
    currentSessionId: uuidv4() // Generate initial session ID
  });

  // Action creators
  const setSessionId = useCallback((sessionId) => {
    dispatch({
      type: SESSION_ACTIONS.SET_SESSION_ID,
      payload: sessionId
    });
  }, []);

  const createNewSession = useCallback(() => {
    const newSessionId = uuidv4();
    dispatch({
      type: SESSION_ACTIONS.SET_SESSION_ID,
      payload: newSessionId
    });
    dispatch({
      type: SESSION_ACTIONS.CLEAR_SESSION_DATA
    });
    return newSessionId;
  }, []);

  const setUploadedFiles = useCallback((files) => {
    dispatch({
      type: SESSION_ACTIONS.SET_UPLOADED_FILES,
      payload: files
    });
  }, []);

  const setDirectoryStructure = useCallback((structure) => {
    dispatch({
      type: SESSION_ACTIONS.SET_DIRECTORY_STRUCTURE,
      payload: structure
    });
  }, []);

  const setConnectionStatus = useCallback((isConnected) => {
    dispatch({
      type: SESSION_ACTIONS.SET_CONNECTION_STATUS,
      payload: isConnected
    });
  }, []);

  const loadSessions = useCallback((sessions) => {
    dispatch({
      type: SESSION_ACTIONS.LOAD_SESSIONS,
      payload: sessions
    });
  }, []);

  const addSession = useCallback((sessionMetadata) => {
    dispatch({
      type: SESSION_ACTIONS.ADD_SESSION,
      payload: sessionMetadata
    });
  }, []);

  const updateSession = useCallback((sessionId, updates) => {
    dispatch({
      type: SESSION_ACTIONS.UPDATE_SESSION,
      payload: { id: sessionId, updates }
    });
  }, []);

  const removeSession = useCallback((sessionId) => {
    dispatch({
      type: SESSION_ACTIONS.REMOVE_SESSION,
      payload: sessionId
    });
  }, []);

  const clearSessionData = useCallback(() => {
    dispatch({
      type: SESSION_ACTIONS.CLEAR_SESSION_DATA
    });
  }, []);

  // Utility functions
  const getCurrentSession = useCallback(() => {
    return state.sessions.find(session => session.id === state.currentSessionId) || null;
  }, [state.sessions, state.currentSessionId]);

  const hasUploadedFiles = useCallback(() => {
    return state.uploadedFiles && state.uploadedFiles.length > 0;
  }, [state.uploadedFiles]);

  const getFileCount = useCallback(() => {
    return state.uploadedFiles ? state.uploadedFiles.length : 0;
  }, [state.uploadedFiles]);

  const findSessionById = useCallback((sessionId) => {
    return state.sessions.find(session => session.id === sessionId) || null;
  }, [state.sessions]);

  // Context value
  const value = {
    // State
    currentSessionId: state.currentSessionId,
    uploadedFiles: state.uploadedFiles,
    directoryStructure: state.directoryStructure,
    isConnected: state.isConnected,
    sessions: state.sessions,

    // Actions
    setSessionId,
    createNewSession,
    setUploadedFiles,
    setDirectoryStructure,
    setConnectionStatus,
    loadSessions,
    addSession,
    updateSession,
    removeSession,
    clearSessionData,

    // Utilities
    getCurrentSession,
    hasUploadedFiles,
    getFileCount,
    findSessionById
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

// Custom hook to use session context
export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
};

export default SessionContext;
