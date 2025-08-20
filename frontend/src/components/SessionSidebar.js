import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SessionSidebar.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const SessionSidebar = ({ currentSessionId, onNewSession, onSelectSession, onSessionDeleted }) => {
  const [sessions, setSessions] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    // Load sessions from localStorage or API
    loadSessions();
  }, []);

  const loadSessions = () => {
    // For now, we'll use localStorage to store sessions
    // In a real app, this would come from the backend
    const savedSessions = localStorage.getItem('chatSessions');
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    } else {
      // Initialize with current session
      const initialSession = {
        id: currentSessionId,
        title: 'New Session',
        lastMessage: 'Welcome to FStratum!',
        timestamp: new Date().toISOString(),
        messageCount: 0
      };
      setSessions([initialSession]);
      localStorage.setItem('chatSessions', JSON.stringify([initialSession]));
    }
  };

  const saveCurrentSession = (sessionData) => {
    const savedSessions = localStorage.getItem('chatSessions');
    let sessions = savedSessions ? JSON.parse(savedSessions) : [];

    // Update existing session or add new one
    const existingIndex = sessions.findIndex(s => s.id === sessionData.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = { ...sessions[existingIndex], ...sessionData };
    } else {
      sessions.unshift(sessionData);
    }

    // Keep only the latest 20 sessions
    sessions = sessions.slice(0, 20);

    localStorage.setItem('chatSessions', JSON.stringify(sessions));
    setSessions(sessions);
  };

  const handleNewSession = () => {
    if (onNewSession) {
      onNewSession(saveCurrentSession);
    }
  };

  const handleSelectSession = (sessionId) => {
    if (onSelectSession) {
      onSelectSession(sessionId);
    }
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation(); // Prevent triggering session selection

    try {
      // Delete session directory from backend
      await axios.delete(`${API_BASE_URL}/sessions/${sessionId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      // Remove from localStorage sessions list
      const savedSessions = localStorage.getItem('chatSessions');
      let sessions = savedSessions ? JSON.parse(savedSessions) : [];
      sessions = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
      setSessions(sessions);

      // Remove session data from localStorage
      localStorage.removeItem(`session_${sessionId}`);

      // Notify parent component about session deletion
      if (onSessionDeleted) {
        onSessionDeleted(sessionId);
      }

      console.log(`Session ${sessionId} and its directory deleted successfully`);
    } catch (error) {
      console.error('Error deleting session:', error);
      // Still remove from frontend if backend deletion fails
      const savedSessions = localStorage.getItem('chatSessions');
      let sessions = savedSessions ? JSON.parse(savedSessions) : [];
      sessions = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
      setSessions(sessions);
      localStorage.removeItem(`session_${sessionId}`);

      // Notify parent component about session deletion even if backend failed
      if (onSessionDeleted) {
        onSessionDeleted(sessionId);
      }
    }
  };

  const handleRenameSession = (sessionId, newTitle) => {
    const savedSessions = localStorage.getItem('chatSessions');
    let sessions = savedSessions ? JSON.parse(savedSessions) : [];
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex >= 0) {
      sessions[sessionIndex].title = newTitle;
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
      setSessions(sessions);
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const startEditing = (sessionId, currentTitle, e) => {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleKeyPress = (e, sessionId) => {
    if (e.key === 'Enter') {
      handleRenameSession(sessionId, editingTitle);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // Update current session data when component receives new props
  useEffect(() => {
    if (currentSessionId) {
      const savedSessions = localStorage.getItem('chatSessions');
      const sessions = savedSessions ? JSON.parse(savedSessions) : [];
      const currentSession = sessions.find(s => s.id === currentSessionId);

      if (!currentSession) {
        // Add current session if it doesn't exist
        const newSession = {
          id: currentSessionId,
          title: 'New Session',
          lastMessage: 'Welcome to FStratum!',
          timestamp: new Date().toISOString(),
          messageCount: 0
        };
        sessions.unshift(newSession);
        localStorage.setItem('chatSessions', JSON.stringify(sessions));
        setSessions(sessions);
      }
    }
  }, [currentSessionId]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateText = (text, maxLength = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className={`session-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button
          className="new-session-btn"
          onClick={handleNewSession}
          title="Start new session"
        >
          <span className="plus-icon">+</span>
          {!isCollapsed && <span>New Session</span>}
        </button>

        <button
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className={`arrow ${isCollapsed ? 'right' : 'left'}`}>‹</span>
        </button>
      </div>

      {!isCollapsed && (
        <div className="sessions-list">
          <div className="sessions-header">
            <h3>Recent Sessions</h3>
          </div>

          <div className="sessions-container">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                onClick={() => handleSelectSession(session.id)}
              >
                <div className="session-content">
                  {editingSessionId === session.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, session.id)}
                      onBlur={() => handleRenameSession(session.id, editingTitle)}
                      className="session-title-input"
                      autoFocus
                    />
                  ) : (
                    <div className="session-title">{session.title}</div>
                  )}
                  <div className="session-preview">
                    {truncateText(session.lastMessage || 'No messages yet')}
                  </div>
                  <div className="session-meta">
                    <span className="session-date">{formatDate(session.timestamp)}</span>
                    {session.messageCount > 0 && (
                      <span className="message-count">{session.messageCount} messages</span>
                    )}
                  </div>
                </div>
                <div className="session-actions">
                  <button
                    className="session-action-btn edit-btn"
                    onClick={(e) => startEditing(session.id, session.title, e)}
                    title="Rename session"
                  >
                    ✏️
                  </button>
                  <button
                    className="session-action-btn delete-btn"
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    title="Delete session"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionSidebar;
