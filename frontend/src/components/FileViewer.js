import React from 'react';
import './FileViewer.css';

const FileViewer = ({ file, content, onClose, isLoading, error }) => {
  if (!file) return null;

  const getLanguageFromExtension = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'txt': 'text',
      'xml': 'xml',
      'yml': 'yaml',
      'yaml': 'yaml'
    };
    return languageMap[ext] || 'text';
  };

  return (
    <div className="file-viewer-overlay" onClick={onClose}>
      <div className="file-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-viewer-header">
          <div className="file-info">
            <h3>{file.name}</h3>
            <span className="file-details">
              {file.type} • {(file.size / 1024).toFixed(1)} KB
            </span>
          </div>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="file-viewer-content">
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading file content...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <div className="error-icon">⚠️</div>
              <p>{error}</p>
            </div>
          ) : content ? (
            <div className="file-content">
              <pre>
                <code className={`language-${getLanguageFromExtension(file.name)}`}>
                  {content}
                </code>
              </pre>
            </div>
          ) : (
            <div className="empty-state">
              <p>No content to display</p>
            </div>
          )}
        </div>

        <div className="file-viewer-footer">
          <div className="file-actions">
            <button className="copy-button" onClick={() => navigator.clipboard.writeText(content)}>
              📋 Copy Content
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileViewer;
