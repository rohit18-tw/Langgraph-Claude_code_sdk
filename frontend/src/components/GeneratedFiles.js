import React from 'react';
import FileTree from './FileTree';
import './GeneratedFiles.css';

const GeneratedFiles = ({ files, onFileClick, sessionId }) => {
  // Filter for generated files (exclude uploaded files which are in UUID session directories)
  const generatedFiles = files.filter(file => {
    // Uploaded files have paths like: "76a69c17-465e-40db-b825-f728258424f0/xxxxx_filename.txt"
    // Generated files will be directly in working directory or subdirectories without UUID session folders
    const pathParts = file.path.split('/');
    const firstDir = pathParts[0];

    // If file path starts with a session UUID directory, it's an uploaded file
    const isUploadedFile = firstDir.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);

    return !isUploadedFile; // Only include non-uploaded files
  });

  console.log('Generated files in right panel:', generatedFiles.length, generatedFiles);

  return (
    <div className="generated-files">
      <div className="generated-files-header">
        <h3>⚡ Generated Files</h3>
        <span className="file-count">{generatedFiles.length} files</span>
      </div>

      {generatedFiles.length > 0 ? (
        <div className="generated-files-content">
          <FileTree
            files={generatedFiles}
            onFileClick={onFileClick}
          />
        </div>
      ) : (
        <div className="no-generated-files">
          <div className="placeholder-content">
            <h4>🔨 No files generated yet</h4>
            <p>Files will appear here in real-time as Claude creates them</p>
            <div className="placeholder-icons">
              <span>📄</span>
              <span>🎨</span>
              <span>🐍</span>
              <span>☕</span>
              <span>⚙️</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneratedFiles;
