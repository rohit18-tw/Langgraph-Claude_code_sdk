import apiClient from './client';

/**
 * Session API service
 * Handles session management and file operations
 */
export const sessionService = {
  /**
   * Get files for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise} Session files
   */
  getSessionFiles: async (sessionId) => {
    const response = await apiClient.get(`/sessions/${sessionId}/files`);
    return response.data;
  },

  /**
   * Get directory structure for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise} Directory structure
   */
  getSessionStructure: async (sessionId) => {
    const response = await apiClient.get(`/sessions/${sessionId}/structure`);
    return response.data;
  },

  /**
   * Load both files and structure for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise} Object with files and structure
   */
  loadSessionData: async (sessionId) => {
    const [filesResponse, structureResponse] = await Promise.all([
      sessionService.getSessionFiles(sessionId),
      sessionService.getSessionStructure(sessionId)
    ]);

    return {
      files: filesResponse.files || [],
      structure: structureResponse || null
    };
  },

  /**
   * Clear a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise} API response
   */
  clearSession: async (sessionId) => {
    const response = await apiClient.delete(`/sessions/${sessionId}`);
    return response.data;
  }
};

export default sessionService;
