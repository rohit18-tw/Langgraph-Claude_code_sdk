import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import SessionSidebar from './components/SessionSidebar';
import ChatInterface from './components/ChatInterface';
import FileList from './components/FileList';
import ConnectionStatus from './components/ConnectionStatus';
import MCPManager from './components/MCPManager';
import useSSE from './hooks/useSSE';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [sessionId, setSessionId] = useState(() => uuidv4());
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(null);
  const [showMCPManager, setShowMCPManager] = useState(false);

  // Helper function to add messages
  const addMessage = (sender, content, metadata = {}) => {
    const newMessage = {
      id: uuidv4(),
      sender,
      content,
      timestamp: metadata.timestamp || new Date().toISOString(),
      images: metadata.images || null,
      metadata
    };
    setMessages(prev => [...prev, newMessage]);
  };

    // SSE Message Handlers (defined before useSSE hook)
  const handleSSEMessage = useCallback((data) => {
    const { type, message, timestamp, ...rest } = data;

    switch (type) {
      case 'verbose':
        // Enhanced verbose messages - this is what we want!
        if (message) {
          setCurrentProgress(message);
        }
        break;
      case 'progress':
        // Only show meaningful progress messages
        if (message &&
            !message.includes('Processing your request') &&
            !message.includes('Processing...') &&
            !message.includes('Session Initialized')) {
          setCurrentProgress(message);
        }
        break;
      case 'text':
        // Streaming text content from Claude - don't add message here
        // Wait for 'success' event which has the complete response with metadata
        break;
      case 'files_updated':
        setUploadedFiles(rest.files || []);
        if (rest.new_files && rest.new_files.length > 0) {
          setCurrentProgress(`📁 Created ${rest.new_files.length} new file(s)`);
          setTimeout(() => setCurrentProgress(null), 3000);
        }
        break;
      case 'success':
        setIsLoading(false);
        setCurrentProgress(null);
        if (rest.result && rest.result.trim()) {
          addMessage('assistant', rest.result, { timestamp, metadata: rest.metadata });
        }
        break;
      case 'error':
        setIsLoading(false);
        setCurrentProgress(null);
        addMessage('error', message || rest.error || rest.message || 'An error occurred', {
          timestamp,
          ...rest
        });
        break;
      default:
        // Unknown message type, ignore
    }
  }, [addMessage]);

  const handleSSEError = useCallback((error) => {
    addMessage('error', `Connection error: ${error}`);
    setIsConnected(false);
  }, [addMessage]);

  // Initialize SSE hook with handlers
  const { sseStatus } = useSSE(sessionId, handleSSEMessage, handleSSEError);

  // Update connection status based on SSE
  useEffect(() => {
    setIsConnected(sseStatus === 'connected');
  }, [sseStatus]);

  useEffect(() => {
    // Load session files on session change
    const hasExistingData = localStorage.getItem(`session_${sessionId}`);
    if (hasExistingData) {
      loadSessionFiles();
    }
  }, [sessionId]);



  const loadSessionFiles = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sessions/${sessionId}/files`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      setUploadedFiles(response.data.files || []);
    } catch (error) {
      console.error('Error loading session files:', error);
      addMessage('error', `Failed to load files: ${error.message}`);
    }
  };

  const handleFileUpload = async (files) => {
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      await axios.post(`${API_BASE_URL}/upload?session_id=${sessionId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'ngrok-skip-browser-warning': 'true'
        },
      });

      await loadSessionFiles(); // Only call this AFTER files are actually uploaded
    } catch (error) {
      addMessage('error', `Failed to upload files: ${error.message}`);
      throw error;
    }
  };

  const handleSendMessage = async (message, images = null) => {
    if (!message.trim() && (!images || images.length === 0)) return;

    try {
      // Add user message immediately
      if (images && images.length > 0) {
        addMessage('user', message, { images: images });
      } else {
        addMessage('user', message);
      }

      setIsLoading(true);
      setCurrentProgress('Sending message...');

      // Send message via new SSE endpoint
      const response = await axios.post(`${API_BASE_URL}/chat/sse`, {
        session_id: sessionId,
        message: message,
        images: images || []
      }, {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (response.data.success) {
        console.log('✅ Message sent successfully, SSE will handle streaming');
        // SSE will handle the streaming response automatically
      } else {
        throw new Error(response.data.message || 'Failed to send message');
      }

    } catch (error) {
      console.error('❌ Error sending message:', error);
      setIsLoading(false);
      setCurrentProgress(null);
      addMessage('error', `Failed to send message: ${error.message}`);
    }
  };



  const handleClearSession = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/sessions/${sessionId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      setUploadedFiles([]);
      setMessages([]);
    } catch (error) {
      addMessage('error', `Failed to clear session: ${error.message}`);
    }
  };

  const handleStopGeneration = () => {
    if (isLoading) {
      setIsLoading(false);
      setCurrentProgress(null);
      // Note: With SSE, we can't easily stop server-side processing
      // But we can stop showing progress on the frontend
    }
  };

  const handleNewSession = (saveCurrentSession) => {
    // Save current session data (messages and files)
    saveSessionData(sessionId, messages, uploadedFiles);

    // Save session metadata for sidebar
    if (saveCurrentSession && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const sessionMetadata = {
        id: sessionId,
        title: messages.find(m => m.sender === 'user')?.content.substring(0, 50) || 'New Session',
        lastMessage: lastMessage?.content?.substring(0, 100) || 'No messages',
        timestamp: new Date().toISOString(),
        messageCount: messages.filter(m => m.sender === 'user' || m.sender === 'assistant').length
      };
      saveCurrentSession(sessionMetadata);
    }

    // Create new session
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    setMessages([]);
    setUploadedFiles([]);


  };

  const saveSessionData = (sessionIdToSave, messagesToSave, filesToSave) => {
    const sessionData = {
      messages: messagesToSave,
      uploadedFiles: filesToSave,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(`session_${sessionIdToSave}`, JSON.stringify(sessionData));
  };

  const loadSessionData = (sessionIdToLoad) => {
    const sessionData = localStorage.getItem(`session_${sessionIdToLoad}`);
    if (sessionData) {
      const { messages: savedMessages, uploadedFiles: savedFiles } = JSON.parse(sessionData);
      setMessages(savedMessages || []);
      setUploadedFiles(savedFiles || []);
    } else {
      setMessages([]);
      setUploadedFiles([]);
    }
  };

  const handleSelectSession = (selectedSessionId) => {
    if (selectedSessionId === sessionId) return; // Already on this session

    // Save current session data
    saveSessionData(sessionId, messages, uploadedFiles);

    // Update session metadata in sessions list
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const sessionMetadata = {
        id: sessionId,
        title: messages.find(m => m.sender === 'user')?.content.substring(0, 50) || 'New Session',
        lastMessage: lastMessage?.content?.substring(0, 100) || 'No messages',
        timestamp: new Date().toISOString(),
        messageCount: messages.filter(m => m.sender === 'user' || m.sender === 'assistant').length
      };

      const savedSessions = localStorage.getItem('chatSessions');
      let sessions = savedSessions ? JSON.parse(savedSessions) : [];
      const existingIndex = sessions.findIndex(s => s.id === sessionId);
      if (existingIndex >= 0) {
        sessions[existingIndex] = { ...sessions[existingIndex], ...sessionMetadata };
      } else {
        sessions.unshift(sessionMetadata);
      }
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
    }

    // Switch to selected session
    setSessionId(selectedSessionId);

    // Load the selected session's data
    loadSessionData(selectedSessionId);
  };

  const handleSessionDeleted = (deletedSessionId) => {
    // If the current session was deleted, switch to a new session
    if (deletedSessionId === sessionId) {
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
      setMessages([]);
      setUploadedFiles([]);


    }
  };

  const handleMCPConfigUpdate = (config) => {
    // MCP configuration updated - no message needed
  };

  return (
    <div className="App">
      <main className="App-main">
        <SessionSidebar
          currentSessionId={sessionId}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onSessionDeleted={handleSessionDeleted}
        />

        <div className="chat-container">
          <div className="chat-header">
            <h1>FStratum</h1>
            <div className="header-actions">
              <button
                onClick={() => setShowMCPManager(true)}
                className="mcp-config-button"
                title="Manage MCP Configuration"
              >
                ⚙️ MCP Config
              </button>
              <ConnectionStatus isConnected={isConnected} sessionId={sessionId} />
            </div>
          </div>

          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            onFileUpload={handleFileUpload}
            isLoading={isLoading}
            isConnected={isConnected}
            currentProgress={currentProgress}
            onStopGeneration={handleStopGeneration}
            uploadedFiles={uploadedFiles}
          />
        </div>

        <div className="files-panel">
          <FileList
            files={uploadedFiles}
            onClearSession={handleClearSession}
            sessionId={sessionId}
            showUploadedOnly={false}
          />
        </div>
      </main>

      {/* MCP Configuration Manager Modal */}
      <MCPManager
        isOpen={showMCPManager}
        onClose={() => setShowMCPManager(false)}
        onConfigUpdate={handleMCPConfigUpdate}
      />
    </div>
  );
}

export default App;
