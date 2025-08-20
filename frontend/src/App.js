import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import SessionSidebar from './components/SessionSidebar';
import ChatInterface from './components/ChatInterface';
import FileList from './components/FileList';
import ConnectionStatus from './components/ConnectionStatus';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [sessionId, setSessionId] = useState(() => uuidv4());
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(null);
  const websocketRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    loadSessionFiles();
    return () => websocketRef.current?.close();
  }, [sessionId]);

  const connectWebSocket = () => {
    const wsBaseUrl = process.env.REACT_APP_WS_URL ||
      API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const wsUrl = `${wsBaseUrl}/ws/${sessionId}`;
    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onopen = () => setIsConnected(true);
    websocketRef.current.onclose = () => {
      setIsConnected(false);
      setIsLoading(false);
      setCurrentProgress(null);
      setTimeout(connectWebSocket, 3000);
    };
    websocketRef.current.onerror = () => setIsConnected(false);
    websocketRef.current.onmessage = (event) => {
      handleWebSocketMessage(JSON.parse(event.data));
    };
  };

  const handleWebSocketMessage = (data) => {
    const { type, message, timestamp, ...rest } = data;

    switch (type) {
      case 'file_generation':
        setCurrentProgress(message || 'Processing...');
        break;
      case 'success':
        setCurrentProgress(null);
        addMessage('assistant', message || rest.result || 'Task completed successfully!', {
          timestamp,
          metadata: rest.metadata
        });
        setIsLoading(false);
        break;
      case 'error':
        setCurrentProgress(null);
        addMessage('error', message || 'An error occurred', { timestamp, ...rest });
        setIsLoading(false);
        break;
      case 'files_updated':
        setUploadedFiles(rest.files || []);
        break;
    }
  };

  const addMessage = (sender, content, metadata = {}) => {
    const newMessage = {
      id: uuidv4(),
      sender,
      content,
      timestamp: metadata.timestamp || new Date().toISOString(),
      metadata
    };
    setMessages(prev => [...prev, newMessage]);
  };

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

      await loadSessionFiles();
      addMessage('system', `Uploaded ${files.length} file(s) successfully`);
    } catch (error) {
      addMessage('error', `Failed to upload files: ${error.message}`);
      throw error;
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    addMessage('user', message);
    setIsLoading(true);
    setCurrentProgress('Processing your request...');

    if (isConnected && websocketRef.current) {
      websocketRef.current.send(JSON.stringify({
        message: message,
        session_id: sessionId
      }));
    } else {
      // Fallback to HTTP API
      try {
        const response = await axios.post(`${API_BASE_URL}/chat`, {
          message: message,
          session_id: sessionId,
          uploaded_files: uploadedFiles.map(f => f.path)
        });

        if (response.data.success) {
          addMessage('assistant', response.data.message, {
            metadata: response.data.metadata
          });
        } else {
          addMessage('error', response.data.message);
        }
      } catch (error) {
        addMessage('error', `Failed to send message: ${error.message}`);
      } finally {
        setIsLoading(false);
        setCurrentProgress(null);
      }
    }
  };

  const handleClearSession = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/sessions/${sessionId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      setUploadedFiles([]);
      setMessages([]);
      addMessage('system', 'Session cleared successfully');
    } catch (error) {
      addMessage('error', `Failed to clear session: ${error.message}`);
    }
  };

  const handleStopGeneration = () => {
    if (websocketRef.current && isLoading) {
      websocketRef.current.close();
      setIsLoading(false);
      setCurrentProgress(null);
      addMessage('system', 'Code generation stopped by user');
      setTimeout(connectWebSocket, 1000);
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

    // Add welcome message to new session
    setTimeout(() => {
      addMessage('system', 'New session started');
    }, 100);
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

      // Add welcome message to new session
      setTimeout(() => {
        addMessage('system', 'Previous session was deleted. New session started.');
      }, 100);
    }
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
            <ConnectionStatus isConnected={isConnected} sessionId={sessionId} />
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
    </div>
  );
}

export default App;
