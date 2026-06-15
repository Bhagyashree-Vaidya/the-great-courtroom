import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { api, setPassword } from './api';
import './App.css';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(null); // AbortController for the in-flight stream

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    } else {
      setCurrentConversation(null);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      setConversations(await api.listConversations());
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (id) => {
    try {
      setCurrentConversation(await api.getConversation(id));
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await api.createConversation();
      setConversations([
        { id: newConv.id, created_at: newConv.created_at, title: newConv.title, message_count: 0 },
        ...conversations,
      ]);
      setCurrentConversationId(newConv.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id) => setCurrentConversationId(id);

  const handleLogout = () => {
    setPassword('');
    window.location.reload();
  };

  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === currentConversationId) {
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleRenameConversation = async (id, title) => {
    const clean = title.trim();
    if (!clean) return;
    try {
      const res = await api.renameConversation(id, clean);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: res.title } : c))
      );
      setCurrentConversation((prev) =>
        prev && prev.id === id ? { ...prev, title: res.title } : prev
      );
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  // A fresh, progressively-filled assistant message.
  const blankAssistant = () => ({
    role: 'assistant',
    stage1: null,
    stage2: null,
    stage3: null,
    metadata: null,
    loading: { stage1: false, stage2: false, stage3: false },
  });

  // Core streaming run. Assumes the last message in state is the assistant
  // placeholder to fill. `regenerate` reuses the last user message server-side.
  const runStream = async (convId, { content = '', regenerate = false }) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    const setLast = (mutate) =>
      setCurrentConversation((prev) => {
        const messages = [...prev.messages];
        mutate(messages[messages.length - 1]);
        return { ...prev, messages };
      });

    try {
      await api.sendMessageStream(
        convId,
        content,
        (eventType, event) => {
          switch (eventType) {
            case 'stage1_start': setLast((m) => { m.loading.stage1 = true; }); break;
            case 'stage1_complete': setLast((m) => { m.stage1 = event.data; m.loading.stage1 = false; }); break;
            case 'stage2_start': setLast((m) => { m.loading.stage2 = true; }); break;
            case 'stage2_complete': setLast((m) => { m.stage2 = event.data; m.metadata = event.metadata; m.loading.stage2 = false; }); break;
            case 'stage3_start': setLast((m) => { m.loading.stage3 = true; }); break;
            case 'stage3_complete': setLast((m) => { m.stage3 = event.data; m.loading.stage3 = false; }); break;
            case 'title_complete': loadConversations(); break;
            case 'complete': loadConversations(); setIsLoading(false); break;
            case 'error':
              console.error('Stream error:', event.message);
              setLast((m) => { m.error = event.message; });
              setIsLoading(false);
              break;
            default: break;
          }
        },
        { signal: controller.signal, regenerate }
      );
    } catch (error) {
      if (error.name === 'AbortError') {
        // User pressed Stop: mark the unfinished placeholder.
        setLast((m) => { if (m && m.role === 'assistant' && !m.stage3) m.stopped = true; });
      } else {
        console.error('Stream failed:', error);
        setLast((m) => { if (m && m.role === 'assistant' && !m.stage3) m.error = 'Something went wrong. Try again.'; });
      }
      setIsLoading(false);
    } finally {
      abortRef.current = null;
    }
  };

  const handleSendMessage = async (content) => {
    if (!currentConversationId) return;
    setCurrentConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', content }, blankAssistant()],
    }));
    await runStream(currentConversationId, { content });
  };

  const handleRegenerate = async () => {
    if (!currentConversationId || !currentConversation) return;
    const msgs = currentConversation.messages;
    // Drop the trailing assistant message, then re-run the last user message.
    const keep = msgs[msgs.length - 1]?.role === 'assistant' ? msgs.length - 1 : msgs.length;
    try {
      await api.truncateConversation(currentConversationId, keep);
    } catch (error) {
      console.error('Failed to prepare regenerate:', error);
      return;
    }
    setCurrentConversation((prev) => ({
      ...prev,
      messages: [...prev.messages.slice(0, keep), blankAssistant()],
    }));
    await runStream(currentConversationId, { regenerate: true });
  };

  // Edit the user message at `index` and re-run from there.
  const handleEditMessage = async (index, newContent) => {
    if (!currentConversationId) return;
    try {
      await api.truncateConversation(currentConversationId, index);
    } catch (error) {
      console.error('Failed to prepare edit:', error);
      return;
    }
    setCurrentConversation((prev) => ({
      ...prev,
      messages: [
        ...prev.messages.slice(0, index),
        { role: 'user', content: newContent },
        blankAssistant(),
      ],
    }));
    await runStream(currentConversationId, { content: newContent });
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onLogout={handleLogout}
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        onStop={handleStop}
        onRegenerate={handleRegenerate}
        onEditMessage={handleEditMessage}
        isLoading={isLoading}
      />
    </div>
  );
}

export default App;
