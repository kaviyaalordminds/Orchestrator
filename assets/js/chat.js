
/* ============================================
   CHAT AGENT — Conversational AI with History
   ============================================ */

const chatAgent = {
  conversations: [],
  currentConversation: null,
  messages: [],

  init() {
    if (!document.getElementById('chatMessages') || !document.getElementById('conversationList')) return;
    this.renderConversationList();
    this.loadPersistedConversations();

    // Auto-grow the chat textarea
    const textarea = document.getElementById('chatInput');
    if (textarea) {
      textarea.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      });
    }
  },

  async loadPersistedConversations() {
    try {
      const data = await app.api('/api/v1/chat/conversations');
      const saved = Array.isArray(data?.data) ? data.data : [];
      this.conversations = saved.map(conv => ({
        ...conv,
        id: Number(conv.id),
        messages: Array.isArray(conv.messages) ? conv.messages : []
      }));
      this.renderConversationList();

      // Restore the most recent conversation after a page refresh.
      if (this.conversations.length > 0 && this.messages.length === 0) {
        this.loadConversation(this.conversations[0].id);
      } else if (this.conversations.length === 0) {
        this.showWelcome();
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      this.conversations = [];
      this.renderConversationList();
      this.showWelcome();
    }
  },

  async persistConversation(conversation) {
    if (!conversation) return;
    try {
      await app.api('/api/v1/chat/conversations', {
        method: 'POST',
        body: JSON.stringify(conversation)
      });
    } catch (err) {
      console.error('Failed to persist conversation:', err);
    }
  },

  async removePersistedConversation(id) {
    try {
      await app.api(`/api/v1/chat/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  },

  onActivate() {
    if (!document.getElementById('chatMessages')) return;
    if (this.messages.length === 0) this.showWelcome();
  },

  showWelcome() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
        <i class="bi bi-stars" style="font-size:48px;color:var(--primary-500);display:block;margin-bottom:16px;"></i>
        <h3 style="color:var(--text-primary);margin-bottom:8px;">How can I help you today?</h3>
        <p style="max-width:400px;margin:0 auto;">Ask me anything — I can help with writing, coding, analysis, creative ideas, and more.</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:24px;max-width:500px;margin-left:auto;margin-right:auto;">
          <button class="tool-chip" onclick="chatAgent.quickPrompt('Write a marketing email for our new product launch')">Marketing email</button>
          <button class="tool-chip" onclick="chatAgent.quickPrompt('Explain quantum computing in simple terms')">Explain quantum computing</button>
          <button class="tool-chip" onclick="chatAgent.quickPrompt('Generate Python code for a REST API')">Python REST API</button>
          <button class="tool-chip" onclick="chatAgent.quickPrompt('Create a project timeline for Q4')">Q4 Project timeline</button>
        </div>
      </div>
    `;
  },

  quickPrompt(text) {
    const input = document.getElementById('chatInput');
    if (!input) return;
    input.value = text;
    this.sendMessage();
  },

  newConversation() {
    this.currentConversation = null;
    this.messages = [];
    const title = document.getElementById('chatTitle');
    const model = document.getElementById('chatModel');
    if (title) title.textContent = 'New Conversation';
    if (model) model.textContent = 'AI Assistant';
    this.showWelcome();
    this.renderConversationList();
  },

  renderConversationList() {
    const list = document.getElementById('conversationList');
    if (!list) return;
    list.innerHTML = this.conversations.map(conv => `
      <div class="conversation-item ${conv.id === (this.currentConversation?.id) ? 'active' : ''}" onclick="chatAgent.loadConversation(${conv.id})">
        <div class="conversation-title">${conv.title}</div>
        <div class="conversation-preview">${conv.preview}</div>
        <div class="conversation-actions">
          <button class="conv-action-btn" onclick="event.stopPropagation(); chatAgent.deleteConversation(${conv.id})"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    `).join('');
  },

  loadConversation(id) {
    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;
    this.currentConversation = conv;
    this.messages = [...conv.messages];
    const title = document.getElementById('chatTitle');
    const model = document.getElementById('chatModel');
    if (title) title.textContent = conv.title;
    if (model) model.textContent = 'AI Assistant';
    this.renderMessages();
    this.renderConversationList();
  },

  async deleteConversation(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    if (this.currentConversation?.id === id) this.newConversation();
    else this.renderConversationList();
    await this.removePersistedConversation(id);
    app.showToast('Deleted', 'Conversation removed', 'info');
  },

  searchConversations(query) {
    const items = document.querySelectorAll('.conversation-item');
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
    });
  },

  renderMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    if (this.messages.length === 0) { this.showWelcome(); return; }

    container.innerHTML = this.messages.map((msg, idx) => {
      const isUser = msg.role === 'user';
      const avatar = isUser ? 'K' : '<i class="bi bi-stars"></i>';
      const avatarClass = isUser ? '' : 'style="background:linear-gradient(135deg,var(--primary-500),var(--accent-500));color:white;"';

      let content = msg.content;
      // Simple markdown-like rendering
      content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
      content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
      content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      content = content.replace(/\* ([^\n]+)/g, '<li>$1</li>');
      content = content.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

      // Source metadata is intentionally not rendered in normal chat.
      // Users can request sources explicitly through the backend diagnostics API.
      let sourcesHtml = '';

      return `
        <div class="message ${isUser ? 'user' : 'ai'}">
          <div class="message-avatar" ${avatarClass}>${avatar}</div>
          <div class="message-content">
            <div>${content}</div>
            ${sourcesHtml}
            ${!isUser ? `
              <div class="message-actions">
                <button class="msg-action-btn" onclick="chatAgent.copyMessage(${idx})"><i class="bi bi-copy"></i> Copy</button>
                <button class="msg-action-btn" onclick="chatAgent.regenerateMessage(${idx})"><i class="bi bi-arrow-repeat"></i> Regenerate</button>
                <button class="msg-action-btn" onclick="chatAgent.likeMessage(${idx})"><i class="bi bi-hand-thumbs-up"></i></button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
  },

  handleKeydown(e) {
    // Enter sends the message; Shift+Enter (or Ctrl/Cmd+Enter) inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  },

  // Client-side guard: obvious greetings/general chat never enter the RAG endpoint.
  // The backend has the authoritative classifier too, but this prevents an
  // accidental/stale RAG response from being displayed for simple greetings.
  shouldUseVault(text) {
    const q = (text || '').trim().toLowerCase();
    if (!q) return false;

    const greetings = [
      /^(hi|hello|hey|hiya|heyy|good morning|good afternoon|good evening)[!.?,\s]*$/,
      /^(hi|hello|hey)[,\s]+how are you(?: doing)?[?.!]*$/,
      /^how are you(?: doing)?[?.!]*$/,
      /^how('?s| is) it going[?.!]*$/,
      /^what's up[?.!]*$/,
      /^how have you been[?.!]*$/
    ];
    if (greetings.some(r => r.test(q))) return false;

    const vaultSignals = [
      /\bmy\b/, /\bour\b/, /\bwe\b/, /\bpersonal\b/, /\bproject\b/,
      /\binternal\b/, /\bcompany\b/, /\btrade(s|ing)?\b/, /\bportfolio\b/,
      /\bstrategy\b/, /\bstrategies\b/, /\bmental model\b/, /\bobsidian\b/,
      /\bvault\b/, /\bknowledge base\b/, /\bnotes?\b/, /\baccording to\b/,
      /\bwhat did i\b/, /\bwhat have i\b/, /\bmy previous\b/, /\bmy past\b/,
      /\bour documentation\b/, /\bour docs\b/, /\bthis project\b/,
      /\bthis product\b/, /\barchitecture\b/, /\bimplementation\b/,
      /\bcodebase\b/, /\bbackend\b/, /\bfrontend\b/, /\bagent\b/,
      /\borchestrator\b/, /\bobsidian integration\b/, /\baudio studio\b/,
      /\bproduct launch\b/, /\broadmap\b/, /\brequirements\b/,
      /\bconfiguration\b/
    ];
    return vaultSignals.some(r => r.test(q));
  },

  async sendMessage() {
    const input = document.getElementById('chatInput');
    const container = document.getElementById('chatMessages');
    if (!input || !container) return;
    const text = input.value.trim();
    if (!text) return;

    // Remove welcome screen if present
    if (this.messages.length === 0) {
      container.innerHTML = '';
    }

    this.messages.push({ role: 'user', content: text });

    // Create/persist the conversation immediately. This protects the user's
    // message even if the AI request fails or the page is refreshed while it
    // is waiting for a response.
    if (!this.currentConversation) {
      const newConv = {
        id: Date.now(),
        title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
        preview: text.substring(0, 50),
        timestamp: new Date().toISOString(),
        messages: [...this.messages]
      };
      this.conversations.unshift(newConv);
      this.currentConversation = newConv;
      const title = document.getElementById('chatTitle');
      if (title) title.textContent = newConv.title;
      this.renderConversationList();
    } else {
      this.currentConversation.messages = [...this.messages];
      this.currentConversation.preview = text.substring(0, 50);
      this.currentConversation.timestamp = new Date().toISOString();
    }
    await this.persistConversation(this.currentConversation);

    this.renderMessages();
    input.value = '';
    input.style.height = 'auto';

    // Show typing indicator
    const typingId = 'typing-' + Date.now();
    container.innerHTML += `
      <div class="message ai" id="${typingId}">
        <div class="message-avatar" style="background:linear-gradient(135deg,var(--primary-500),var(--accent-500));color:white;"><i class="bi bi-stars"></i></div>
        <div class="message-content">
          <div class="typing-indicator"><span></span><span></span><span></span></div>
        </div>
      </div>
    `;
    container.scrollTop = container.scrollHeight;

    let response = "";
    let sources = [];
    try {
      const apiMsgs = this.messages.map(m => ({
        role: m.role === 'ai' || m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      // Obvious/general messages are sent to a dedicated direct endpoint.
      // Project/personal messages use the normal intent-routed chat endpoint.
      const endpoint = this.shouldUseVault(text)
        ? '/api/v1/chat'
        : '/api/v1/chat/direct';

      const data = await app.api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          messages: apiMsgs,
          include_sources: false
        })
      });

      if (!data?.success || !data?.data?.reply) {
        throw new Error(data?.error?.message || data?.detail || 'Backend returned no AI response.');
      }

      response = data.data.reply;
      sources = data.data.sources || [];
    } catch (err) {
      console.error("Chat API error:", err);
      response = `I couldn't get a response from the AI backend. ${err.message || 'Check the backend logs.'}`;
    }

    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    this.messages.push({ role: 'ai', content: response, sources: sources });
    this.renderMessages();

    // Persist the completed assistant response as well.
    if (this.currentConversation) {
      this.currentConversation.messages = [...this.messages];
      this.currentConversation.preview = text.substring(0, 50);
      this.currentConversation.timestamp = new Date().toISOString();
      await this.persistConversation(this.currentConversation);
      this.renderConversationList();
    }
  },

  generateResponse(text) {
    const lower = text.toLowerCase();
    if (lower.includes('code') || lower.includes('python') || lower.includes('javascript') || lower.includes('html')) {
      return `Here's a sample code snippet based on your request:

\`\`\`python
def hello_world():
    print("Hello from AI Orchestrator!")
    return {"status": "success", "message": "Code generated"}

if __name__ == "__main__":
    result = hello_world()
    print(result)
\`\`\`

This is a basic example. Would you like me to expand on this or generate something more specific?`;
    }
    if (lower.includes('table') || lower.includes('data') || lower.includes('compare')) {
      return `Here's a comparison table:

| Feature | Basic | Pro | Enterprise |
|---------|-------|-----|------------|
| Users | 5 | 25 | Unlimited |
| Storage | 10GB | 100GB | 1TB |
| Support | Email | Priority | Dedicated |
| API Calls | 1K/mo | 10K/mo | Unlimited |

Let me know if you need more details!`;
    }
    if (lower.includes('email') || lower.includes('write') || lower.includes('draft')) {
      return `Here's a draft for you:

**Subject:** Exciting Updates Ahead

Dear Team,

I hope this message finds you well. I'm writing to share some exciting updates about our upcoming product launch.

**Key Highlights:**
* New features designed to improve workflow efficiency
* Enhanced security protocols
* Improved user interface based on your feedback

We believe these changes will significantly enhance your experience.

Best regards,
Kaviyaa`;
    }
    return `That's an interesting question about "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}".

Based on my analysis, here are the key points to consider:

1. **Strategic Approach** - Start with a clear objective and measurable outcomes
2. **Execution Plan** - Break down into actionable phases with timelines
3. **Resource Allocation** - Ensure proper staffing and budget distribution
4. **Risk Management** - Identify potential blockers early and plan contingencies

Would you like me to dive deeper into any of these areas?`;
  },

  receiveMessage(text) {
    document.getElementById('chatInput').value = text;
    this.sendMessage();
  },

  copyMessage(idx) {
    const msg = this.messages[idx];
    if (msg) {
      navigator.clipboard.writeText(msg.content).then(() => app.showToast('Copied', 'Message copied to clipboard', 'success'));
    }
  },

  async regenerateMessage(idx) {
    const previous = this.messages[idx - 1];
    if (!previous || previous.role !== 'user') return;
    this.messages = this.messages.slice(0, idx);
    this.renderMessages();
    const input = document.getElementById('chatInput');
    if (input) input.value = previous.content;
    await this.sendMessage();
  },

  likeMessage(idx) {
    app.showToast('Feedback', 'Thanks for your feedback!', 'success');
  },

  attachFile() {
    app.showToast('Attach', 'File attachment dialog (simulated)', 'info');
  },

  voiceInput() {
    app.showToast('Voice', 'Voice input activated (simulated)', 'info');
  },

  exportConversation() {
    app.showToast('Export', 'Conversation exported as JSON', 'success');
  },

  clearConversation() {
    this.messages = [];
    this.showWelcome();
    app.showToast('Cleared', 'Conversation cleared', 'info');
  },

  toggleSidebar() {
    document.getElementById('chatSidebar').classList.toggle('open');
  }
};