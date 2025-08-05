import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import './FileUpload.css';

const FileUpload = ({ onFileUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    try {
      await onFileUpload(acceptedFiles);
      setUploadedCount(prev => prev + acceptedFiles.length);
    } catch (error) {
      // Handle error silently
    } finally {
      setUploading(false);
    }
  }, [onFileUpload]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    acceptedFiles
  } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'text/*': ['.txt', '.md', '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.xml', '.yaml', '.yml'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.bmp'],
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip'],
      'application/x-tar': ['.tar'],
      'application/gzip': ['.gz'],
      '*/*': []
    }
  });

  const getDropzoneClassName = () => {
    let className = 'dropzone';
    if (isDragActive) className += ' active';
    if (isDragReject) className += ' reject';
    if (uploading) className += ' uploading';
    return className;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file) => {
    const extension = file.name.split('.').pop().toLowerCase();

    if (['txt', 'md'].includes(extension)) return '📄';
    if (['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json'].includes(extension)) return '💻';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp'].includes(extension)) return '🖼️';
    if (extension === 'pdf') return '📕';
    if (['zip', 'tar', 'gz'].includes(extension)) return '📦';
    return '📄';
  };

  return (
    <div className="file-upload-container">
      <h3>📂 Upload Files</h3>

      <div {...getRootProps()} className={getDropzoneClassName()}>
        <input {...getInputProps()} />

        {uploading ? (
          <div className="upload-status">
            <div className="spinner"></div>
            <p>Uploading files...</p>
          </div>
        ) : (
          <div className="dropzone-content">
            {isDragActive ? (
              isDragReject ? (
                <p>❌ Some files are not supported</p>
              ) : (
                <p>📤 Drop files here...</p>
              )
            ) : (
              <div>
                <p>🎯 Drag & drop files here</p>
                <p className="or-text">or click to browse</p>
                <div className="supported-formats">
                  <small>
                    Supports: Text files, Code files, Images, PDFs, Archives
                  </small>
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      {uploadedCount > 0 && (
        <div className="upload-summary">
          ✅ {uploadedCount} file(s) uploaded successfully
        </div>
      )}
    </div>
  );
};

export default FileUpload;
