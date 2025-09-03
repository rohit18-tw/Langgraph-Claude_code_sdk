import { useEffect, useRef, useCallback, useState } from 'react';
import { useSessionContext } from '../../context/SessionContext/SessionContext';
import { useUIContext } from '../../context/UIContext/UIContext';
import { SSEClient } from '../../services/sse/sseClient';
import { CONNECTION_STATUS } from '../../utils/constants/messages';

/**
 * Enhanced SSE Hook
 * Manages Server-Sent Events connection with improved error handling and reconnection
 */
export const useSSE = (onMessage, onError) => {
  const { currentSessionId, setConnectionStatus } = useSessionContext();
  const { addNotification } = useUIContext();

  const [sseStatus, setSSEStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const sseClientRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const reconnectTimeoutRef = useRef(null);
  const isUnmountedRef = useRef(false);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  }, [onMessage, onError]);

  /**
   * Handle SSE status changes
   */
  const handleStatusChange = useCallback((status) => {
    if (isUnmountedRef.current) return;

    setSSEStatus(status);
    setConnectionStatus(status === CONNECTION_STATUS.CONNECTED);

    // Show notifications for connection changes
    switch (status) {
      case CONNECTION_STATUS.CONNECTED:
        addNotification({
          type: 'success',
          title: 'Connected',
          message: 'Real-time connection established',
          autoClose: true,
          duration: 2000
        });
        break;

      case CONNECTION_STATUS.ERROR:
        addNotification({
          type: 'warning',
          title: 'Connection Issues',
          message: 'Attempting to reconnect...',
          autoClose: true,
          duration: 3000
        });
        break;

      case CONNECTION_STATUS.FAILED:
        addNotification({
          type: 'error',
          title: 'Connection Failed',
          message: 'Unable to establish real-time connection',
          autoClose: false
        });
        break;

      default:
        break;
    }
  }, [setConnectionStatus, addNotification]);

  /**
   * Handle SSE messages
   */
  const handleMessage = useCallback((data) => {
    if (isUnmountedRef.current) return;

    // Handle file updates from SSE
    if (data.type === 'files_updated') {
      // This will be handled by the session context
      onMessageRef.current?.(data);
    } else if (data.type === 'directory_structure_updated') {
      // This will be handled by the session context
      onMessageRef.current?.(data);
    } else {
      // Pass to chat context
      onMessageRef.current?.(data);
    }
  }, []);

  /**
   * Handle SSE errors
   */
  const handleError = useCallback((error) => {
    if (isUnmountedRef.current) return;

    console.error('SSE Error:', error);
    onErrorRef.current?.(error);
  }, []);

  /**
   * Connect to SSE
   */
  const connectSSE = useCallback(() => {
    if (!currentSessionId || isUnmountedRef.current) return;

    // Clean up existing connection
    if (sseClientRef.current) {
      sseClientRef.current.disconnect();
    }

    // Create new SSE client
    sseClientRef.current = new SSEClient();

    // Connect with callbacks
    sseClientRef.current.connect(currentSessionId, {
      onMessage: handleMessage,
      onError: handleError,
      onStatusChange: handleStatusChange
    });

  }, [currentSessionId, handleMessage, handleError, handleStatusChange]);

  /**
   * Disconnect SSE
   */
  const disconnectSSE = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (sseClientRef.current) {
      sseClientRef.current.disconnect();
      sseClientRef.current = null;
    }

    if (!isUnmountedRef.current) {
      setSSEStatus(CONNECTION_STATUS.DISCONNECTED);
      setConnectionStatus(false);
    }
  }, [setConnectionStatus]);

  /**
   * Manually reconnect
   */
  const reconnect = useCallback(() => {
    console.log('🔄 Manual SSE reconnection triggered');
    disconnectSSE();

    // Add small delay before reconnecting
    setTimeout(() => {
      if (!isUnmountedRef.current) {
        connectSSE();
      }
    }, 1000);
  }, [connectSSE, disconnectSSE]);

  // Connect when session ID changes
  useEffect(() => {
    if (currentSessionId) {
      connectSSE();
    } else {
      disconnectSSE();
    }

    return () => disconnectSSE();
  }, [currentSessionId, connectSSE, disconnectSSE]);

  // Handle component unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      disconnectSSE();
    };
  }, [disconnectSSE]);

  /**
   * Check if connected
   */
  const isConnected = useCallback(() => {
    return sseStatus === CONNECTION_STATUS.CONNECTED;
  }, [sseStatus]);

  /**
   * Get connection status
   */
  const getConnectionStatus = useCallback(() => {
    return sseStatus;
  }, [sseStatus]);

  return {
    sseStatus,
    isConnected: isConnected(),
    reconnect,
    disconnect: disconnectSSE,
    getConnectionStatus
  };
};

export default useSSE;
