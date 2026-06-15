import { useState, useEffect, useRef } from 'react';
import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onLogout,
}) {
  const [menuId, setMenuId] = useState(null); // which item's menu is open
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const startRename = (conv) => {
    setMenuId(null);
    setRenamingId(conv.id);
    setRenameText(conv.title || 'New decision');
  };

  const commitRename = (id) => {
    const text = renameText.trim();
    setRenamingId(null);
    if (text) onRenameConversation(id, text);
  };

  const confirmDelete = (conv) => {
    setMenuId(null);
    if (window.confirm(`Delete "${conv.title || 'this decision'}"? This cannot be undone.`)) {
      onDeleteConversation(conv.id);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-brand">The Great Courtroom</h1>
        <p className="sidebar-tagline">Don't suck at decision making</p>
        <button className="new-conversation-btn" onClick={onNewConversation}>
          + New decision
        </button>
      </div>

      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div className="no-conversations">No decisions yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
              onClick={() => renamingId !== conv.id && onSelectConversation(conv.id)}
            >
              {renamingId === conv.id ? (
                <input
                  className="rename-input"
                  value={renameText}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameText(e.target.value)}
                  onBlur={() => commitRename(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(conv.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                />
              ) : (
                <>
                  <div className="conversation-body">
                    <div className="conversation-title">{conv.title || 'New decision'}</div>
                    <div className="conversation-meta">{conv.message_count} messages</div>
                  </div>
                  <button
                    className="conversation-menu-btn"
                    title="Options"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId(menuId === conv.id ? null : conv.id);
                    }}
                  >
                    ⋯
                  </button>
                  {menuId === conv.id && (
                    <div className="conversation-menu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => startRename(conv)}>Rename</button>
                      <button className="danger" onClick={() => confirmDelete(conv)}>Delete</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
