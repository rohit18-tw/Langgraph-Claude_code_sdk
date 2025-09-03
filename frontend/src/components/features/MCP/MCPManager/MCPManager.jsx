import React from 'react';
import { useUIContext } from '../../../../context/UIContext/UIContext';

// Temporary wrapper around existing MCPManager
import OriginalMCPManager from '../../../MCPManager';

/**
 * Enhanced MCP Manager with new architecture
 * Currently wraps existing component while migration is in progress
 */
const MCPManager = ({ isOpen, onClose, onConfigUpdate, ...props }) => {
  const { isModalOpen, closeModal } = useUIContext();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeModal('mcpManager');
    }
  };

  const modalIsOpen = isOpen !== undefined ? isOpen : isModalOpen('mcpManager');

  return (
    <OriginalMCPManager
      isOpen={modalIsOpen}
      onClose={handleClose}
      onConfigUpdate={onConfigUpdate}
      {...props}
    />
  );
};

export default MCPManager;
