import React, { useState, useEffect } from 'react';
import './MCPManager.css';

const MCPManager = ({ isOpen, onClose, onConfigUpdate }) => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', command: '', args: '' });

  useEffect(() => {
    if (isOpen) {
      fetchServers();
    }
  }, [isOpen]);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/mcp/config`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (response.ok) {
        const config = await response.json();
        const serverList = Object.entries(config.mcpServers || {}).map(([name, config]) => ({
          name,
          command: config.command,
          args: config.args?.join(', ') || '',
          env: config.env || {},
          enabled: true
        }));
        setServers(serverList);
      } else {
        setError('Failed to fetch MCP servers');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const mcpServers = {};

      servers.forEach(server => {
        if (server.enabled) {
          mcpServers[server.name] = {
            command: server.command,
            args: server.args.split(',').map(arg => arg.trim()).filter(arg => arg),
            env: server.env
          };
        }
      });

      const response = await fetch(`${API_BASE_URL}/mcp/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ mcpServers })
      });

      if (response.ok) {
        onConfigUpdate?.({ mcpServers });
        onClose();
      } else {
        setError('Failed to save configuration');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleServer = (index) => {
    setServers(prev => prev.map((server, i) =>
      i === index ? { ...server, enabled: !server.enabled } : server
    ));
  };

  const removeServer = (index) => {
    setServers(prev => prev.filter((_, i) => i !== index));
  };

  const addServer = () => {
    if (!newServer.name.trim()) return;

    setServers(prev => [...prev, {
      name: newServer.name,
      command: newServer.command || 'npx',
      args: newServer.args,
      env: {},
      enabled: true
    }]);

    setNewServer({ name: '', command: '', args: '' });
    setShowAddForm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="mcp-overlay">
      <div className="mcp-modal">
        <div className="mcp-header">
          <h2>🔧 MCP Servers</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {error && <div className="error-bar">{error}</div>}

        <div className="mcp-content">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              <div className="servers-list">
                {servers.map((server, index) => (
                  <div key={server.name} className="server-card">
                    <div className="server-info">
                      <div className="server-name">
                        <span className="server-icon">🔗</span>
                        {server.name}
                      </div>
                      <div className="server-details">
                        {server.command} {server.args}
                      </div>
                    </div>

                    <div className="server-actions">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={server.enabled}
                          onChange={() => toggleServer(index)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                      <button
                        onClick={() => removeServer(index)}
                        className="remove-btn"
                        title="Remove server"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {showAddForm ? (
                <div className="add-form">
                  <h3>Add New Server</h3>
                  <input
                    type="text"
                    placeholder="Server name (e.g., github)"
                    value={newServer.name}
                    onChange={(e) => setNewServer({...newServer, name: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Package (e.g., @modelcontextprotocol/server-github)"
                    value={newServer.args}
                    onChange={(e) => setNewServer({...newServer, args: e.target.value})}
                  />
                  <div className="form-actions">
                    <button onClick={() => setShowAddForm(false)} className="cancel-btn">
                      Cancel
                    </button>
                    <button onClick={addServer} className="add-btn">
                      Add Server
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="new-server-btn"
                >
                  + Add Server
                </button>
              )}
            </>
          )}
        </div>

        <div className="mcp-footer">
          <div className="footer-info">
            {servers.filter(s => s.enabled).length} of {servers.length} servers enabled
          </div>
          <div className="footer-actions">
            <button onClick={onClose} className="cancel-btn">Cancel</button>
            <button onClick={saveServers} disabled={loading} className="save-btn">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCPManager;
