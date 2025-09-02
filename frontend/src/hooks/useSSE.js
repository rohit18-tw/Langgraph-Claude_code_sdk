import { useEffect, useRef, useState, useCallback } from 'react';

const useSSE = (sessionId, onMessage, onError) => {
  const [sseStatus, setSSEStatus] = useState('disconnected');
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Store callbacks in refs to avoid dependency issues
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  }, [onMessage, onError]);

  const connectSSE = useCallback(() => {
    if (!sessionId) return;

    // Clean up any existing connection first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const sseUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/stream/${sessionId}`;

      eventSourceRef.current = new EventSource(sseUrl);

      eventSourceRef.current.onopen = () => {
        setSSEStatus('connected');
        reconnectAttempts.current = 0;
      };

      // Handle specific event types
      eventSourceRef.current.addEventListener('connected', (event) => {
        // Connection confirmed
      });

      eventSourceRef.current.addEventListener('verbose', (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current && onMessageRef.current({ type: 'verbose', ...data });
        } catch (e) {
          console.error('Error parsing verbose event:', e);
        }
      });

      eventSourceRef.current.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current && onMessageRef.current({ type: 'progress', ...data });
        } catch (e) {
          console.error('Error parsing progress event:', e);
        }
      });

      eventSourceRef.current.addEventListener('text', (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current && onMessageRef.current({ type: 'text', ...data });
        } catch (e) {
          console.error('Error parsing text event:', e);
        }
      });

      eventSourceRef.current.addEventListener('files_updated', (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current && onMessageRef.current({ type: 'files_updated', ...data });
        } catch (e) {
          console.error('Error parsing files_updated event:', e);
        }
      });

      eventSourceRef.current.addEventListener('success', (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current && onMessageRef.current({ type: 'success', ...data });
        } catch (e) {
          console.error('Error parsing success event:', e);
        }
      });

      eventSourceRef.current.addEventListener('error', (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current && onMessageRef.current({ type: 'error', ...data });
        } catch (e) {
          console.error('Error parsing error event:', e);
        }
      });

      eventSourceRef.current.addEventListener('ping', (event) => {
        // Keep-alive ping, no action needed
        // console.log('📡 SSE ping received');
      });

      eventSourceRef.current.onerror = (event) => {
        console.error('❌ SSE Error:', event);
        setSSEStatus('error');

        // Attempt reconnection with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectSSE();
          }, delay);
        } else {
          onErrorRef.current && onErrorRef.current('SSE connection failed after multiple attempts');
          setSSEStatus('failed');
        }
      };

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      onErrorRef.current && onErrorRef.current(error.message);
    }
  }, [sessionId]);

  const disconnectSSE = useCallback(() => {
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset reconnection attempts
    reconnectAttempts.current = 0;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setSSEStatus('disconnected');
  }, []);

  useEffect(() => {
    if (sessionId) {
      connectSSE();
    } else {
      disconnectSSE();
    }

    return () => disconnectSSE();
  }, [sessionId, connectSSE, disconnectSSE]);

  return {
    sseStatus,
    reconnect: connectSSE,
    disconnect: disconnectSSE
  };
};

export default useSSE;
