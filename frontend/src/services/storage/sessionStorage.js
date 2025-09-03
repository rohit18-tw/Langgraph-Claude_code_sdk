/**
 * Session Storage Service
 * Handles localStorage operations for session data
 */
export const sessionStorageService = {
  /**
   * Save session data to localStorage
   * @param {string} sessionId - Session identifier
   * @param {Array} messages - Session messages
   * @param {Array} files - Uploaded files
   */
  saveSessionData: (sessionId, messages, files) => {
    try {
      const sessionData = {
        messages: messages || [],
        uploadedFiles: files || [],
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(`session_${sessionId}`, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error saving session data:', error);
    }
  },

  /**
   * Load session data from localStorage
   * @param {string} sessionId - Session identifier
   * @returns {Object} Session data with messages and files
   */
  loadSessionData: (sessionId) => {
    try {
      const sessionData = localStorage.getItem(`session_${sessionId}`);
      if (sessionData) {
        const { messages, uploadedFiles } = JSON.parse(sessionData);
        return {
          messages: messages || [],
          files: uploadedFiles || []
        };
      }
    } catch (error) {
      console.error('Error loading session data:', error);
    }
    return { messages: [], files: [] };
  },

  /**
   * Check if session has existing data
   * @param {string} sessionId - Session identifier
   * @returns {boolean} Whether session has data
   */
  hasSessionData: (sessionId) => {
    try {
      return localStorage.getItem(`session_${sessionId}`) !== null;
    } catch (error) {
      console.error('Error checking session data:', error);
      return false;
    }
  },

  /**
   * Delete session data
   * @param {string} sessionId - Session identifier
   */
  deleteSessionData: (sessionId) => {
    try {
      localStorage.removeItem(`session_${sessionId}`);
    } catch (error) {
      console.error('Error deleting session data:', error);
    }
  },

  /**
   * Save session metadata for sidebar
   * @param {Object} sessionMetadata - Session metadata object
   */
  saveSessionMetadata: (sessionMetadata) => {
    try {
      const savedSessions = localStorage.getItem('chatSessions');
      let sessions = savedSessions ? JSON.parse(savedSessions) : [];

      const existingIndex = sessions.findIndex(s => s.id === sessionMetadata.id);
      if (existingIndex >= 0) {
        sessions[existingIndex] = { ...sessions[existingIndex], ...sessionMetadata };
      } else {
        sessions.unshift(sessionMetadata);
      }

      localStorage.setItem('chatSessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving session metadata:', error);
    }
  },

  /**
   * Load all session metadata
   * @returns {Array} Array of session metadata objects
   */
  loadSessionMetadata: () => {
    try {
      const savedSessions = localStorage.getItem('chatSessions');
      return savedSessions ? JSON.parse(savedSessions) : [];
    } catch (error) {
      console.error('Error loading session metadata:', error);
      return [];
    }
  },

  /**
   * Delete session metadata
   * @param {string} sessionId - Session identifier
   */
  deleteSessionMetadata: (sessionId) => {
    try {
      const savedSessions = localStorage.getItem('chatSessions');
      if (savedSessions) {
        const sessions = JSON.parse(savedSessions);
        const filteredSessions = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem('chatSessions', JSON.stringify(filteredSessions));
      }
    } catch (error) {
      console.error('Error deleting session metadata:', error);
    }
  },

  /**
   * Create session metadata from messages
   * @param {string} sessionId - Session identifier
   * @param {Array} messages - Session messages
   * @returns {Object} Session metadata object
   */
  createSessionMetadata: (sessionId, messages) => {
    const userMessages = messages.filter(m => m.sender === 'user' || m.sender === 'assistant');
    const lastMessage = messages[messages.length - 1];
    const firstUserMessage = messages.find(m => m.sender === 'user');

    return {
      id: sessionId,
      title: firstUserMessage?.content?.substring(0, 50) || 'New Session',
      lastMessage: lastMessage?.content?.substring(0, 100) || 'No messages',
      timestamp: new Date().toISOString(),
      messageCount: userMessages.length
    };
  }
};

export default sessionStorageService;
