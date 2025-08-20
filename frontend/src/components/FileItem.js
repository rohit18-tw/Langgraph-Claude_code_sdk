import React from 'react';

const FileItem = ({ file, onClick, showFullName = false }) => {
  const displayName = showFullName
    ? file.name
    : file.name.split('_').slice(1).join('_') || file.name;

  return (
    <div
      className="file-item clickable"
      onClick={() => onClick(file)}
      title="Click to view file content"
    >
      <div className="file-info">
        <div className="file-icon-name">
          <div className="file-details">
            <div className="file-name" title={file.name}>
              {displayName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileItem;
