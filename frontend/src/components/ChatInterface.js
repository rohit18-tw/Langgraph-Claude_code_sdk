import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './ChatInterface.css';

const ChatInterface = ({ messages, onSendMessage, isLoading, isConnected, currentProgress, onStopGeneration }) => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentProgress]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && !isLoading) {
      onSendMessage(inputMessage);
      setInputMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageIcon = (sender) => {
    switch (sender) {
      case 'user': return 'U';
      case 'assistant': return 'A';
      case 'system': return 'S';
      case 'tool': return 'T';
      case 'progress': return 'P';
      case 'error': return 'E';
      default: return 'M';
    }
  };

  const getMessageClass = (sender) => {
    return `message ${sender}`;
  };

  const renderMessageContent = (message) => {
    const { sender, content } = message;

    if (sender === 'assistant' || sender === 'system') {
      return <ReactMarkdown>{content}</ReactMarkdown>;
    }

    return <div className="message-text">{content}</div>;
  };

  const renderMetadata = (metadata) => {
    if (!metadata) return null;

    return (
      <div className="message-metadata">
        {metadata.metadata && (
          <div className="execution-stats">
            {metadata.metadata.duration_ms && (
              <span>{metadata.metadata.duration_ms}ms</span>
            )}
            {metadata.metadata.num_turns && (
              <span>{metadata.metadata.num_turns} turns</span>
            )}
            {metadata.metadata.total_cost_usd && (
              <span>${metadata.metadata.total_cost_usd.toFixed(4)}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h3>AI Assistant</h3>
        <div className="chat-status">
          {isLoading && <span className="loading-indicator">Processing...</span>}
          {!isConnected && <span className="connection-warning">Offline Mode</span>}
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <div className="welcome-content">
              <h4>Welcome to FStratum!</h4>
              <p>Upload your files and start analyzing your codebase.</p>
              <div className="example-prompts">
                <p><strong>Try asking:</strong></p>
                <ul>
                  <li>"Analyze the uploaded code and suggest improvements"</li>
                  <li>"Create new components based on the uploaded design"</li>
                  <li>"Identify and fix potential issues in the code"</li>
                  <li>"Generate comprehensive documentation"</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={getMessageClass(message.sender)}>
                <div className="message-header">
                  <span className="message-icon">{getMessageIcon(message.sender)}</span>
                  <span className="message-sender">
                    {message.sender.charAt(0).toUpperCase() + message.sender.slice(1)}
                  </span>
                  <span className="message-timestamp">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                <div className="message-content">
                  {renderMessageContent(message)}
                  {renderMetadata(message.metadata)}
                </div>
              </div>
            ))}

            {/* Single updating progress display */}
            {currentProgress && (
              <div className="message progress">
                <div className="message-header">
                  <span className="message-icon">P</span>
                  <span className="message-sender">Progress</span>
                  <span className="message-timestamp">
                    {formatTimestamp(Date.now())}
                  </span>
                </div>
                <div className="message-content">
                  <div className="progress-content">
                    <div className="progress-spinner">●</div>
                    <div className="progress-text">{currentProgress}</div>
                    {onStopGeneration && (
                      <button
                        onClick={onStopGeneration}
                        className="stop-button"
                        title="Stop code generation"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-form" onSubmit={handleSubmit}>
        <div className="input-container">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              isConnected
                ? "Type your message... (Shift+Enter for new line)"
                : "Offline - messages will be sent when connection is restored"
            }
            disabled={isLoading}
            rows={1}
            className="message-input"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="send-button"
          >
            {isLoading ? '●' : 'Send'}
          </button>
        </div>

        {inputMessage.length > 0 && (
          <div className="input-stats">
            Characters: {inputMessage.length}
          </div>
        )}
      </form>
    </div>
  );
};

export default ChatInterface;
