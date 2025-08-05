import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FileUpload from './components/FileUpload';
import ChatInterface from './components/ChatInterface';
import FileList from './components/FileList';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [sessionId] = useState(() => uuidv4());
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(null);
  const websocketRef = useRef(null);

  useEffect(() => {
    // Initialize WebSocket connection
    connectWebSocket();

    // Load existing files for session
    loadSessionFiles();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [sessionId]);

  const connectWebSocket = () => {
    const wsBaseUrl = process.env.REACT_APP_WS_URL || API_BASE_URL.replace('http', 'ws');
    const wsUrl = `${wsBaseUrl}/ws/${sessionId}`;
    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onopen = () => {
      setIsConnected(true);
    };

    websocketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    websocketRef.current.onclose = () => {
      setIsConnected(false);
      setIsLoading(false);
      setCurrentProgress(null);
      setTimeout(connectWebSocket, 3000);
    };

    websocketRef.current.onerror = (error) => {
      setIsConnected(false);
    };
  };

  const handleWebSocketMessage = (data) => {
    const { type, message, timestamp, ...rest } = data;

    switch (type) {
      case 'status':
        break;
      case 'tool_use':
        break;
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
      default:
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
      const response = await axios.get(`${API_BASE_URL}/sessions/${sessionId}/files`);
      setUploadedFiles(response.data.files || []);
    } catch (error) {
      // Handle error silently
    }
  };

  const handleFileUpload = async (files) => {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await axios.post(
        `${API_BASE_URL}/upload?session_id=${sessionId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Reload session files
      await loadSessionFiles();

      addMessage('system', `Uploaded ${files.length} file(s) successfully`);
      return response.data;
    } catch (error) {
      addMessage('error', `Failed to upload files: ${error.message}`);
      throw error;
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    // Add user message to chat
    addMessage('user', message);
    setIsLoading(true);
    setCurrentProgress('Processing your request...');

    if (isConnected && websocketRef.current) {
      // Send via WebSocket for real-time streaming
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
      await axios.delete(`${API_BASE_URL}/sessions/${sessionId}`);
      setUploadedFiles([]);
      setMessages([]);
      addMessage('system', 'Session cleared successfully');
    } catch (error) {
      addMessage('error', `Failed to clear session: ${error.message}`);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🤖 Claude Code Agent</h1>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span className="session-id">Session: {sessionId.substring(0, 8)}...</span>
        </div>
      </header>

      <main className="App-main">
        <div className="left-panel">
          <FileUpload onFileUpload={handleFileUpload} />
          <FileList
            files={uploadedFiles}
            onClearSession={handleClearSession}
            sessionId={sessionId}
          />
        </div>

        <div className="right-panel">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            isConnected={isConnected}
            currentProgress={currentProgress}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
