import { useCallback } from 'react';
import { useChatContext } from '../../context/ChatContext/ChatContext';
import { useSessionContext } from '../../context/SessionContext/SessionContext';
import { useUIContext } from '../../context/UIContext/UIContext';
import { chatService } from '../../services/api/chat';
import { handleError, createErrorMessage } from '../../utils/errors/errorHandler';
import { validateMessage } from '../../utils/helpers/validators';
import { MESSAGE_TYPES } from '../../utils/constants/messages';

/**
 * Custom hook for chat operations
 */
export const useChat = () => {
  const {
    messages,
    isLoading,
    currentProgress,
    addMessage,
    setLoading,
    setProgress,
    clearMessages,
    loadMessages,
    getLastMessage,
    hasMessages
  } = useChatContext();

  const { currentSessionId } = useSessionContext();
  const { addNotification } = useUIContext();

  /**
   * Send a message
   * @param {string} message - Message content
   * @param {Array} images - Optional images array
   */
  const sendMessage = useCallback(async (message, images = []) => {
    // Validate message
    if (!validateMessage(message, images)) {
      addNotification({
        type: 'error',
        title: 'Invalid Message',
        message: 'Please enter a message or attach images'
      });
      return;
    }

    if (!currentSessionId) {
      addNotification({
        type: 'error',
        title: 'No Session',
        message: 'Please create a session first'
      });
      return;
    }

    try {
      // Add user message immediately
      addMessage(MESSAGE_TYPES.USER, message, { images });

      // Set loading state
      setLoading(true);
      setProgress('Sending message...');

      // Send message via API
      const response = await chatService.sendMessage(currentSessionId, message, images);

      if (response.success) {
        console.log('✅ Message sent successfully, SSE will handle streaming');
        // SSE will handle the streaming response automatically
      } else {
        throw new Error(response.message || 'Failed to send message');
      }

    } catch (error) {
      const parsedError = handleError(error, 'Chat.sendMessage');
      const errorMessage = createErrorMessage(error, 'Failed to send message');

      // Stop loading
      setLoading(false);
      setProgress(null);

      // Add error message
      addMessage(MESSAGE_TYPES.ERROR, errorMessage);

      // Show notification
      addNotification({
        type: 'error',
        title: 'Message Send Failed',
        message: errorMessage
      });

      throw parsedError;
    }
  }, [
    currentSessionId,
    addMessage,
    setLoading,
    setProgress,
    addNotification
  ]);

  /**
   * Clear chat messages
   */
  const clearChat = useCallback(() => {
    clearMessages();
    addNotification({
      type: 'success',
      title: 'Chat Cleared',
      message: 'All messages have been removed'
    });
  }, [clearMessages, addNotification]);

  /**
   * Load chat history
   * @param {string} sessionId - Session ID to load messages for
   */
  const loadChatHistory = useCallback(async (sessionId) => {
    if (!sessionId) return;

    try {
      const response = await chatService.getChatHistory(sessionId);
      loadMessages(response.messages || []);
    } catch (error) {
      const parsedError = handleError(error, 'Chat.loadChatHistory');
      const errorMessage = createErrorMessage(error, 'Failed to load chat history');

      addNotification({
        type: 'error',
        title: 'Load Failed',
        message: errorMessage
      });

      console.error('Failed to load chat history:', parsedError);
    }
  }, [loadMessages, addNotification]);

  /**
   * Handle SSE message events
   * @param {Object} data - SSE event data
   */
  const handleSSEMessage = useCallback((data) => {
    const { type, message, timestamp, ...rest } = data;

    switch (type) {
      case 'verbose':
        // Enhanced verbose messages - update progress
        if (message) {
          // Only show non-file-creation messages as progress
          if (!message.startsWith('Created ')) {
            setProgress(message);
          }

          // Handle file creation by updating progress message
          if (rest.subtype === 'file_created' && message.startsWith('Created ')) {
            const filePath = message.replace('Created ', '');
            setProgress(`created file : ${filePath}`);
          }
        }
        break;

      case 'progress':
        // Filter out unnecessary progress messages
        if (message &&
            !message.includes('Processing your request') &&
            !message.includes('Processing...') &&
            !message.includes('Session Initialized') &&
            !message.includes('Created ') &&
            !message.includes('Creating ')) {
          setProgress(message);
        }
        break;

      case 'text':
        // Just ignore streaming text - wait for final success message
        break;

      case 'success':
        setLoading(false);
        setProgress(null);

        if (rest.result && rest.result.trim()) {
          addMessage(MESSAGE_TYPES.ASSISTANT, rest.result, {
            timestamp,
            metadata: rest.metadata
          });
        }
        break;

      case 'error':
        setLoading(false);
        setProgress(null);
        const errorMsg = message || rest.error || rest.message || 'An error occurred';
        addMessage(MESSAGE_TYPES.ERROR, errorMsg, {
          timestamp,
          ...rest
        });
        break;

      case 'files_updated':
      case 'directory_structure_updated':
        // File system changes - handled by ChatPage, not here
        // Return the data so it can be handled at a higher level
        return data;

      default:
        // Unknown message type, ignore
        break;
    }
  }, [addMessage, setLoading, setProgress]);

  /**
   * Stop generation (frontend only)
   */
  const stopGeneration = useCallback(() => {
    if (isLoading) {
      setLoading(false);
      setProgress(null);

      addNotification({
        type: 'info',
        title: 'Generation Stopped',
        message: 'Code generation has been stopped'
      });
    }
  }, [isLoading, setLoading, setProgress, addNotification]);

  return {
    // State
    messages,
    isLoading,
    currentProgress,
    hasMessages: hasMessages(),
    lastMessage: getLastMessage(),

    // Actions
    sendMessage,
    clearChat,
    loadChatHistory,
    handleSSEMessage,
    stopGeneration
  };
};

export default useChat;
