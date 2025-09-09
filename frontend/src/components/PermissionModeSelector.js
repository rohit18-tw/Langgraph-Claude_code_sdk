import React, { useState, useEffect } from 'react';
import { claudeService } from '../services/api';
import './PermissionModeSelector.css';

const PermissionModeSelector = ({ selectedMode, onModeChange, disabled = false }) => {
  const [permissionModes, setPermissionModes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPermissionModes = async () => {
      try {
        setLoading(true);
        const response = await claudeService.getPermissionModes();
        setPermissionModes(response.permission_modes || {});
        setError(null);
      } catch (err) {
        console.error('Error fetching permission modes:', err);
        setError('Failed to load permission modes');
        // Set default modes as fallback
        setPermissionModes({
          acceptEdits: 'Automatically accept file edits',
          bypassPermissions: 'Bypass all permission prompts (use with caution)',
          plan: 'Plan mode - analyze without making changes',
          default: 'Standard permission prompts'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPermissionModes();
  }, []);

  const handleModeChange = (event) => {
    const newMode = event.target.value;
    onModeChange(newMode);
  };

  if (loading) {
    return (
      <div className="permission-mode-selector loading">
        <span className="loading-text">Loading permission modes...</span>
      </div>
    );
  }

  return (
    <div className="permission-mode-selector">
      <label htmlFor="permission-mode" className="permission-label">
        <span className="label-text">Permission Mode:</span>
        <select
          id="permission-mode"
          value={selectedMode}
          onChange={handleModeChange}
          disabled={disabled}
          className="permission-select"
        >
          {Object.entries(permissionModes).map(([mode, description]) => (
            <option key={mode} value={mode}>
              {mode} - {description}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <div className="permission-error">
          <span className="error-text">{error}</span>
        </div>
      )}
      <div className="permission-info">
        <span className="info-text">
          SDK Mode: {selectedMode === 'bypassPermissions' ? '⚠️ Caution' :
                     selectedMode === 'plan' ? '🔍 Analysis' :
                     selectedMode === 'acceptEdits' ? '✅ Auto-accept' :
                     '🔒 Secure'}
        </span>
      </div>
    </div>
  );
};

export default PermissionModeSelector;
