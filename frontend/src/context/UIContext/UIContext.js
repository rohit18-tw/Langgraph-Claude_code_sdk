import React, { createContext, useContext, useReducer, useCallback } from 'react';

/**
 * UI Context for managing UI state
 */

// Initial state
const initialState = {
  // Modal state
  modals: {
    mcpManager: false,
    imageModal: { isOpen: false, src: '', name: '' },
    fileUpload: false
  },

  // Notification state
  notifications: [],

  // UI preferences
  sidebarCollapsed: false,
  theme: 'light',

  // Loading states
  globalLoading: false,
  loadingStates: {} // For component-specific loading
};

// Action types
export const UI_ACTIONS = {
  // Modal actions
  OPEN_MODAL: 'OPEN_MODAL',
  CLOSE_MODAL: 'CLOSE_MODAL',
  TOGGLE_MODAL: 'TOGGLE_MODAL',
  SET_MODAL_DATA: 'SET_MODAL_DATA',

  // Notification actions
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  CLEAR_NOTIFICATIONS: 'CLEAR_NOTIFICATIONS',

  // UI preferences
  TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
  SET_THEME: 'SET_THEME',

  // Loading actions
  SET_GLOBAL_LOADING: 'SET_GLOBAL_LOADING',
  SET_LOADING_STATE: 'SET_LOADING_STATE',
  CLEAR_LOADING_STATE: 'CLEAR_LOADING_STATE'
};

// Reducer
const uiReducer = (state, action) => {
  switch (action.type) {
    case UI_ACTIONS.OPEN_MODAL:
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload.modal]: action.payload.data || true
        }
      };

    case UI_ACTIONS.CLOSE_MODAL:
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload]: false
        }
      };

    case UI_ACTIONS.TOGGLE_MODAL:
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload]: !state.modals[action.payload]
        }
      };

    case UI_ACTIONS.SET_MODAL_DATA:
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload.modal]: action.payload.data
        }
      };

    case UI_ACTIONS.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };

    case UI_ACTIONS.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(
          notification => notification.id !== action.payload
        )
      };

    case UI_ACTIONS.CLEAR_NOTIFICATIONS:
      return {
        ...state,
        notifications: []
      };

    case UI_ACTIONS.TOGGLE_SIDEBAR:
      return {
        ...state,
        sidebarCollapsed: !state.sidebarCollapsed
      };

    case UI_ACTIONS.SET_THEME:
      return {
        ...state,
        theme: action.payload
      };

    case UI_ACTIONS.SET_GLOBAL_LOADING:
      return {
        ...state,
        globalLoading: action.payload
      };

    case UI_ACTIONS.SET_LOADING_STATE:
      return {
        ...state,
        loadingStates: {
          ...state.loadingStates,
          [action.payload.key]: action.payload.loading
        }
      };

    case UI_ACTIONS.CLEAR_LOADING_STATE:
      const { [action.payload]: removed, ...remainingLoadingStates } = state.loadingStates;
      return {
        ...state,
        loadingStates: remainingLoadingStates
      };

    default:
      return state;
  }
};

// Context
const UIContext = createContext();

// Provider component
export const UIProvider = ({ children }) => {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  // Modal actions
  const openModal = useCallback((modal, data) => {
    dispatch({
      type: UI_ACTIONS.OPEN_MODAL,
      payload: { modal, data }
    });
  }, []);

  const closeModal = useCallback((modal) => {
    dispatch({
      type: UI_ACTIONS.CLOSE_MODAL,
      payload: modal
    });
  }, []);

  const toggleModal = useCallback((modal) => {
    dispatch({
      type: UI_ACTIONS.TOGGLE_MODAL,
      payload: modal
    });
  }, []);

  const setModalData = useCallback((modal, data) => {
    dispatch({
      type: UI_ACTIONS.SET_MODAL_DATA,
      payload: { modal, data }
    });
  }, []);

  // Notification actions
  const addNotification = useCallback((notification) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const notificationWithId = {
      id,
      type: 'info',
      autoClose: true,
      duration: 5000,
      ...notification
    };

    dispatch({
      type: UI_ACTIONS.ADD_NOTIFICATION,
      payload: notificationWithId
    });

    // Auto-remove notification if autoClose is enabled
    if (notificationWithId.autoClose) {
      setTimeout(() => {
        removeNotification(id);
      }, notificationWithId.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    dispatch({
      type: UI_ACTIONS.REMOVE_NOTIFICATION,
      payload: id
    });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({
      type: UI_ACTIONS.CLEAR_NOTIFICATIONS
    });
  }, []);

  // UI preference actions
  const toggleSidebar = useCallback(() => {
    dispatch({
      type: UI_ACTIONS.TOGGLE_SIDEBAR
    });
  }, []);

  const setTheme = useCallback((theme) => {
    dispatch({
      type: UI_ACTIONS.SET_THEME,
      payload: theme
    });
  }, []);

  // Loading actions
  const setGlobalLoading = useCallback((loading) => {
    dispatch({
      type: UI_ACTIONS.SET_GLOBAL_LOADING,
      payload: loading
    });
  }, []);

  const setLoadingState = useCallback((key, loading) => {
    dispatch({
      type: UI_ACTIONS.SET_LOADING_STATE,
      payload: { key, loading }
    });
  }, []);

  const clearLoadingState = useCallback((key) => {
    dispatch({
      type: UI_ACTIONS.CLEAR_LOADING_STATE,
      payload: key
    });
  }, []);

  // Utility functions
  const isModalOpen = useCallback((modal) => {
    return Boolean(state.modals[modal]);
  }, [state.modals]);

  const getModalData = useCallback((modal) => {
    return state.modals[modal] || null;
  }, [state.modals]);

  const isLoading = useCallback((key) => {
    if (key) {
      return Boolean(state.loadingStates[key]);
    }
    return state.globalLoading;
  }, [state.loadingStates, state.globalLoading]);

  const hasNotifications = useCallback(() => {
    return state.notifications.length > 0;
  }, [state.notifications]);

  // Context value
  const value = {
    // State
    modals: state.modals,
    notifications: state.notifications,
    sidebarCollapsed: state.sidebarCollapsed,
    theme: state.theme,
    globalLoading: state.globalLoading,
    loadingStates: state.loadingStates,

    // Modal actions
    openModal,
    closeModal,
    toggleModal,
    setModalData,

    // Notification actions
    addNotification,
    removeNotification,
    clearNotifications,

    // UI preference actions
    toggleSidebar,
    setTheme,

    // Loading actions
    setGlobalLoading,
    setLoadingState,
    clearLoadingState,

    // Utilities
    isModalOpen,
    getModalData,
    isLoading,
    hasNotifications
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

// Custom hook to use UI context
export const useUIContext = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUIContext must be used within a UIProvider');
  }
  return context;
};

export default UIContext;
