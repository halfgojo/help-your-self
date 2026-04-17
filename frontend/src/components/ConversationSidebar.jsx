import React, { useState, useEffect } from 'react';
import { listConversations, deleteConversation } from '../api';

function formatDateRelative(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ConversationSidebar({
  activeConversationId,
  onSelect,
  onNewChat,
  refreshTrigger,
  theme,
  onToggleTheme,
}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const convs = await listConversations();
      setConversations(convs || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshTrigger]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.conversationId !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>H:</div>
          <div>
            <div className="logo-text">HelpYourself</div>
            <div className="logo-tagline">AI Medical Research</div>
          </div>
        </div>
      </div>

      {/* New Chat */}
      <div className="sidebar-new-chat">
        <button
          id="btn-new-chat"
          className="btn-new-chat"
          onClick={onNewChat}
        >
          + New Research Session
        </button>
      </div>

      {/* History */}
      <div className="sidebar-history">
        {conversations.length > 0 && (
          <div className="sidebar-section-label">Recent Sessions</div>
        )}

        {loading && (
          <div className="sidebar-empty">Loading...</div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="sidebar-empty">
            <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.2 }}>◇</div>
            <div>No research sessions yet.</div>
            <div style={{ marginTop: '4px', opacity: 0.7 }}>Start a new session to begin.</div>
          </div>
        )}

        {conversations.map((conv) => (
          <div
            key={conv.conversationId}
            id={`conv-item-${conv.conversationId.slice(0, 8)}`}
            className={`conversation-item ${activeConversationId === conv.conversationId ? 'active' : ''}`}
            onClick={() => onSelect(conv)}
            style={{ position: 'relative' }}
          >
            <div className="conv-disease">
              {conv.disease}
            </div>
            {conv.patientName && (
              <div className="conv-patient">Patient: {conv.patientName}</div>
            )}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}
            >
              <div className="conv-date">{formatDateRelative(conv.updatedAt)}</div>
              <button
                onClick={(e) => handleDelete(e, conv.conversationId)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  opacity: 0.6,
                  lineHeight: 1,
                  fontFamily: 'var(--font-sans)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                onMouseOut={(e) => e.currentTarget.style.opacity = 0.6}
                title="Delete session"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8rem',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
        >
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
    </div>
  );
}
