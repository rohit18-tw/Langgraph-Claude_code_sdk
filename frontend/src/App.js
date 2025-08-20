import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FileUpload from './components/FileUpload';
import ChatInterface from './components/ChatInterface';
import FileList from './components/FileList';
import ConnectionStatus from './components/ConnectionStatus';
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

  return (
    <div className="App">
      <header className="App-header">
        <h1>FStratum</h1>
        <ConnectionStatus isConnected={isConnected} sessionId={sessionId} />
      </header>

      <main className="App-main">
        <div className="left-panel">
          <FileUpload onFileUpload={handleFileUpload} />
          <FileList
            files={uploadedFiles}
            onClearSession={handleClearSession}
            sessionId={sessionId}
            showUploadedOnly={true}
          />
        </div>

        <div className="right-panel">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            isConnected={isConnected}
            currentProgress={currentProgress}
            onStopGeneration={handleStopGeneration}
          />
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
