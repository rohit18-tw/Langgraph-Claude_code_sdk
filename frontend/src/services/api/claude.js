import apiClient from './client';

/**
 * Claude-specific API service
 * Handles Claude Code SDK specific operations
 */
export const claudeService = {
  /**
   * Get available permission modes for Claude Code SDK
   * @returns {Promise} Available permission modes
   */
  getPermissionModes: async () => {
    const response = await apiClient.get('/claude/permission-modes');
    return response.data;
  },

  /**
   * Send message with specific permission mode
   * @param {string} sessionId - Session identifier
   * @param {string} message - Message content
   * @param {Array} images - Optional array of images
   * @param {string} permissionMode - Permission mode for SDK
   * @returns {Promise} API response
   */
  sendMessageWithPermissions: async (sessionId, message, images = [], permissionMode = 'acceptEdits') => {
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
  }
};

export default claudeService;
