/* ============================================
   SETTINGS AGENT — real persistence via /api/v1/settings & /api/v1/auth/me
   ============================================ */

const settingsAgent = {
  _settings: null,

  onActivate() { this.load(); },

  async load() {
    const [settingsRes, meRes] = await Promise.all([
      app.api('/api/v1/settings'),
      app.api('/api/v1/auth/me')
    ]);
    if (settingsRes?.success) {
      this._settings = settingsRes.data;
      this.render(this._settings);
    }
    if (meRes?.success) {
      const user = meRes.data.user;
      const nameInput = document.getElementById('settingsFullName');
      if (nameInput) nameInput.value = user.full_name || '';
      const emailLabel = document.getElementById('accountEmailLabel');
      if (emailLabel) emailLabel.textContent = user.full_name || user.email;
      const avatar = document.getElementById('accountAvatar');
      if (avatar) avatar.textContent = (user.full_name || user.email || '?').charAt(0).toUpperCase();
    }
  },

  render(s) {
    const setSel = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setSel('settingsDefaultModel', s.default_model);
    setSel('settingsOutputQuality', s.output_quality);
    setSel('settingsLanguage', s.language);

    ['notify_generation_completed', 'notify_deployment_completed', 'notify_errors', 'notify_system'].forEach(key => {
      const el = document.getElementById(key);
      if (el) el.checked = !!s[key];
    });

    const toggle = document.getElementById('animationsToggle');
    const label = document.getElementById('animationsToggleLabel');
    if (toggle) {
      toggle.style.background = s.animations_enabled ? 'var(--primary-500)' : 'var(--border-color)';
      const dot = toggle.querySelector('div');
      if (dot) dot.style.right = s.animations_enabled ? '2px' : '22px';
    }
    if (label) label.textContent = s.animations_enabled ? 'Enabled' : 'Disabled';

    document.querySelectorAll('#accentColorSwatches [data-color]').forEach(el => {
      el.style.border = el.dataset.color === s.accent_color ? `2px solid ${s.accent_color}` : 'none';
    });
  },

  async updateField(key, value) {
    const res = await app.api('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({ [key]: value })
    });
    if (res?.success) {
      this._settings = res.data;
      app.showToast('Saved', 'Setting updated.', 'success');
    }
  },

  async updateTheme(theme) {
    app.setTheme(theme);
    await this.updateField('theme', theme);
  },

  async updateAccent(color) {
    document.querySelectorAll('#accentColorSwatches [data-color]').forEach(el => {
      el.style.border = el.dataset.color === color ? `2px solid ${color}` : 'none';
    });
    document.documentElement.style.setProperty('--primary-500', color);
    await this.updateField('accent_color', color);
  },

  async toggleAnimations() {
    const next = !(this._settings?.animations_enabled ?? true);
    await this.updateField('animations_enabled', next);
    if (this._settings) this._settings.animations_enabled = next;
    this.render(this._settings || { animations_enabled: next });
  },

  async saveProfile() {
    const fullName = document.getElementById('settingsFullName')?.value.trim();
    const res = await app.api('/api/v1/auth/me', {
      method: 'PUT',
      body: JSON.stringify({ full_name: fullName })
    });
    if (res?.success) {
      localStorage.setItem('user_info', JSON.stringify(res.data.user));
      app.showToast('Profile Updated', 'Your changes were saved.', 'success');
    }
  },

  signOut() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_info');
    app.showToast('Signed Out', 'You have been logged out.', 'info');
    app.navigateTo('login');
  }
};
