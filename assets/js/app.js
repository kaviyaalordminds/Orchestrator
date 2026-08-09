/* ============================================
   APP CORE - Orchestrator
   ============================================ */

const app = {
  state: {
    currentView: 'dashboard',
    currentProject: null,
    theme: 'dark',
    sidebarOpen: false,
    notifications: []
  },

  apiBase: 'http://localhost:8000',

  getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  },

  isAuthed() {
    return !!localStorage.getItem('jwt_token');
  },

  // Central fetch helper used across all studio agents.
  // Returns the parsed JSON body on success; on failure it toasts a real
  // error (never invents fake data) and returns null so callers can render
  // an empty/error state.
  async api(path, options = {}) {
    try {
      const res = await fetch(`${this.apiBase}${path}`, {
        ...options,
        headers: { ...this.getAuthHeaders(), ...(options.headers || {}) }
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }
      if (!res.ok) {
        const msg = data?.error?.message || data?.detail || `Request failed (${res.status})`;
        if (res.status === 401) {
          this.showToast('Session Expired', 'Please log in again.', 'warning');
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('user_info');
          this.navigateTo('login');
        } else {
          this.showToast('Error', msg, 'error');
        }
        return null;
      }
      return data;
    } catch (err) {
      console.error('API error:', path, err);
      this.showToast('Connection Error', 'Could not reach the server.', 'error');
      return null;
    }
  },

  init() {
    this.loadTheme();
    this.setupEventListeners();
    // Init agents that have init methods
    if (window.authAgent) authAgent.init();
    if (window.chatAgent) chatAgent.init();
    if (window.audioAgent) audioAgent.init();
    if (window.imageAgent) imageAgent.init();
    if (window.videoAgent) videoAgent.init();
    if (window.posterAgent) posterAgent.init();
    if (window.logoAgent) logoAgent.init();
    // New dedicated agents
    if (window.pptAgent) pptAgent.onActivate();
    if (window.excelAgent) excelAgent.onActivate();

    if (this.isAuthed()) {
      this.loadDashboard();
      this.loadNotifications();
    } else {
      this.renderEmptyDashboard();
    }

    this.showToast('Orchestrator', 'Welcome — choose a studio to begin.', 'success');
  },

  // ---- Real dashboard data (no mock content) ----

  async loadDashboard() {
    const [recent, projects, storage] = await Promise.all([
      this.api('/api/v1/recent?limit=8'),
      this.api('/api/v1/projects'),
      this.api('/api/v1/settings/storage')
    ]);
    this.renderRecentActivity(recent?.data || []);
    this.renderUsageStats(storage?.data || null, recent?.data || []);
    if (projects?.data?.length) {
      this.loadProject(projects.data[0].name);
    }
  },

  renderEmptyDashboard() {
    this.renderRecentActivity([]);
    this.renderUsageStats(null, []);
  },

  renderRecentActivity(items) {
    const grid = document.getElementById('recentActivityGrid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:32px 16px;color:var(--text-muted);">
          <i class="bi bi-clock-history" style="font-size:24px;display:block;margin-bottom:8px;"></i>
          No recent activity yet. Generate something to see it here.
        </div>`;
      return;
    }
    const iconMap = {
      image: { icon: 'bi-image', bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)' },
      video: { icon: 'bi-camera-reels', bg: 'linear-gradient(135deg,#8b5cf6,#a855f7)' },
      ppt: { icon: 'bi-file-earmark-slides', bg: 'linear-gradient(135deg,#10b981,#06b6d4)' },
      word: { icon: 'bi-file-earmark-word', bg: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
      excel: { icon: 'bi-file-earmark-excel', bg: 'linear-gradient(135deg,#14b8a6,#10b981)' },
      poster: { icon: 'bi-easel', bg: 'linear-gradient(135deg,#f97316,#f59e0b)' },
      logo: { icon: 'bi-hexagon', bg: 'linear-gradient(135deg,#6366f1,#06b6d4)' },
      website: { icon: 'bi-globe', bg: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
      audio: { icon: 'bi-mic', bg: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
    };
    const viewMap = { image: 'image-generate', video: 'video', ppt: 'ppt', word: 'word', excel: 'excel', poster: 'poster', logo: 'logo', website: 'website', audio: 'audio' };

    grid.innerHTML = items.map(item => {
      const meta = iconMap[item.tool] || { icon: 'bi-file-earmark', bg: 'linear-gradient(135deg,#64748b,#94a3b8)' };
      const view = viewMap[item.tool] || 'history';
      const title = (item.title || 'Untitled').slice(0, 60);
      const time = this.timeAgo(item.created_at);
      return `
        <div class="recent-card" onclick="app.navigateTo('${view}')">
          <div class="recent-card-header">
            <div class="recent-card-icon" style="background:${meta.bg};color:white;"><i class="bi ${meta.icon}"></i></div>
            <div><div class="recent-card-title">${this.escapeHtml(title)}</div><div class="recent-card-meta">${this.escapeHtml(item.tool || '')} · ${time}</div></div>
          </div>
        </div>`;
    }).join('');
  },

  renderUsageStats(storage, recentItems) {
    const counts = {};
    recentItems.forEach(i => { counts[i.tool] = (counts[i.tool] || 0) + 1; });
    const total = recentItems.length || 1;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setBar = (id, val) => { const el = document.getElementById(id); if (el) el.style.width = `${Math.min(100, Math.round((val / total) * 100))}%`; };

    const totalReq = recentItems.length;
    const imageC = counts.image || 0;
    const videoC = counts.video || 0;
    const docC = (counts.ppt || 0) + (counts.word || 0) + (counts.excel || 0);
    const webC = counts.website || 0;

    set('usageTotalRequests', totalReq);
    set('usageImageGens', imageC);
    set('usageVideoGens', videoC);
    set('usageDocGens', docC);
    set('usageWebGens', webC);

    setBar('usageTotalRequestsBar', totalReq);
    setBar('usageImageGensBar', imageC);
    setBar('usageVideoGensBar', videoC);
    setBar('usageDocGensBar', docC);
    setBar('usageWebGensBar', webC);
  },

  async loadNotifications() {
    // Derive notifications from real recent activity + storage warnings — never fabricated.
    const recent = await this.api('/api/v1/recent?limit=5');
    const storage = await this.api('/api/v1/settings/storage');
    const notifications = [];
    (recent?.data || []).forEach(item => {
      if (item.status === 'failed') {
        notifications.push({ id: `gen-${item.kind}-${item.id}`, title: `${item.tool} generation failed`, message: (item.title || '').slice(0, 80), type: 'error', time: this.timeAgo(item.created_at) });
      } else if (item.status === 'completed') {
        notifications.push({ id: `gen-${item.kind}-${item.id}`, title: `${item.tool} ready`, message: (item.title || 'Generation complete').slice(0, 80), type: 'success', time: this.timeAgo(item.created_at) });
      }
    });
    if (storage?.data && storage.data.total_bytes > 0) {
      const usedMB = storage.data.total_bytes / (1024 * 1024);
      if (usedMB > 500) {
        notifications.push({ id: 'storage-warning', title: 'Storage usage high', message: `You've used ${usedMB.toFixed(0)}MB of storage.`, type: 'warning', time: 'now' });
      }
    }
    this.state.notifications = notifications;
    this.renderNotifications();
  },

  timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  loadTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    this.setTheme(saved);
  },

  setTheme(theme) {
    this.state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) {
      icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
    }
    localStorage.setItem('theme', theme);
  },

  toggleTheme() {
    this.setTheme(this.state.theme === 'dark' ? 'light' : 'dark');
  },

  setupEventListeners() {
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigateTo(btn.dataset.view);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });

    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('notificationsDropdown');
      const btn = document.getElementById('notificationBtn');
      if (dropdown && dropdown.classList.contains('active') && btn &&
          !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  },

  // Map sidebar data-view values to workspace view IDs
  _viewIdMap: {
    dashboard:       'dashboard',
    chat:            'chat',
    audio:           'audio',
    'image-generate': 'image-generate',
    'image-enhance': 'image-enhance',
    video:           'video',
    ppt:             'ppt',
    word:            'word',
    excel:           'excel',
    poster:          'poster',
    logo:            'logo',
    website:         'website',
    website3d:       'website3d',
    deployments:     'deployments',
    projects:        'projects',
    files:           'files',
    history:         'history',
    settings:        'settings',
    login:           'login',
    register:        'register',
    admin:           'admin',
    users:           'users',
    models:          'models',
    analytics:       'analytics',
    jobs:            'jobs',
    audit:           'audit',
    system:          'system',
  },

  _viewNames: {
    dashboard:        'Dashboard',
    chat:             'AI Chat',
    audio:            'Audio Studio',
    'image-generate': 'Image Generation',
    'image-enhance':  'Image Enhancement',
    video:            'Video Studio',
    ppt:              'PPT Creation',
    word:             'Word Creation',
    excel:            'Excel Creation',
    poster:           'Poster Design',
    logo:             'Logo Design',
    website:          'Website Studio',
    website3d:        '3D Web Studio',
    deployments:      'Deployments',
    projects:         'Projects',
    files:            'Files',
    history:          'History',
    settings:         'Settings',
    login:            'Login',
    register:         'Register',
    admin:            'Admin Dashboard',
    users:            'Users',
    models:           'AI Models',
    analytics:        'Usage Analytics',
    jobs:             'Generation Jobs',
    audit:            'Audit Logs',
    system:           'System Settings',
  },

  navigateTo(view) {
    this.state.currentView = view;
    const viewId = this._viewIdMap[view] || view;

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Switch workspace views
    document.querySelectorAll('.workspace-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.add('active');

    // Update breadcrumb
    const breadcrumb = document.getElementById('breadcrumbView');
    if (breadcrumb) breadcrumb.textContent = this._viewNames[view] || view;

    // Close mobile sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Auth mode toggle (hide sidebar/topbar)
    const container = document.querySelector('.app-container');
    if (container) {
      container.classList.toggle('auth-mode', view === 'login' || view === 'register');
    }

    // Trigger onActivate for dedicated studio agents
    try {
      if (view === 'login' && window.authAgent) authAgent.onActivate();
      if (view === 'register' && window.authAgent) authAgent.onActivate();
      if (view === 'chat' && window.chatAgent) chatAgent.onActivate();
      if (view === 'audio' && window.audioAgent) audioAgent.onActivate();
      if (view === 'image-generate' && window.imageAgent) imageAgent.onActivate();
      if (view === 'image-enhance' && window.imageEnhanceAgent) imageEnhanceAgent.onActivate();
      if (view === 'video' && window.videoAgent) videoAgent.onActivate();
      if (view === 'ppt' && window.pptAgent) pptAgent.onActivate();
      if (view === 'word' && window.wordAgent) wordAgent.onActivate();
      if (view === 'excel' && window.excelAgent) excelAgent.onActivate();
      if (view === 'poster' && window.posterAgent) posterAgent.onActivate();
      if (view === 'logo' && window.logoAgent) logoAgent.onActivate();
      if (view === 'website' && window.websiteAgent) websiteAgent.onActivate();
      if (view === 'website3d' && window.website3dAgent) website3dAgent.onActivate();
      if (view === 'deployments' && window.deployAgent) deployAgent.onActivate();
      if (view === 'projects' && window.viewsAgent) viewsAgent.onActivateProjects();
      if (view === 'files' && window.viewsAgent) viewsAgent.onActivateFiles();
      if (view === 'history' && window.viewsAgent) viewsAgent.onActivateHistory();
      if (view === 'settings' && window.settingsAgent) settingsAgent.onActivate();
    } catch (e) {
      console.warn('onActivate error:', e);
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  },

  loadProject(name) {
    this.state.currentProject = name;
    const el = document.getElementById('breadcrumbProject');
    if (el) el.textContent = name;
  },

  showModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  },

  showImageModal(src) {
    const img = document.getElementById('modalImage');
    if (img) img.src = src;
    this.showModal('imageModal');
  },

  showSearch() {
    const input = document.getElementById('globalSearchInput');
    if (input) input.value = '';
    this.filterSearch('');
    this.showModal('searchModal');
    setTimeout(() => { if (input) input.focus(); }, 100);
  },

  filterSearch(query) {
    const resultsContainer = document.getElementById('searchResultList');
    if (!resultsContainer) return;
    const q = (query || '').toLowerCase();

    // Search across studio names and recent items
    const studioLinks = [
      { title: 'Audio Studio', desc: 'Voice, TTS & transcription', view: 'audio' },
      { title: 'Image Generation', desc: 'Text-to-image AI studio', view: 'image-generate' },
      { title: 'Image Enhancement', desc: 'Restore, upscale & enhance images', view: 'image-enhance' },
      { title: 'Video Studio', desc: 'Cinematic AI video creation', view: 'video' },
      { title: 'PPT Creation', desc: 'AI presentation studio', view: 'ppt' },
      { title: 'Word Creation', desc: 'Professional document studio', view: 'word' },
      { title: 'Excel Creation', desc: 'Spreadsheet & data analysis', view: 'excel' },
      { title: 'Poster Design', desc: 'AI graphic design canvas', view: 'poster' },
      { title: 'Logo Design', desc: 'Brand identity studio', view: 'logo' },
      { title: 'Website Studio', desc: 'AI website builder', view: 'website' },
      { title: '3D Web Studio', desc: 'WebGL & Three.js experiences', view: 'website3d' },
    ];

    const filtered = q ? studioLinks.filter(s =>
      s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)
    ) : studioLinks;

    if (filtered.length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">
          <i class="bi bi-search" style="font-size:24px;display:block;margin-bottom:8px;"></i>
          No studios found matching "${query}"
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = filtered.map(s => `
      <div class="search-result-item" onclick="app.closeModal('searchModal');app.navigateTo('${s.view}')" style="padding:12px;border-radius:8px;background:var(--bg-body);border:1px solid var(--border-color);cursor:pointer;transition:all 0.2s;text-align:left;">
        <div style="font-weight:600;font-size:13px;color:var(--text-primary);">${s.title}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">${s.desc}</div>
      </div>
    `).join('');
  },

  showNotifications(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('notificationsDropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('active');
    if (dropdown.classList.contains('active')) {
      this.renderNotifications();
    }
  },

  renderNotifications() {
    const list = document.getElementById('notificationsList');
    const badge = document.getElementById('notificationBadge');
    if (!list) return;

    const count = this.state.notifications.length;
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'block' : 'none';
    }

    if (count === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">
          <i class="bi bi-bell-slash" style="font-size:20px;display:block;margin-bottom:6px;"></i>
          No notifications
        </div>
      `;
      return;
    }

    const icons = {
      success: 'bi-check-circle-fill',
      info: 'bi-info-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      error: 'bi-x-circle-fill'
    };

    list.innerHTML = this.state.notifications.map(n => `
      <div class="notification-item" onclick="app.showToast('${n.title.replace(/'/g, "\\'")}', '${n.message.replace(/'/g, "\\'")}', '${n.type}')">
        <div class="notification-item-icon ${n.type}">
          <i class="bi ${icons[n.type] || 'bi-bell-fill'}"></i>
        </div>
        <div class="notification-item-content">
          <div class="notification-item-title">${n.title}</div>
          <div class="notification-item-msg">${n.message}</div>
          <div class="notification-item-time">${n.time}</div>
        </div>
      </div>
    `).join('');
  },

  clearNotifications(e) {
    if (e) e.stopPropagation();
    this.state.notifications = [];
    this.renderNotifications();
    this.showToast('Cleared', 'All notifications cleared', 'info');
  },

  showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
      success: 'bi-check-circle-fill',
      error: 'bi-x-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      info: 'bi-info-circle-fill'
    };
    toast.innerHTML = `
      <i class="bi ${icons[type] || icons.info} toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <i class="bi bi-x"></i>
      </button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};