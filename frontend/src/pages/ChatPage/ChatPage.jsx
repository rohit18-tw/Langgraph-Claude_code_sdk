import React, { useEffect, useCallback } from 'react';
import { useUIContext } from '../../context/UIContext/UIContext';
import { useSessionContext } from '../../context/SessionContext/SessionContext';
import { useChatContext } from '../../context/ChatContext/ChatContext';
import { useChat } from '../../hooks/api/useChat';
import { useSession } from '../../hooks/api/useSession';
import { useFileUpload } from '../../hooks/api/useFileUpload';
import { useSSE } from '../../hooks/ui/useSSE';

// Import components (we'll create these next)
import SessionSidebar from '../../components/features/Session/SessionSidebar/SessionSidebar';
import ChatContainer from '../../components/features/Chat/ChatContainer/ChatContainer';
import FileManager from '../../components/features/FileManager/FileManager';
import MCPManager from '../../components/features/MCP/MCPManager/MCPManager';
import ConnectionStatus from '../../components/layout/Header/ConnectionStatus';

import './ChatPage.css';

/**
 * Main Chat Page Component
 * Orchestrates the chat interface with all its features
 */
const ChatPage = () => {
  const { isModalOpen, openModal, closeModal } = useUIContext();
  const { currentSessionId, isConnected } = useSessionContext();
  const { isLoading, currentProgress } = useChatContext();

  // Custom hooks
  const {
    messages,
    sendMessage,
    stopGeneration,
    handleSSEMessage
  } = useChat();

  const {
    handleNewSession,
    switchToSession,
    deleteSession,
    clearSession
  } = useSession();

  const {
    uploadFiles,
    processImages,
    uploadedFiles,
    directoryStructure
  } = useFileUpload();

  // SSE connection with message handling
  const { sseStatus } = useSSE(
    handleSSEMessage,
    (error) => {
      console.error('SSE connection error:', error);
    }
  );

  /**
   * Handle file upload
   */
  const handleFileUpload = useCallback(async (files) => {
    try {
      await uploadFiles(files);
    } catch (error) {
      console.error('File upload failed:', error);
    }
  }, [uploadFiles]);

  /**
   * Handle message send with images
   */
  const handleSendMessage = useCallback(async (message, imageFiles = null) => {
    let processedImages = [];

    // Process images if provided
    if (imageFiles && imageFiles.length > 0) {
      processedImages = await processImages(imageFiles);
    }

    // Send message
    await sendMessage(message, processedImages);
  }, [sendMessage, processImages]);

  /**
   * Handle MCP config update
   */
  const handleMCPConfigUpdate = useCallback((config) => {
    console.log('MCP configuration updated:', config);
    // MCP configuration updated - could trigger notifications if needed
  }, []);

  return (
    <div className="chat-page">
      <div className="chat-page__main">
        {/* Session Sidebar */}
        <SessionSidebar
          currentSessionId={currentSessionId}
          onNewSession={handleNewSession}
          onSelectSession={switchToSession}
          onSessionDeleted={deleteSession}
        />

        {/* Main Chat Area */}
        <div className="chat-page__content">
          {/* Header */}
          <div className="chat-page__header">
            <h1 className="chat-page__title">FStratum</h1>
            <div className="chat-page__header-actions">
              <button
                onClick={() => openModal('mcpManager')}
                className="mcp-config-button"
                title="Manage MCP Configuration"
              >
                ⚙️ MCP Config
              </button>
              <ConnectionStatus
                isConnected={isConnected}
                sessionId={currentSessionId}
                status={sseStatus}
              />
            </div>
          </div>

          {/* Chat Interface */}
          <ChatContainer
            messages={messages}
            onSendMessage={handleSendMessage}
            onFileUpload={handleFileUpload}
            isLoading={isLoading}
            isConnected={isConnected}
            currentProgress={currentProgress}
            onStopGeneration={stopGeneration}
            uploadedFiles={uploadedFiles}
          />
        </div>

        {/* File Panel */}
        <div className="chat-page__files">
          <FileManager
            files={uploadedFiles}
            directoryStructure={directoryStructure}
            onClearSession={clearSession}
            sessionId={currentSessionId}
            showUploadedOnly={false}
          />
        </div>
      </div>

      {/* MCP Configuration Manager Modal */}
      <MCPManager
        isOpen={isModalOpen('mcpManager')}
        onClose={() => closeModal('mcpManager')}
        onConfigUpdate={handleMCPConfigUpdate}
      />
    </div>
  );
};

export default ChatPage;
