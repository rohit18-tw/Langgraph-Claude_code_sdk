import React, { useState, useMemo } from 'react';
import './FileTree.css';

const FileTree = ({ files, onFileClick }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // Build tree structure from flat file list
  const fileTree = useMemo(() => {
    const tree = {};

    files.forEach(file => {
      const pathParts = file.path.split('/');
      let currentLevel = tree;

      // Build nested structure
      pathParts.forEach((part, index) => {
        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            isFile: index === pathParts.length - 1,
            children: {},
            file: index === pathParts.length - 1 ? file : null,
            path: pathParts.slice(0, index + 1).join('/')
          };
        }
        currentLevel = currentLevel[part].children;
      });
    });

    return tree;
  }, [files]);

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(folderPath)) {
        newExpanded.delete(folderPath);
      } else {
        newExpanded.add(folderPath);
      }
      return newExpanded;
    });
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js': case 'jsx': return '📄';
      case 'ts': case 'tsx': return '📘';
      case 'py': return '🐍';
      case 'java': return '☕';
      case 'html': return '🌐';
      case 'css': return '🎨';
      case 'json': return '📋';
      case 'xml': return '📃';
      case 'yml': case 'yaml': return '⚙️';
      case 'md': return '📝';
      case 'sql': return '🗃️';
      case 'txt': return '📄';
      default: return '📄';
    }
  };

  const renderTreeNode = (node, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = Object.keys(node.children).length > 0;

    return (
      <div key={node.path} className="tree-node">
        <div
          className={`tree-item ${node.isFile ? 'file' : 'folder'}`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => {
            if (node.isFile && onFileClick) {
              onFileClick(node.file);
            } else if (!node.isFile) {
              toggleFolder(node.path);
            }
          }}
        >
          {!node.isFile && hasChildren && (
            <span className="folder-toggle">
              {isExpanded ? '📂' : '📁'}
            </span>
          )}
          {node.isFile && (
            <span className="file-icon">
              {getFileIcon(node.name)}
            </span>
          )}
          <span className="node-name" title={node.name}>
            {node.name}
          </span>
          {node.isFile && (
            <span className="view-indicator">👁️</span>
          )}
        </div>

        {!node.isFile && hasChildren && isExpanded && (
          <div className="tree-children">
            {Object.values(node.children)
              .sort((a, b) => {
                // Folders first, then files
                if (!a.isFile && b.isFile) return -1;
                if (a.isFile && !b.isFile) return 1;
                return a.name.localeCompare(b.name);
              })
              .map(child => renderTreeNode(child, depth + 1))
            }
          </div>
        )}
      </div>
    );
  };

  if (Object.keys(fileTree).length === 0) {
    return (
      <div className="file-tree-empty">
        <p>No generated files yet</p>
        <small>Files will appear here as Claude creates them</small>
      </div>
    );
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <h4>📁 Generated Structure</h4>
        <small>{files.length} files</small>
      </div>
      <div className="tree-container">
        {Object.values(fileTree)
          .sort((a, b) => {
            if (!a.isFile && b.isFile) return -1;
            if (a.isFile && !b.isFile) return 1;
            return a.name.localeCompare(b.name);
          })
          .map(node => renderTreeNode(node))
        }
      </div>
    </div>
  );
};

export default FileTree;
