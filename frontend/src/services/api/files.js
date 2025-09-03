import apiClient from './client';

/**
 * File API service
 * Handles file upload and management operations
 */
export const fileService = {
  /**
   * Upload files to a session
   * @param {string} sessionId - Session identifier
   * @param {Array} files - Array of File objects
   * @returns {Promise} Upload response
   */
  uploadFiles: async (sessionId, files) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const response = await apiClient.post(`/upload?session_id=${sessionId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Process images for chat messages
   * @param {Array} files - Array of image File objects
   * @returns {Promise} Array of processed images with data URLs
   */
  processImages: async (files) => {
    const imagePromises = files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          name: file.name,
          dataUrl: e.target.result,
          size: file.size
        });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    return Promise.all(imagePromises);
  }
};

export default fileService;
