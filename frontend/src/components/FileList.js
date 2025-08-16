import React, { useState } from 'react';
import axios from 'axios';
import FileViewer from './FileViewer';
import './FileList.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const FileList = ({ files, onClearSession, sessionId, showOnlyUploaded = false }) => {
  const [viewingFile, setViewingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState('');
  const [newFilesCount, setNewFilesCount] = useState(0);
  const [showNewFilesIndicator, setShowNewFilesIndicator] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  // Filter files based on what we want to show
  const getFilteredFiles = () => {
    if (showOnlyUploaded) {
      // For left panel: only show files that were originally uploaded (not generated)
      // We can identify uploaded files by checking if they have unique IDs in their names
      return files.filter(file => file.name.includes('_'));
    } else {
      // For right panel: show only generated files (not uploaded files)
      // Generated files don't have UUID prefixes in their names
      return files.filter(file => !file.name.includes('_'));
    }
  };

  const filteredFiles = getFilteredFiles();

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

  // Build directory tree structure
  const buildFileTree = (files) => {
    const tree = {};

    files.forEach(file => {
      const pathParts = file.path.split('/').filter(part => part !== '');
      let currentLevel = tree;

      // Navigate through the path, creating folders as needed
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i];
        if (!currentLevel[folderName]) {
          currentLevel[folderName] = {
            type: 'folder',
            children: {},
            path: pathParts.slice(0, i + 1).join('/')
          };
        }
        currentLevel = currentLevel[folderName].children;
      }

      // Add the file
      const fileName = pathParts[pathParts.length - 1] || file.name;
      currentLevel[fileName] = {
        type: 'file',
        ...file
      };
    });

    return tree;
  };

  const toggleFolder = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };
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

  // Resizer functionality
  const handleMouseDown = (e) => {
    if (showOnlyUploaded) return; // Only for right panel
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'ew-resize';

    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (e) => {
      const deltaX = startX - e.clientX; // Reverse direction for right panel
      const newWidth = Math.min(600, Math.max(250, startWidth + deltaX));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Recursive component to render file tree
  const renderTreeItem = (name, item, depth = 0) => {
    const indentStyle = { paddingLeft: `${depth * 20 + 10}px` };

    if (item.type === 'folder') {
      const isExpanded = expandedFolders.has(item.path);
      return (
        <div key={item.path}>
          <div
            className="file-item folder-item"
            style={indentStyle}
            onClick={() => toggleFolder(item.path)}
          >
            <div className="file-info">
              <div className="file-icon-name">
                <span className="folder-toggle">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className="folder-name">{name}</span>
              </div>
            </div>
          </div>
          {isExpanded && (
            <div className="folder-contents">
              {Object.entries(item.children)
                .sort(([a, itemA], [b, itemB]) => {
                  // Folders first, then files, both alphabetically
                  if (itemA.type === 'folder' && itemB.type === 'file') return -1;
                  if (itemA.type === 'file' && itemB.type === 'folder') return 1;
                  return a.localeCompare(b);
                })
                .map(([childName, childItem]) =>
                  renderTreeItem(childName, childItem, depth + 1)
                )}
            </div>
          )}
        </div>
      );
    } else {
      // File item
      return (
        <div
          key={item.path}
          className="file-item file-item-tree clickable"
          style={indentStyle}
          onClick={() => handleViewFile(item)}
          title="Click to view file content"
        >
          <div className="file-info">
            <div className="file-icon-name">
              <div className="file-details">
                <div className="file-name" title={item.name}>
                  {name}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  const fileTree = buildFileTree(filteredFiles);
  const displayTitle = showOnlyUploaded ? 'Uploaded Files' : 'Generated Files';
  const displayCount = filteredFiles.length;

  // For left panel (uploaded only) use simple list, for right panel (all files) use tree
  const renderContent = () => {
    if (showOnlyUploaded && filteredFiles.length > 0) {
      // Simple list view for uploaded files
      return (
        <div className="file-list">
          {filteredFiles.map((file, index) => (
            <div
              key={index}
              className="file-item clickable"
              onClick={() => handleViewFile(file)}
              title="Click to view file content"
            >
              <div className="file-info">
                <div className="file-icon-name">
                  <div className="file-details">
                    <div className="file-name" title={file.name}>
                      {file.name.split('_').slice(1).join('_') || file.name} {/* Remove UUID prefix */}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      // Tree view for all files
      return (
        <div className="file-tree">
          {Object.entries(fileTree)
            .sort(([a, itemA], [b, itemB]) => {
              // Folders first, then files, both alphabetically
              if (itemA.type === 'folder' && itemB.type === 'file') return -1;
              if (itemA.type === 'file' && itemB.type === 'folder') return 1;
              return a.localeCompare(b);
            })
            .map(([name, item]) => renderTreeItem(name, item))}
        </div>
      );
    }
  };

  return (
    <div
      className={`file-list-container ${isCollapsed ? 'collapsed' : ''} ${showOnlyUploaded ? 'uploaded-only' : 'all-files'} ${isResizing ? 'resizing' : ''}`}
      style={!showOnlyUploaded ? { width: `${panelWidth}px` } : {}}
    >
      {!showOnlyUploaded && (
        <div
          className={`resizer ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleMouseDown}
        />
      )}
      <div className="file-list-toggle-header">
        <button
          className="file-list-toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? `Show ${displayTitle.toLowerCase()}` : `Hide ${displayTitle.toLowerCase()}`}
        >
          <span className="toggle-arrow">{isCollapsed ? '◀' : '▼'}</span>
          <span className="toggle-text">{displayTitle} ({displayCount})</span>
        </button>
        {files.length > 0 && !isCollapsed && !showOnlyUploaded && (
            <button
              onClick={onClearSession}
              className="clear-session-btn compact"
              title="Clear all files and chat history"
            >
              Clear
            </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="file-list-content">
          {displayCount === 0 ? (
            <div className="no-files">
              <p>{showOnlyUploaded ? 'No files uploaded yet' : 'No generated files yet'}</p>
              <small>{showOnlyUploaded ? 'Upload files to provide context for your questions' : 'Ask Claude to generate code and files will appear here'}</small>
            </div>
          ) : (
            <>
              {showNewFilesIndicator && !showOnlyUploaded && (
                <div className="new-files-indicator">
                  New files created!
                </div>
              )}

              {renderContent()}
            </>
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
