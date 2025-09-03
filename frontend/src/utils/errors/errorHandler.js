/**
 * Error handling utilities
 */

// Error types
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  API: 'API_ERROR',
  FILE_UPLOAD: 'FILE_UPLOAD_ERROR',
  SSE: 'SSE_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * Parse and categorize errors
 * @param {Error|Object} error - Error to parse
 * @returns {Object} Parsed error with type and message
 */
export const parseError = (error) => {
  // Network errors
  if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
    return {
      type: ERROR_TYPES.NETWORK,
      message: 'Network connection failed. Please check your internet connection.',
      originalError: error
    };
  }

  // API errors
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    let message = 'An error occurred';
    if (data?.message) {
      message = data.message;
    } else if (data?.error) {
      message = data.error;
    } else {
      switch (status) {
        case 400:
          message = 'Bad request. Please check your input.';
          break;
        case 401:
          message = 'Unauthorized. Please check your credentials.';
          break;
        case 403:
          message = 'Forbidden. You do not have permission to perform this action.';
          break;
        case 404:
          message = 'Resource not found.';
          break;
        case 500:
          message = 'Internal server error. Please try again later.';
          break;
        default:
          message = `Server error: ${status}`;
      }
    }

    return {
      type: ERROR_TYPES.API,
      message,
      status,
      originalError: error
    };
  }

  // File upload errors
  if (error.message?.includes('file') || error.message?.includes('upload')) {
    return {
      type: ERROR_TYPES.FILE_UPLOAD,
      message: error.message || 'File upload failed',
      originalError: error
    };
  }

  // SSE errors
  if (error.message?.includes('SSE') || error.message?.includes('EventSource')) {
    return {
      type: ERROR_TYPES.SSE,
      message: error.message || 'Connection error',
      originalError: error
    };
  }

  // Validation errors
  if (error.type === 'validation' || error.errors) {
    return {
      type: ERROR_TYPES.VALIDATION,
      message: error.message || 'Validation failed',
      errors: error.errors,
      originalError: error
    };
  }

  // Unknown errors
  return {
    type: ERROR_TYPES.UNKNOWN,
    message: error.message || 'An unexpected error occurred',
    originalError: error
  };
};

/**
 * Format error for display
 * @param {Object} parsedError - Parsed error object
 * @returns {string} Formatted error message
 */
export const formatErrorMessage = (parsedError) => {
  const { type, message, errors } = parsedError;

  if (type === ERROR_TYPES.VALIDATION && errors && errors.length > 0) {
    return `${message}: ${errors.join(', ')}`;
  }

  return message;
};

/**
 * Handle and log errors
 * @param {Error|Object} error - Error to handle
 * @param {string} context - Context where error occurred
 * @returns {Object} Parsed error
 */
export const handleError = (error, context = 'Unknown') => {
  const parsedError = parseError(error);

  // Log error with context
  console.error(`[${context}] ${parsedError.type}:`, parsedError.message, parsedError.originalError);

  // Could integrate with error reporting service here
  // reportErrorToService(parsedError, context);

  return parsedError;
};

/**
 * Create error message for user display
 * @param {Error|Object} error - Error to process
 * @param {string} defaultMessage - Default message if error can't be parsed
 * @returns {string} User-friendly error message
 */
export const createErrorMessage = (error, defaultMessage = 'An unexpected error occurred') => {
  try {
    const parsedError = parseError(error);
    return formatErrorMessage(parsedError);
  } catch (e) {
    console.error('Error parsing error:', e);
    return defaultMessage;
  }
};

/**
 * Retry wrapper for async operations
 * @param {Function} operation - Async operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise} Operation result
 */
export const withRetry = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
    }
  }

  throw lastError;
};

export default {
  ERROR_TYPES,
  parseError,
  formatErrorMessage,
  handleError,
  createErrorMessage,
  withRetry
};
