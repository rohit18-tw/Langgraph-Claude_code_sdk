import { API_BASE_URL } from '../api/client';

/**
 * SSE Client Service
 * Manages Server-Sent Events connections
 */
export class SSEClient {
  constructor() {
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.status = 'disconnected';
    this.callbacks = {
      onMessage: null,
      onError: null,
      onStatusChange: null
    };
  }

  /**
   * Connect to SSE stream
   * @param {string} sessionId - Session identifier
   * @param {Object} callbacks - Event callbacks
   */
  connect(sessionId, callbacks = {}) {
    if (!sessionId) {
      console.error('SSE: Session ID is required');
      return;
    }

    // Store callbacks
    this.callbacks = { ...this.callbacks, ...callbacks };

    // Clean up existing connection
    this.disconnect();

    try {
      const sseUrl = `${API_BASE_URL}/stream/${sessionId}`;
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        console.log('✅ SSE Connected');
      };

      this.eventSource.onerror = (event) => {
        console.error('❌ SSE Error:', event);
        this.setStatus('error');
        this.handleReconnection();
      };

      // Register event listeners
      this.registerEventListeners();

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      this.callbacks.onError?.(error.message);
    }
  }

  /**
   * Register all SSE event listeners
   */
  registerEventListeners() {
    const eventTypes = [
      'connected', 'verbose', 'progress', 'text',
      'files_updated', 'directory_structure_updated',
      'success', 'error', 'ping'
    ];

    eventTypes.forEach(eventType => {
      this.eventSource.addEventListener(eventType, (event) => {
        this.handleEvent(eventType, event);
      });
    });
  }

  /**
   * Handle incoming SSE events
   * @param {string} type - Event type
   * @param {Event} event - SSE event
   */
  handleEvent(type, event) {
    try {
      let data = {};

      if (event.data && event.data !== 'null') {
        data = JSON.parse(event.data);
      }

      // Handle ping events separately (no parsing needed)
      if (type === 'ping') {
        return;
      }

      // Pass event to callback
      this.callbacks.onMessage?.({ type, ...data });

    } catch (error) {
      console.error(`Error parsing ${type} event:`, error);
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      this.reconnectTimeout = setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`🔄 SSE Reconnecting... Attempt ${this.reconnectAttempts}`);
        // Note: reconnection would need the original sessionId and callbacks
        // This should be handled by the hook that manages the SSE client
      }, delay);
    } else {
      this.setStatus('failed');
      this.callbacks.onError?.('SSE connection failed after multiple attempts');
    }
  }

  /**
   * Set connection status and notify callback
   * @param {string} status - Connection status
   */
  setStatus(status) {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect() {
    // Clear reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Reset reconnection attempts
    this.reconnectAttempts = 0;

    // Close connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setStatus('disconnected');
  }

  /**
   * Get current connection status
   * @returns {string} Current status
   */
  getStatus() {
    return this.status;
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.status === 'connected';
  }
}

export default SSEClient;
