import { FILE_UPLOAD } from '../constants/messages';

/**
 * Validation utility functions
 */

/**
 * Validate if file type is accepted
 * @param {File} file - File to validate
 * @param {string} acceptedTypes - Accepted file types string
 * @returns {boolean} Whether file type is valid
 */
export const validateFileType = (file, acceptedTypes = FILE_UPLOAD.ACCEPTED_FILE_TYPES) => {
  if (!file || !file.name) return false;

  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  return acceptedTypes.includes(fileExtension);
};

/**
 * Validate if image type is accepted
 * @param {File} file - File to validate
 * @returns {boolean} Whether image type is valid
 */
export const validateImageType = (file) => {
  return validateFileType(file, FILE_UPLOAD.ACCEPTED_IMAGE_TYPES);
};

/**
 * Validate file size
 * @param {File} file - File to validate
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {boolean} Whether file size is valid
 */
export const validateFileSize = (file, maxSize = FILE_UPLOAD.MAX_FILE_SIZE) => {
  return file && file.size <= maxSize;
};

/**
 * Validate image size
 * @param {File} file - Image file to validate
 * @returns {boolean} Whether image size is valid
 */
export const validateImageSize = (file) => {
  return validateFileSize(file, FILE_UPLOAD.MAX_IMAGE_SIZE);
};

/**
 * Validate message content
 * @param {string} message - Message to validate
 * @param {Array} images - Optional images array
 * @returns {boolean} Whether message is valid
 */
export const validateMessage = (message, images = []) => {
  const hasText = message && message.trim().length > 0;
  const hasImages = images && images.length > 0;
  return hasText || hasImages;
};

/**
 * Validate session ID format
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} Whether session ID is valid
 */
export const validateSessionId = (sessionId) => {
  // UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return sessionId && uuidRegex.test(sessionId);
};

/**
 * Validate MCP server configuration
 * @param {Object} server - Server configuration to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateMCPServer = (server) => {
  const errors = [];

  if (!server.name || server.name.trim().length === 0) {
    errors.push('Server name is required');
  }

  if (!server.command || server.command.trim().length === 0) {
    errors.push('Server command is required');
  }

  // Validate server name format (alphanumeric and hyphens)
  if (server.name && !/^[a-zA-Z0-9-_]+$/.test(server.name)) {
    errors.push('Server name can only contain letters, numbers, hyphens, and underscores');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate multiple files
 * @param {Array} files - Array of files to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateFiles = (files, options = {}) => {
  const {
    maxFiles = 10,
    allowedTypes = FILE_UPLOAD.ACCEPTED_FILE_TYPES,
    maxSize = FILE_UPLOAD.MAX_FILE_SIZE
  } = options;

  const errors = [];
  const validFiles = [];

  if (files.length > maxFiles) {
    errors.push(`Maximum ${maxFiles} files allowed`);
  }

  files.forEach((file, index) => {
    if (!validateFileType(file, allowedTypes)) {
      errors.push(`File ${index + 1}: Invalid file type`);
    } else if (!validateFileSize(file, maxSize)) {
      errors.push(`File ${index + 1}: File size too large`);
    } else {
      validFiles.push(file);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validFiles
  };
};

export default {
  validateFileType,
  validateImageType,
  validateFileSize,
  validateImageSize,
  validateMessage,
  validateSessionId,
  validateMCPServer,
  validateFiles
};
