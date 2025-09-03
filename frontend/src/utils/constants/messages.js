/**
 * Message-related constants
 */

// Message types
export const MESSAGE_TYPES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  TOOL: 'tool',
  PROGRESS: 'progress',
  ERROR: 'error'
};

// SSE Event types
export const SSE_EVENT_TYPES = {
  CONNECTED: 'connected',
  VERBOSE: 'verbose',
  PROGRESS: 'progress',
  TEXT: 'text',
  FILES_UPDATED: 'files_updated',
  DIRECTORY_STRUCTURE_UPDATED: 'directory_structure_updated',
  SUCCESS: 'success',
  ERROR: 'error',
  PING: 'ping'
};

// Message icons mapping
export const MESSAGE_ICONS = {
  [MESSAGE_TYPES.USER]: 'U',
  [MESSAGE_TYPES.ASSISTANT]: 'A',
  [MESSAGE_TYPES.SYSTEM]: 'S',
  [MESSAGE_TYPES.TOOL]: 'T',
  [MESSAGE_TYPES.PROGRESS]: 'P',
  [MESSAGE_TYPES.ERROR]: 'E'
};

// Connection status
export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  FAILED: 'failed',
  CONNECTING: 'connecting'
};

// File upload constants
export const FILE_UPLOAD = {
  ACCEPTED_FILE_TYPES: '.txt,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.xml,.yml,.yaml,.pdf',
  ACCEPTED_IMAGE_TYPES: '.png,.jpg,.jpeg,.gif,.bmp,.svg,.webp',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024   // 5MB
};

export default {
  MESSAGE_TYPES,
  SSE_EVENT_TYPES,
  MESSAGE_ICONS,
  CONNECTION_STATUS,
  FILE_UPLOAD
};
