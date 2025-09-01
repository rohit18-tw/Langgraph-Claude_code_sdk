import React, { useState } from 'react';
import axios from 'axios';
import FileItem from './FileItem';
import FileViewer from './FileViewer';
import './FileList.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Build nested tree structure from file paths
const buildNestedTree = (files) => {
  const tree = {};

  files.forEach(file => {
    if (!file.path.includes('/')) {
      // Root level file
      if (!tree['__root__']) tree['__root__'] = [];
      tree['__root__'].push(file);
      return;
    }

    const pathParts = file.path.split('/');
    let current = tree;

    // Build nested structure
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part]) {
        current[part] = { __files__: [], __dirs__: {} };
      }
      current = current[part].__dirs__;
    }

    // Add file to final directory
    const finalDir = pathParts[pathParts.length - 2];
    if (!tree[pathParts[0]]) {
      tree[pathParts[0]] = { __files__: [], __dirs__: {} };
    }

    // Navigate to correct nested location and add file
    let target = tree;
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!target[part]) {
        target[part] = { __files__: [], __dirs__: {} };
      }
      if (i === pathParts.length - 2) {
        target[part].__files__.push(file);
      } else {
        target = target[part].__dirs__;
      }
    }
  });

  return tree;
};

// Component to render files in a tree structure
const FileTreeView = ({ files, onFileClick }) => {
  const tree = buildNestedTree(files);

  return (
    <>
      {/* Root level files */}
      {tree['__root__'] && tree['__root__'].map((file, index) => (
        <FileItem
          key={`root-${index}`}
          file={file}
          onClick={onFileClick}
          showFullName={true}
        />
      ))}

      {/* Directory structure */}
      {Object.entries(tree).filter(([key]) => key !== '__root__').map(([dirName, dirData]) => (
        <NestedDirectory
          key={dirName}
          name={dirName}
          data={dirData}
          level={0}
          onFileClick={onFileClick}
        />
      ))}
    </>
  );
};

// Component for nested directory structure
const NestedDirectory = ({ name, data, level, onFileClick }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const indentPx = level * 20;

  const files = data.__files__ || [];
  const subdirs = data.__dirs__ || {};
  const totalFiles = files.length + Object.values(subdirs).reduce((sum, subdir) =>
    sum + (subdir.__files__?.length || 0), 0
  );

  return (
    <div className="nested-directory">
      <div
        className="nested-folder-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ paddingLeft: `${indentPx}px` }}
      >
        <span className="folder-icon">{isExpanded ? '📂' : '📁'}</span>
        <span className="folder-name">{name}</span>
        <span className="folder-toggle">{isExpanded ? '▼' : '▶'}</span>
        <span className="file-count">({totalFiles})</span>
      </div>

      {isExpanded && (
        <div className="nested-folder-contents">
          {/* Render subdirectories first */}
          {Object.entries(subdirs).map(([subdirName, subdirData]) => (
            <NestedDirectory
              key={subdirName}
              name={subdirName}
              data={subdirData}
              level={level + 1}
              onFileClick={onFileClick}
            />
          ))}

          {/* Then render files in this directory */}
          {files.map((file, index) => (
            <div
              key={index}
              className="nested-file"
              style={{ paddingLeft: `${(level + 1) * 20}px` }}
            >
              <FileItem
                file={file}
                onClick={onFileClick}
                showFullName={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FileList = ({ files, onClearSession, sessionId, showUploadedOnly = false }) => {
  const [viewingFile, setViewingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter files based on type
  const filteredFiles = showUploadedOnly
    ? files.filter(file => file.type === 'text' || file.type === 'image' || file.type === 'archive') // Show user uploaded files
    : files; // Show all files (both uploaded and generated) in Generated Files section

  const displayTitle = showUploadedOnly ? 'Uploaded Files' : 'All Files';

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
              {showUploadedOnly ? (
                // Simple flat list for uploaded files
                filteredFiles.map((file, index) => (
                  <FileItem
                    key={index}
                    file={file}
                    onClick={handleViewFile}
                    showFullName={true}
                  />
                ))
              ) : (
                // Tree structure for all files
                <FileTreeView files={filteredFiles} onFileClick={handleViewFile} />
              )}
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
