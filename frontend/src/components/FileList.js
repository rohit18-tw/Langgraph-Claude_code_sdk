import React, { useState } from 'react';
import axios from 'axios';
import FileViewer from './FileViewer';
import './FileList.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const FileList = ({ files, onClearSession, sessionId }) => {
  const [viewingFile, setViewingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState('');
  const [newFilesCount, setNewFilesCount] = useState(0);
  const [showNewFilesIndicator, setShowNewFilesIndicator] = useState(false);

  // Track file updates
  React.useEffect(() => {
    const currentCount = files.length;
    if (currentCount > newFilesCount && newFilesCount > 0) {
      const addedFiles = currentCount - newFilesCount;
      setShowNewFilesIndicator(true);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        setShowNewFilesIndicator(false);
      }, 3000);
    }
    setNewFilesCount(currentCount);
  }, [files.length, newFilesCount]);
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'text': return '📄';
      case 'image': return '🖼️';
      case 'pdf': return '📕';
      case 'archive': return '📦';
      default: return '📄';
    }
  };

  const getFileTypeLabel = (type) => {
    switch (type) {
      case 'text': return 'Text';
      case 'image': return 'Image';
      case 'pdf': return 'PDF';
      case 'archive': return 'Archive';
      default: return 'File';
    }
  };

  const getTotalSize = () => {
    return files.reduce((total, file) => total + file.size, 0);
  };

  const handleViewFile = async (file) => {
    setViewingFile(file);
    setIsLoadingContent(true);
    setContentError('');
    setFileContent('');

    try {
      const response = await axios.get(
        `${API_BASE_URL}/sessions/${sessionId}/files/${encodeURIComponent(file.path)}`,
        {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        }
      );

      if (response.data.success) {
        setFileContent(response.data.content);
      } else {
        setContentError(response.data.error || 'Failed to load file content');
      }
    } catch (error) {
      setContentError('Failed to load file content');
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleCloseViewer = () => {
    setViewingFile(null);
    setFileContent('');
    setContentError('');
    setIsLoadingContent(false);
  };

  return (
    <div className="file-list-container">
      <div className="file-list-header">
        <div className="header-content">
          <h3>📋 Uploaded Files</h3>
          {showNewFilesIndicator && (
            <div className="new-files-indicator">
              ✨ New files created!
            </div>
          )}
        </div>
        {files.length > 0 && (
          <div className="file-list-actions">
            <button
              onClick={onClearSession}
              className="clear-session-btn"
              title="Clear all files and chat history"
            >
              🗑️ Clear Session
            </button>
          </div>
        )}
      </div>

      {files.length === 0 ? (
        <div className="no-files">
          <p>No files uploaded yet</p>
          <small>Upload files to provide context for your questions</small>
        </div>
      ) : (
        <>
          <div className="file-list-summary">
            <div className="summary-item">
              <span className="summary-label">Files:</span>
              <span className="summary-value">{files.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Size:</span>
              <span className="summary-value">{formatFileSize(getTotalSize())}</span>
            </div>
          </div>

          <div className="file-list">
            {files.map((file, index) => (
              <div
                key={index}
                className="file-item clickable"
                onClick={() => handleViewFile(file)}
                title="Click to view file content"
              >
                <div className="file-info">
                  <div className="file-icon-name">
                    <span className="file-icon">{getFileIcon(file.type)}</span>
                    <div className="file-details">
                      <div className="file-name" title={file.name}>
                        {file.name}
                      </div>
                      <div className="file-meta">
                        <span className="file-type">{getFileTypeLabel(file.type)}</span>
                        <span className="file-size">{formatFileSize(file.size)}</span>
                        <span className="file-date">{formatDate(file.modified)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="view-file-indicator">
                    👁️
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}


      {viewingFile && (
        <FileViewer
          file={viewingFile}
          content={fileContent}
          onClose={handleCloseViewer}
          isLoading={isLoadingContent}
          error={contentError}
        />
      )}
    </div>
  );
};

export default FileList;
