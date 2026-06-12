import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onLogout,
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-brand">The Council</h1>
        <p className="sidebar-tagline">Five perspectives, one decision</p>
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
              className={`conversation-item ${
                conv.id === currentConversationId ? 'active' : ''
              }`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="conversation-title">
                {conv.title || 'New decision'}
              </div>
              <div className="conversation-meta">
                {conv.message_count} messages
              </div>
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
