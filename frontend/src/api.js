/**
 * API client for the LinkedIn Council backend.
 */

// Backend URL. In production set VITE_API_BASE (e.g. https://council-api.fly.dev).
// Falls back to the local backend for development.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8001';

const PASSWORD_KEY = 'council_password';

export function getPassword() {
  return localStorage.getItem(PASSWORD_KEY) || '';
}

export function setPassword(value) {
  if (value) {
    localStorage.setItem(PASSWORD_KEY, value);
  } else {
    localStorage.removeItem(PASSWORD_KEY);
  }
}

// Build headers, attaching the shared password if we have one stored.
function headers(extra = {}) {
  const h = { ...extra };
  const pw = getPassword();
  if (pw) {
    h['X-Council-Password'] = pw;
  }
  return h;
}

export const api = {
  /**
   * Validate the stored password against the backend without spending anything.
   * Returns true if the gate is satisfied (or disabled), false on 401.
   */
  async checkAuth() {
    const response = await fetch(`${API_BASE}/api/auth/check`, {
      headers: headers(),
    });
    if (response.status === 401) return false;
    if (!response.ok) throw new Error('Auth check failed');
    return true;
  },

  /**
   * List all conversations.
   */
  async listConversations() {
    const response = await fetch(`${API_BASE}/api/conversations`, {
      headers: headers(),
    });
    if (!response.ok) {
      throw new Error('Failed to list conversations');
    }
    return response.json();
  },

  /**
   * Create a new conversation.
   */
  async createConversation() {
    const response = await fetch(`${API_BASE}/api/conversations`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
  },

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`,
      { headers: headers() }
    );
    if (!response.ok) {
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId, content) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message`,
      {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    return response.json();
  },

  /** Delete a conversation (chat thread). */
  async deleteConversation(conversationId) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`,
      { method: 'DELETE', headers: headers() }
    );
    if (!response.ok) throw new Error('Failed to delete conversation');
    return response.json();
  },

  /** Rename a conversation. */
  async renameConversation(conversationId, title) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`,
      {
        method: 'PATCH',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title }),
      }
    );
    if (!response.ok) throw new Error('Failed to rename conversation');
    return response.json();
  },

  /** Drop messages from an index onward (edit / regenerate). */
  async truncateConversation(conversationId, keepCount) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/truncate`,
      {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ keep_count: keepCount }),
      }
    );
    if (!response.ok) throw new Error('Failed to truncate conversation');
    return response.json();
  },

  /**
   * Send a message and receive streaming updates.
   * @param {string} conversationId
   * @param {string} content
   * @param {function} onEvent - (eventType, data) => void
   * @param {object} [opts] - { signal?: AbortSignal, regenerate?: boolean }
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, onEvent, opts = {}) {
    const { signal, regenerate = false } = opts;
    const url = `${API_BASE}/api/conversations/${conversationId}/message/stream${
      regenerate ? '?regenerate=true' : ''
    }`;
    const response = await fetch(url, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ content }),
      signal,
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  },
};
