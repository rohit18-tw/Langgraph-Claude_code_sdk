import apiClient from './client';

/**
 * Chat API service
 * Handles all chat-related API operations
 */
export const chatService = {
  /**
   * Send a message via SSE endpoint
   * @param {string} sessionId - Session identifier
   * @param {string} message - Message content
   * @param {Array} images - Optional array of images
   * @returns {Promise} API response
   */
  sendMessage: async (sessionId, message, images = []) => {
    const response = await apiClient.post('/chat/sse', {
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
