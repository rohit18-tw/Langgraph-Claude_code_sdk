import React, { useState } from 'react';
import axios from 'axios';
import FileItem from './FileItem';
import FileViewer from './FileViewer';
import './FileList.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const FileList = ({ files, onClearSession, sessionId, showUploadedOnly = false }) => {
  const [viewingFile, setViewingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter files based on type
  const filteredFiles = showUploadedOnly
    ? files.filter(file => file.name.includes('_')) // Uploaded files have UUID prefix
    : files.filter(file => !file.name.includes('_')); // Generated files don't

  const displayTitle = showUploadedOnly ? 'Uploaded Files' : 'Generated Files';

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
    <div className={`file-list-container ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="file-list-header">
        <button
          className="file-list-toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? `Show ${displayTitle.toLowerCase()}` : `Hide ${displayTitle.toLowerCase()}`}
        >
          <span className="toggle-arrow">{isCollapsed ? '◀' : '▼'}</span>
          <span className="toggle-text">{displayTitle} ({filteredFiles.length})</span>
        </button>

        {files.length > 0 && !isCollapsed && !showUploadedOnly && (
          <button
            onClick={onClearSession}
            className="clear-session-btn"
            title="Clear all files and chat history"
          >
            Clear
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="file-list-content">
          {filteredFiles.length === 0 ? (
            <div className="no-files">
              <p>{showUploadedOnly ? 'No files uploaded yet' : 'No generated files yet'}</p>
              <small>
                {showUploadedOnly
                  ? 'Upload files to provide context for your questions'
                  : 'Ask Claude to generate code and files will appear here'
                }
              </small>
            </div>
          ) : (
            <div className="file-list">
              {filteredFiles.map((file, index) => (
                <FileItem
                  key={index}
                  file={file}
                  onClick={handleViewFile}
                  showFullName={!showUploadedOnly}
                />
              ))}
            </div>
          )}
        </div>
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
