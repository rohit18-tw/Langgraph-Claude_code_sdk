import React from 'react';
import { useSessionContext } from '../../../context/SessionContext/SessionContext';

// Temporary wrapper around existing EnhancedFileList
import OriginalEnhancedFileList from '../../EnhancedFileList';

/**
 * Enhanced File Manager with new architecture
 * Currently wraps existing component while migration is in progress
 */
const FileManager = ({ onClearSession, ...props }) => {
  const { uploadedFiles, directoryStructure, currentSessionId } = useSessionContext();

  return (
    <OriginalEnhancedFileList
      files={uploadedFiles}
      directoryStructure={directoryStructure}
      sessionId={currentSessionId}
      onClearSession={onClearSession}
      showUploadedOnly={false}
      {...props}
    />
  );
};

export default FileManager;
