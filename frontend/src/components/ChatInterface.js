import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import ImageModal from './ImageModal';
import PermissionModeSelector from './PermissionModeSelector';
import './ChatInterface.css';

const ChatInterface = ({ messages, onSendMessage, onFileUpload, isLoading, isConnected, currentProgress, onStopGeneration, uploadedFiles }) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [imageModal, setImageModal] = useState({ isOpen: false, src: '', name: '' });
  const [selectedImages, setSelectedImages] = useState([]);
  const [permissionMode, setPermissionMode] = useState('acceptEdits');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentProgress]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUploadMenu && !event.target.closest('.upload-container')) {
        setShowUploadMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUploadMenu]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((inputMessage.trim() || selectedImages.length > 0) && !isLoading) {
      // Send message with images and permission mode
      if (selectedImages.length > 0) {
        onSendMessage(inputMessage, selectedImages, permissionMode);
      } else {
        onSendMessage(inputMessage, [], permissionMode);
      }
      setInputMessage('');
      setSelectedImages([]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea like ChatGPT
  const autoResizeTextarea = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    autoResizeTextarea(e.target);
  };

  // Reset textarea height when message is cleared
  useEffect(() => {
    if (inputMessage === '' && inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [inputMessage]);

  // Timestamp and icon functions removed for ChatGPT-style clean interface

  const getMessageClass = (sender) => {
    return `message ${sender}`;
  };

  // Get avatar content based on message sender
  const getAvatarContent = (sender) => {
    switch (sender) {
      case 'user':
        return 'You';
      case 'assistant':
        return 'AI';
      case 'system':
        return 'SYS';
      case 'tool':
        return 'Tool';
      case 'error':
        return '!';
      case 'progress':
        return '⏳';
      default:
        return 'AI';
    }
  };

  const renderMessageContent = (message) => {
    const { sender, content, images } = message;

    return (
      <div>
        {/* Render images if present */}
        {images && images.length > 0 && (
          <div className="message-images">
            {images.map((image, index) => (
              <div key={index} className="message-image-container">
                <img
                  src={image.dataUrl}
                  alt={image.name}
                  className="message-image"
                  style={{maxWidth: '300px', maxHeight: '300px', borderRadius: '8px'}}
                  onClick={() => {
                    console.log('Image clicked:', image.name);
                    setImageModal({
                      isOpen: true,
                      src: image.dataUrl,
                      name: image.name
                    });
                  }}
                />
                <div className="image-name">{image.name}</div>
              </div>
            ))}
          </div>
        )}

        {/* Render text content only if it exists and is not empty */}
        {content && content.trim() && (
          sender === 'assistant' || sender === 'system'
            ? <ReactMarkdown>{content}</ReactMarkdown>
            : <div className="message-text">{content}</div>
        )}
      </div>
    );
  };

  // Metadata rendering removed as per user request
  const renderMetadata = (metadata) => {
    return null;
  };

  const handleFileUploadClick = () => {
    setShowUploadMenu(!showUploadMenu);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && onFileUpload) {
      try {
        await onFileUpload(files);
        e.target.value = ''; // Reset file input
        setShowUploadMenu(false);
      } catch (error) {
        console.error('File upload failed:', error);
      }
    }
  };

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      try {
        const imagePromises = files.map(file => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({
              name: file.name,
              dataUrl: e.target.result,
              size: file.size
            });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        });

        const newImages = await Promise.all(imagePromises);
        setSelectedImages(prev => [...prev, ...newImages]);
        e.target.value = ''; // Reset file input
        setShowUploadMenu(false);
      } catch (error) {
        console.error('Image processing failed:', error);
      }
    }
  };

  const handleUploadFiles = () => {
    fileInputRef.current?.click();
    setShowUploadMenu(false);
  };

  const handleUploadImages = () => {
    imageInputRef.current?.click();
    setShowUploadMenu(false);
  };

  const handleUploadFolder = () => {
    folderInputRef.current?.click();
    setShowUploadMenu(false);
  };

  const removeSelectedImage = (indexToRemove) => {
    setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="chat-interface">

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
                {/* Message Avatar */}
                <div className="message-avatar">
                  {getAvatarContent(message.sender)}
                </div>

                {/* Message Content */}
                <div className="message-content">
                  {renderMessageContent(message)}
                  {renderMetadata(message.metadata)}
                </div>
              </div>
            ))}

            {/* Single updating progress display */}
            {currentProgress && (
              <div className="message progress">
                {/* Progress Avatar */}
                <div className="message-avatar">
                  {getAvatarContent('progress')}
                </div>

                {/* Progress Content */}
                <div className="message-content">
                  <div className="progress-content">
                    <div className="progress-spinner"></div>
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
        {/* Image Previews */}
        {selectedImages.length > 0 && (
          <div className="selected-images-preview">
            {selectedImages.map((image, index) => (
              <div key={index} className="selected-image-container">
                <img
                  src={image.dataUrl}
                  alt={image.name}
                  className="selected-image-preview"
                />
                <button
                  type="button"
                  onClick={() => removeSelectedImage(index)}
                  className="remove-image-button"
                  title="Remove image"
                >
                  ×
                </button>
                <div className="selected-image-name">{image.name}</div>
              </div>
            ))}
          </div>
        )}

        {/* Compact Permission Mode Selector */}
        <div className="input-controls">
          <PermissionModeSelector
            selectedMode={permissionMode}
            onModeChange={setPermissionMode}
            disabled={isLoading}
          />
        </div>

        <div className="input-container">
          <div className="upload-container">
            <button
              type="button"
              onClick={handleFileUploadClick}
              className="file-upload-button"
              title="Upload files"
              disabled={isLoading}
            >
              +
            </button>

            {/* Upload Menu */}
            {showUploadMenu && (
              <div className="upload-menu">
                <button
                  type="button"
                  onClick={handleUploadFiles}
                  className="upload-option"
                >
                  📄 Upload Files
                </button>
                <button
                  type="button"
                  onClick={handleUploadImages}
                  className="upload-option"
                >
                  🖼️ Upload Images
                </button>
                <button
                  type="button"
                  onClick={handleUploadFolder}
                  className="upload-option"
                >
                  📁 Upload Folder
                </button>
              </div>
            )}

            {/* Hidden File Inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden-file-input"
              accept=".txt,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.xml,.yml,.yaml,.pdf"
            />

            <input
              ref={imageInputRef}
              type="file"
              multiple
              onChange={handleImageChange}
              className="hidden-file-input"
              accept=".png,.jpg,.jpeg,.gif,.bmp,.svg,.webp"
            />

            <input
              ref={folderInputRef}
              type="file"
              multiple
              webkitdirectory=""
              onChange={handleFileChange}
              className="hidden-file-input"
            />
          </div>

          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={handleInputChange}
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
          </div>

          <button
            type="submit"
            disabled={(!inputMessage.trim() && selectedImages.length === 0) || isLoading}
            className="send-button"
          >
            {isLoading ? '●' : '→'}
          </button>
        </div>

        {/* Show uploaded files count */}
        {uploadedFiles && uploadedFiles.length > 0 && (
          <div className="uploaded-files-indicator">
            <span className="files-count">{uploadedFiles.length} file(s) uploaded</span>
          </div>
        )}

        {inputMessage.length > 0 && (
          <div className="input-stats">
            Characters: {inputMessage.length}
          </div>
        )}
      </form>

      {/* Image Modal */}
      <ImageModal
        isOpen={imageModal.isOpen}
        onClose={() => setImageModal({ isOpen: false, src: '', name: '' })}
        imageSrc={imageModal.src}
        imageName={imageModal.name}
      />
    </div>
  );
};

export default ChatInterface;
