/* ============================================
   APP CORE - AI ORCHESTRATOR PLATFORM
   ============================================ */

const app = {
  state: {
    currentView: 'dashboard',
    currentProject: 'Project Alpha',
    theme: 'dark',
    commandTool: null,
    sidebarOpen: false,
    notifications: [
      { id: 1, title: 'Image generation complete', message: 'Your futuristic cityscape is ready', type: 'success', time: '2 min ago' },
      { id: 2, title: 'Export complete', message: 'Q4 Strategy Deck exported as PPTX', type: 'info', time: '15 min ago' },
      { id: 3, title: 'Storage warning', message: 'You have used 85% of your storage', type: 'warning', time: '1 hour ago' }
    ]
  },

  init() {
    this.loadTheme();
    this.setupEventListeners();
    chatAgent.init();
    audioAgent.init();
    imageAgent.init();
    documentAgent.init();
    videoAgent.init();
    posterAgent.init();
    logoAgent.init();
    this.showToast('Welcome to AI Creative Studio', 'Your specialized AI workspaces are ready', 'success');
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
        const view = btn.dataset.view;
        this.navigateTo(view);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });
  },

  resolveViewTarget(view) {
    const viewMap = {
      dashboard: 'dashboard',
      audio: 'audio',
      'image-enhance': 'image',
      'image-generate': 'image',
      video: 'video',
      'ppt-creation': 'document',
      'word-creation': 'document',
      excel: 'document',
      'poster-design': 'poster',
      'logo-design': 'logo',
      'website-creation': 'website',
      website3d: 'website3d',
      deployments: 'deployments',
      projects: 'projects',
      files: 'files',
      history: 'history',
      settings: 'settings',
      admin: 'admin',
      users: 'users',
      models: 'models',
      analytics: 'analytics',
      jobs: 'jobs',
      audit: 'audit',
      system: 'system'
    };
    return viewMap[view] || view;
  },

  navigateTo(view) {
    this.state.currentView = view;
    const resolvedView = this.resolveViewTarget(view);

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.querySelectorAll('.workspace-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${resolvedView}`);
    if (target) target.classList.add('active');

    const names = {
      dashboard: 'Dashboard',
      audio: 'Audio',
      'image-enhance': 'Image Enhancement',
      'image-generate': 'Image Generation',
      video: 'Video Creation',
      'ppt-creation': 'PPT Creation',
      'word-creation': 'Word Creation',
      excel: 'Excel',
      'poster-design': 'Poster Design',
      'logo-design': 'Logo Design',
      'website-creation': 'Website Creation',
      website3d: '3D Website Creation',
      deployments: 'Deployments',
      projects: 'Projects',
      history: 'History',
      files: 'Files',
      settings: 'Settings',
      admin: 'Admin Dashboard',
      users: 'Users',
      models: 'AI Models',
      analytics: 'Usage Analytics',
      jobs: 'Generation Jobs',
      audit: 'Audit Logs',
      system: 'System Settings'
    };
    document.getElementById('breadcrumbView').textContent = names[view] || view;
    document.getElementById('sidebar').classList.remove('open');

    if (view === 'audio') audioAgent.onActivate();
    if (view === 'image-enhance') {
      imageAgent.onActivate();
      imageAgent.switchTab('enhance');
    }
    if (view === 'image-generate') {
      imageAgent.onActivate();
      imageAgent.switchTab('generate');
    }
    if (view === 'video') videoAgent.onActivate();
    if (view === 'ppt-creation') {
      documentAgent.onActivate();
      documentAgent.switchTab('ppt');
    }
    if (view === 'word-creation') {
      documentAgent.onActivate();
      documentAgent.switchTab('word');
    }
    if (view === 'excel') {
      documentAgent.onActivate();
      documentAgent.switchTab('excel');
    }
    if (view === 'poster-design') posterAgent.onActivate();
    if (view === 'logo-design') logoAgent.onActivate();
    if (view === 'website-creation') websiteAgent.onActivate();
    if (view === 'website3d') website3dAgent.onActivate();
    if (view === 'deployments') deployAgent.onActivate();
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  },

  loadProject(name) {
    this.state.currentProject = name;
    document.getElementById('breadcrumbProject').textContent = name;
    this.showToast('Project Loaded', `Switched to "${name}"`, 'info');
  },

  setupCommandBar() {
    const textarea = document.getElementById('commandInput');
    if (!textarea) return;
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.commandSend();
      }
    });
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  },

  setCommandTool(tool) {
    this.state.commandTool = tool;
    document.querySelectorAll('.tool-chip').forEach(chip => {
      chip.classList.toggle('active', chip.textContent.toLowerCase().includes(tool));
    });
  },

  commandSend() {
    const input = document.getElementById('commandInput');
    const text = input.value.trim();
    if (!text) return;

    const lower = text.toLowerCase();
    let targetView = 'chat';

    if (lower.includes('image') || lower.includes('picture') || lower.includes('photo')) {
      targetView = 'image';
    } else if (lower.includes('audio') || lower.includes('sound') || lower.includes('music') || lower.includes('voice')) {
      targetView = 'audio';
    } else if (lower.includes('video') || lower.includes('film')) {
      targetView = 'video';
    } else if (lower.includes('presentation') || lower.includes('slides') || lower.includes('ppt')) {
      targetView = 'document';
      setTimeout(() => documentAgent.switchTab('ppt'), 300);
    } else if (lower.includes('document') || lower.includes('word') || lower.includes('report')) {
      targetView = 'document';
      setTimeout(() => documentAgent.switchTab('word'), 300);
    } else if (lower.includes('excel') || lower.includes('spreadsheet') || lower.includes('csv')) {
      targetView = 'document';
      setTimeout(() => documentAgent.switchTab('excel'), 300);
    } else if (lower.includes('poster') || lower.includes('banner') || lower.includes('flyer')) {
      targetView = 'poster';
    } else if (lower.includes('logo') || lower.includes('brand')) {
      targetView = 'logo';
    } else if (lower.includes('website') || lower.includes('site') || lower.includes('web')) {
      targetView = 'website';
    } else if (lower.includes('3d')) {
      targetView = 'website3d';
    }

    this.navigateTo(targetView);
    input.value = '';
    input.style.height = 'auto';

    setTimeout(() => {
      if (targetView === 'chat') {
        chatAgent.newConversation();
        setTimeout(() => chatAgent.receiveMessage(text), 500);
      } else if (targetView === 'image') {
        document.getElementById('imgPrompt').value = text;
        this.showToast('Intent Detected', 'Routing to Image Studio', 'info');
      } else if (targetView === 'audio') {
        document.getElementById('audioPrompt').value = text;
        this.showToast('Intent Detected', 'Routing to Audio Studio', 'info');
      } else if (targetView === 'video') {
        document.getElementById('videoPrompt').value = text;
        this.showToast('Intent Detected', 'Routing to Video Studio', 'info');
      } else if (targetView === 'poster') {
        document.getElementById('posterTitle').value = text;
        this.showToast('Intent Detected', 'Routing to Poster Studio', 'info');
      } else if (targetView === 'logo') {
        document.getElementById('logoCompany').value = text;
        this.showToast('Intent Detected', 'Routing to Logo Studio', 'info');
      } else if (targetView === 'document') {
        const tab = document.querySelector('.doc-tab.active');
        if (tab && tab.textContent.includes('PowerPoint')) {
          document.getElementById('pptTopic').value = text;
        } else if (tab && tab.textContent.includes('Word')) {
          document.getElementById('wordTitle').value = text;
        }
        this.showToast('Intent Detected', 'Routing to Document Studio', 'info');
      }
    }, 400);
  },

  commandAttach() {
    this.showToast('File Upload', 'Select files to attach (simulated)', 'info');
  },

  commandVoice() {
    this.showToast('Voice Input', 'Listening... (simulated)', 'info');
  },

  showModal(id) {
    document.getElementById(id).classList.add('active');
  },

  closeModal(id) {
    document.getElementById(id).classList.remove('active');
  },

  showImageModal(src) {
    document.getElementById('modalImage').src = src;
    this.showModal('imageModal');
  },

  showSearch() {
    this.showToast('Global Search', 'Search across all projects and generations', 'info');
  },

  showNotifications() {
    this.state.notifications.forEach(n => {
      this.showToast(n.title, n.message, n.type);
    });
  },

  showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
    toast.innerHTML = `
      <i class="bi ${icons[type]} toast-icon"></i>
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