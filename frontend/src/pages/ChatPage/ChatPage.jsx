import React, { useCallback, useState, useEffect } from 'react';
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
 * Modern Chat App Style with collapsible sidebar
 */
const ChatPage = () => {
  const { isModalOpen, openModal, closeModal } = useUIContext();
  const { currentSessionId, isConnected } = useSessionContext();
  const { isLoading, currentProgress } = useChatContext();

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // File viewing state
  const [viewingFile, setViewingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
  const [fileContentError, setFileContentError] = useState('');

  // Toggle sidebar collapse
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

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
    directoryStructure,
    loadSessionData
  } = useFileUpload();

  // SSE connection with message handling
  const { sseStatus } = useSSE(
    (data) => {
      const result = handleSSEMessage(data);

      // Handle file system updates
      if (data.type === 'files_updated' || data.type === 'directory_structure_updated') {
        // Reload session data when files change
        loadSessionData().catch(error => {
          console.error('Failed to reload session data after file update:', error);
        });
      }

      return result;
    },
    (error) => {
      console.error('SSE connection error:', error);
    }
  );

  // Load session data when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadSessionData().catch(error => {
        console.error('Failed to load session data:', error);
      });
    }
  }, [currentSessionId, loadSessionData]);

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

  /**
   * Handle file viewing in center area
   */
  const handleViewFile = useCallback(async (file) => {
    setViewingFile(file);
    setIsLoadingFileContent(true);
    setFileContentError('');
    setFileContent('');

    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(
        `${API_BASE_URL}/sessions/${currentSessionId}/files/${encodeURIComponent(file.path)}`,
        {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setFileContent(data.content);
      } else {
        setFileContentError(data.error || 'Failed to load file content');
      }
    } catch (error) {
      setFileContentError('Failed to load file content');
      console.error('File load error:', error);
    } finally {
      setIsLoadingFileContent(false);
    }
  }, [currentSessionId]);

  /**
   * Close file viewer
   */
  const handleCloseFileViewer = useCallback(() => {
    setViewingFile(null);
    setFileContent('');
    setFileContentError('');
    setIsLoadingFileContent(false);
  }, []);

  return (
    <div className="chat-page">
      {/* Floating Sidebar Toggle */}
      <button
        className={`chat-page__sidebar-toggle ${isSidebarCollapsed ? 'chat-page__sidebar-toggle--collapsed' : ''}`}
        onClick={toggleSidebar}
        title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12l6-6 6 6"/>
          <path d="M3 18l6-6 6 6"/>
        </svg>
      </button>

      <div className="chat-page__main">
        {/* Collapsible Session Sidebar */}
        <div className={`chat-page__sidebar ${isSidebarCollapsed ? 'chat-page__sidebar--collapsed' : ''}`}>
          <SessionSidebar
            currentSessionId={currentSessionId}
            onNewSession={handleNewSession}
            onSelectSession={switchToSession}
            onSessionDeleted={deleteSession}
          />
        </div>

        {/* Main Chat Area */}
        <div className={`chat-page__content ${isSidebarCollapsed ? 'chat-page__content--sidebar-collapsed' : ''}`}>
          {/* Modern Header */}
          <div className="chat-page__header">
            <h1 className="chat-page__title">✨ FStratum</h1>
            <div className="chat-page__header-actions">
              <button
                onClick={() => openModal('mcpManager')}
                className="mcp-config-button"
                title="Manage MCP Configuration"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                MCP Config
              </button>
              <ConnectionStatus
                isConnected={isConnected}
                sessionId={currentSessionId}
                status={sseStatus}
              />
            </div>
          </div>

          {/* Modern Chat Interface or File Viewer */}
          {viewingFile ? (
            /* Centralized File Viewer */
            <div className="main-file-viewer">
              <div className="file-viewer-header">
                <div className="file-info">
                  <h2>{viewingFile.name}</h2>
                  <span className="file-details">
                    {viewingFile.type} • {(viewingFile.size / 1024).toFixed(1)} KB • {viewingFile.path}
                  </span>
                </div>
                <button className="close-file-button" onClick={handleCloseFileViewer}>
                  ✕ Close
                </button>
              </div>

              <div className="file-viewer-content">
                {isLoadingFileContent ? (
                  <div className="loading-state">
                    <div className="loading-spinner">⏳</div>
                    <p>Loading file content...</p>
                  </div>
                ) : fileContentError ? (
                  <div className="error-state">
                    <div className="error-icon">⚠️</div>
                    <p>{fileContentError}</p>
                    <button onClick={() => handleViewFile(viewingFile)} className="retry-button">
                      Retry
                    </button>
                  </div>
                ) : fileContent ? (
                  <div className="file-content">
                    <pre>
                      <code>{fileContent}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No content to display</p>
                  </div>
                )}
              </div>

              <div className="file-viewer-actions">
                <button className="copy-content-button" onClick={() => navigator.clipboard.writeText(fileContent)}>
                  📋 Copy Content
                </button>
              </div>
            </div>
          ) : (
            /* Regular Chat Interface */
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
          )}
        </div>

        {/* Modern File Panel */}
        <div className="chat-page__files">
          <FileManager
            files={uploadedFiles}
            directoryStructure={directoryStructure}
            onClearSession={clearSession}
            sessionId={currentSessionId}
            showUploadedOnly={false}
            onViewFile={handleViewFile}
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
