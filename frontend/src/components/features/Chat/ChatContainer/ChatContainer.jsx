import React from 'react';
import { useChatContext } from '../../../../context/ChatContext/ChatContext';
import { useSessionContext } from '../../../../context/SessionContext/SessionContext';

// Temporary wrapper around existing ChatInterface
import OriginalChatInterface from '../../../ChatInterface';

/**
 * Enhanced Chat Container with new architecture
 * Currently wraps existing component while migration is in progress
 */
const ChatContainer = ({ onSendMessage, onFileUpload, onStopGeneration, ...props }) => {
  const { messages, isLoading, currentProgress } = useChatContext();
  const { isConnected, uploadedFiles } = useSessionContext();

  return (
    <OriginalChatInterface
      messages={messages}
      onSendMessage={onSendMessage}
      onFileUpload={onFileUpload}
      isLoading={isLoading}
      isConnected={isConnected}
      currentProgress={currentProgress}
      onStopGeneration={onStopGeneration}
      uploadedFiles={uploadedFiles}
      {...props}
    />
  );
};

export default ChatContainer;
