import React from 'react';
import './ImageModal.css';

const ImageModal = ({ isOpen, onClose, imageSrc, imageName }) => {
  console.log('ImageModal render:', { isOpen, imageName });

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="image-modal-overlay" onClick={handleBackdropClick}>
      <div className="image-modal-container">
        <div className="image-modal-header">
          <h3 className="image-modal-title">{imageName}</h3>
          <button
            className="image-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="image-modal-content">
          <img
            src={imageSrc}
            alt={imageName}
            className="image-modal-image"
          />
        </div>

        <div className="image-modal-footer">
          <span className="image-modal-hint">
            Press ESC or click outside to close
          </span>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
