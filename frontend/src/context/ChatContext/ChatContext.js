import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MESSAGE_TYPES } from '../../utils/constants/messages';

/**
 * Chat Context for managing chat state
 */

// Initial state
const initialState = {
  messages: [],
  isLoading: false,
  currentProgress: null,
  lastMessageId: null
};

// Action types
export const CHAT_ACTIONS = {
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_LOADING: 'SET_LOADING',
  SET_PROGRESS: 'SET_PROGRESS',
  CLEAR_MESSAGES: 'CLEAR_MESSAGES',
  LOAD_MESSAGES: 'LOAD_MESSAGES',
  UPDATE_MESSAGE: 'UPDATE_MESSAGE',
  REMOVE_MESSAGE: 'REMOVE_MESSAGE'
};

// Reducer
const chatReducer = (state, action) => {
  switch (action.type) {
    case CHAT_ACTIONS.ADD_MESSAGE:
      return {
        ...state,
        messages: [...state.messages, action.payload],
        lastMessageId: action.payload.id
      };

    case CHAT_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case CHAT_ACTIONS.SET_PROGRESS:
      return {
        ...state,
        currentProgress: action.payload
      };

    case CHAT_ACTIONS.CLEAR_MESSAGES:
      return {
        ...state,
        messages: [],
        lastMessageId: null
      };

    case CHAT_ACTIONS.LOAD_MESSAGES:
      return {
        ...state,
        messages: action.payload || []
      };

    case CHAT_ACTIONS.UPDATE_MESSAGE:
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id
            ? { ...msg, ...action.payload.updates }
            : msg
        )
      };

    case CHAT_ACTIONS.REMOVE_MESSAGE:
      return {
        ...state,
        messages: state.messages.filter(msg => msg.id !== action.payload)
      };

    default:
      return state;
  }
};

// Context
const ChatContext = createContext();

// Provider component
export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Action creators
  const addMessage = useCallback((sender, content, metadata = {}) => {
    const message = {
      id: uuidv4(),
      sender,
      content,
      timestamp: metadata.timestamp || new Date().toISOString(),
      images: metadata.images || null,
      metadata
    };

    dispatch({
      type: CHAT_ACTIONS.ADD_MESSAGE,
      payload: message
    });

    return message;
  }, []);

  const setLoading = useCallback((loading) => {
    dispatch({
      type: CHAT_ACTIONS.SET_LOADING,
      payload: loading
    });
  }, []);

  const setProgress = useCallback((progress) => {
    dispatch({
      type: CHAT_ACTIONS.SET_PROGRESS,
      payload: progress
    });
  }, []);

  const clearMessages = useCallback(() => {
    dispatch({
      type: CHAT_ACTIONS.CLEAR_MESSAGES
    });
  }, []);

  const loadMessages = useCallback((messages) => {
    dispatch({
      type: CHAT_ACTIONS.LOAD_MESSAGES,
      payload: messages
    });
  }, []);

  const updateMessage = useCallback((messageId, updates) => {
    dispatch({
      type: CHAT_ACTIONS.UPDATE_MESSAGE,
      payload: { id: messageId, updates }
    });
  }, []);

  const removeMessage = useCallback((messageId) => {
    dispatch({
      type: CHAT_ACTIONS.REMOVE_MESSAGE,
      payload: messageId
    });
  }, []);

  // Utility functions
  const getLastMessage = useCallback(() => {
    return state.messages[state.messages.length - 1] || null;
  }, [state.messages]);

  const getMessageCount = useCallback((senderType) => {
    if (!senderType) return state.messages.length;
    return state.messages.filter(msg => msg.sender === senderType).length;
  }, [state.messages]);

  const hasMessages = useCallback(() => {
    return state.messages.length > 0;
  }, [state.messages]);

  // Context value
  const value = {
    // State
    messages: state.messages,
    isLoading: state.isLoading,
    currentProgress: state.currentProgress,
    lastMessageId: state.lastMessageId,

    // Actions
    addMessage,
    setLoading,
    setProgress,
    clearMessages,
    loadMessages,
    updateMessage,
    removeMessage,

    // Utilities
    getLastMessage,
    getMessageCount,
    hasMessages
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook to use chat context
export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

export default ChatContext;
