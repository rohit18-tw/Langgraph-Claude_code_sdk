import { useCallback, useState } from 'react';
import { useSessionContext } from '../../context/SessionContext/SessionContext';
import { useUIContext } from '../../context/UIContext/UIContext';
import { fileService } from '../../services/api/files';
import { sessionService } from '../../services/api/sessions';
import { handleError, createErrorMessage } from '../../utils/errors/errorHandler';
import { validateFiles, validateImageSize } from '../../utils/helpers/validators';
import { FILE_UPLOAD } from '../../utils/constants/messages';

/**
 * Custom hook for file upload operations
 */
export const useFileUpload = () => {
  const {
    currentSessionId,
    uploadedFiles,
    directoryStructure,
    setUploadedFiles,
    setDirectoryStructure
  } = useSessionContext();

  const { addNotification, setLoadingState, isLoading } = useUIContext();

  const [uploadProgress, setUploadProgress] = useState(null);

  /**
   * Upload files to current session
   * @param {Array} files - Array of File objects
   */
  const uploadFiles = useCallback(async (files) => {
    if (!currentSessionId) {
      addNotification({
        type: 'error',
        title: 'No Session',
        message: 'Please create a session first'
      });
      return;
    }

    if (!files || files.length === 0) {
      addNotification({
        type: 'warning',
        title: 'No Files',
        message: 'Please select files to upload'
      });
      return;
    }

    // Validate files
    const validation = validateFiles(files);
    if (!validation.isValid) {
      addNotification({
        type: 'error',
        title: 'File Validation Failed',
        message: validation.errors.join(', ')
      });
      return;
    }

    const loadingKey = `upload-${currentSessionId}`;

    try {
      setLoadingState(loadingKey, true);
      setUploadProgress('Uploading files...');

      // Upload files via API
      await fileService.uploadFiles(currentSessionId, validation.validFiles);

      // Reload session data after successful upload
      const { files, structure } = await sessionService.loadSessionData(currentSessionId);
      setUploadedFiles(files);
      setDirectoryStructure(structure);

      addNotification({
        type: 'success',
        title: 'Upload Successful',
        message: `${validation.validFiles.length} file(s) uploaded successfully`
      });

    } catch (error) {
      const parsedError = handleError(error, 'FileUpload.uploadFiles');
      const errorMessage = createErrorMessage(error, 'Failed to upload files');

      addNotification({
        type: 'error',
        title: 'Upload Failed',
        message: errorMessage
      });

      throw parsedError;
    } finally {
      setLoadingState(loadingKey, false);
      setUploadProgress(null);
    }
  }, [currentSessionId, addNotification, setLoadingState]);

  /**
   * Process images for chat messages
   * @param {Array} files - Array of image File objects
   * @returns {Promise<Array>} Processed images with data URLs
   */
  const processImages = useCallback(async (files) => {
    if (!files || files.length === 0) return [];

    // Validate image files
    const invalidImages = files.filter(file => !validateImageSize(file));
    if (invalidImages.length > 0) {
      addNotification({
        type: 'error',
        title: 'Image Validation Failed',
        message: `${invalidImages.length} image(s) are too large. Maximum size is ${FILE_UPLOAD.MAX_IMAGE_SIZE / (1024 * 1024)}MB`
      });
      return [];
    }

    try {
      setUploadProgress('Processing images...');
      const processedImages = await fileService.processImages(files);

      addNotification({
        type: 'success',
        title: 'Images Processed',
        message: `${processedImages.length} image(s) ready for chat`
      });

      return processedImages;
    } catch (error) {
      const parsedError = handleError(error, 'FileUpload.processImages');
      const errorMessage = createErrorMessage(error, 'Failed to process images');

      addNotification({
        type: 'error',
        title: 'Image Processing Failed',
        message: errorMessage
      });

      return [];
    } finally {
      setUploadProgress(null);
    }
  }, [addNotification]);

  /**
   * Load session data (files and structure)
   */
  const loadSessionData = useCallback(async () => {
    if (!currentSessionId) return;

    const loadingKey = `load-session-${currentSessionId}`;

    try {
      setLoadingState(loadingKey, true);

      const { files, structure } = await sessionService.loadSessionData(currentSessionId);

      setUploadedFiles(files);
      setDirectoryStructure(structure);

    } catch (error) {
      const errorMessage = createErrorMessage(error, 'Failed to load session data');

      addNotification({
        type: 'error',
        title: 'Load Failed',
        message: errorMessage
      });

      console.error('Failed to load session data:', error);
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [currentSessionId, setUploadedFiles, setDirectoryStructure, addNotification, setLoadingState]);

  /**
   * Handle file input change
   * @param {Event} event - File input change event
   */
  const handleFileChange = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      await uploadFiles(files);
      // Reset file input
      event.target.value = '';
    }
  }, [uploadFiles]);

  /**
   * Handle image input change
   * @param {Event} event - File input change event
   * @returns {Promise<Array>} Processed images
   */
  const handleImageChange = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      const processedImages = await processImages(files);
      // Reset file input
      event.target.value = '';
      return processedImages;
    }
    return [];
  }, [processImages]);

  /**
   * Handle drag and drop files
   * @param {Array} files - Dropped files
   */
  const handleDrop = useCallback(async (files) => {
    await uploadFiles(files);
  }, [uploadFiles]);

  /**
   * Get file count
   */
  const getFileCount = useCallback(() => {
    return uploadedFiles ? uploadedFiles.length : 0;
  }, [uploadedFiles]);

  /**
   * Check if has uploaded files
   */
  const hasUploadedFiles = useCallback(() => {
    return uploadedFiles && uploadedFiles.length > 0;
  }, [uploadedFiles]);

  return {
    // State
    uploadedFiles,
    directoryStructure,
    uploadProgress,
    isUploading: isLoading(`upload-${currentSessionId}`),
    isLoadingSession: isLoading(`load-session-${currentSessionId}`),

    // Actions
    uploadFiles,
    processImages,
    loadSessionData,
    handleFileChange,
    handleImageChange,
    handleDrop,

    // Utilities
    getFileCount,
    hasUploadedFiles
  };
};

export default useFileUpload;
