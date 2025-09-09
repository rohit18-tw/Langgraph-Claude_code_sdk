import apiClient from './client';

/**
 * Chat API service
 * Handles all chat-related API operations
 */
export const chatService = {
  /**
   * Send a message via SSE endpoint with enhanced SDK features
   * @param {string} sessionId - Session identifier
   * @param {string} message - Message content
   * @param {Array} images - Optional array of images
   * @param {string} permissionMode - Optional permission mode for Claude Code SDK
   * @returns {Promise} API response
   */
  sendMessage: async (sessionId, message, images = [], permissionMode = 'acceptEdits') => {
    const response = await apiClient.post('/chat/sse', {
      session_id: sessionId,
      message: message,
      images: images,
      metadata: {
        permission_mode: permissionMode
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  },

  /**
   * Resume a specific session by UUID using built-in session management
   * @param {string} sessionId - Session UUID to resume
   * @param {string} message - Message content
   * @param {Array} images - Optional array of images
   * @returns {Promise} API response
   */
  resumeSession: async (sessionId, message, images = []) => {
    const response = await apiClient.post('/chat/resume', {
      session_id: sessionId,
      message: message,
      images: images
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  },

  /**
   * Continue the most recent conversation using built-in session management
   * @param {string} sessionId - Session identifier
   * @param {string} message - Message content
   * @param {Array} images - Optional array of images
   * @returns {Promise} API response
   */
  continueConversation: async (sessionId, message, images = []) => {
    const response = await apiClient.post('/chat/continue', {
      session_id: sessionId,
      message: message,
      images: images
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  },

  /**
   * Get chat history for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise} Chat messages
   */
  getChatHistory: async (sessionId) => {
    const response = await apiClient.get(`/sessions/${sessionId}/messages`);
    return response.data;
  }
};

export default chatService;
