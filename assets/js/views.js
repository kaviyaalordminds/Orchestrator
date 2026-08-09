/* ============================================
   VIEWS AGENT — Projects / Files / History
   All data is fetched live from the backend. No mock rows.
   ============================================ */

const viewsAgent = {
  _projects: [],
  _files: [],
  _history: [],

  onActivateProjects() { this.loadProjects(); },
  onActivateFiles() { this.loadFiles(); },
  onActivateHistory() { this.loadHistory(); },

  emptyRow(colspan, icon, message) {
    return `<tr><td colspan="${colspan}" style="text-align:center;padding:32px;color:var(--text-muted);">
      <i class="bi ${icon}" style="font-size:22px;display:block;margin-bottom:8px;"></i>${message}
    </td></tr>`;
  },

  // ---------------- PROJECTS ----------------

  async loadProjects() {
    const body = document.getElementById('projectsTableBody');
    if (!body) return;
    const [activeRes, archivedRes] = await Promise.all([
      app.api('/api/v1/projects'),
      app.api('/api/v1/projects?status=archived')
    ]);
    this._projects = activeRes?.data || [];
    this.renderProjects(this._projects);
    const setStat = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setStat('projectsStatActive', this._projects.length);
    setStat('projectsStatArchived', (archivedRes?.data || []).length);
  },

  renderProjects(projects) {
    const body = document.getElementById('projectsTableBody');
    if (!body) return;
    if (!projects.length) {
      body.innerHTML = this.emptyRow(6, 'bi-folder2-open', 'No projects yet. Create your first project to get started.');
      return;
    }
    body.innerHTML = projects.map(p => `
      <tr>
        <td><div style="font-weight:600;color:var(--text-primary);">${app.escapeHtml(p.name)}</div><div style="font-size:11px;color:var(--text-muted);">${app.escapeHtml(p.description || '')}</div></td>
        <td><span style="font-size:12px;text-transform:capitalize;">${app.escapeHtml(p.project_type || 'general')}</span></td>
        <td>—</td>
        <td>${app.timeAgo(p.updated_at)}</td>
        <td><span class="deploy-status-pill" ${p.status === 'archived' ? 'style="background:rgba(245,158,11,0.15);color:#fbbf24;"' : ''}><i class="bi ${p.status === 'archived' ? 'bi-pause-circle-fill' : 'bi-check-circle-fill'}"></i> ${p.status === 'archived' ? 'Archived' : 'Active'}</span></td>
        <td style="display:flex;gap:6px;">
          <button class="toolbar-btn" onclick="viewsAgent.openProject(${p.id})"><i class="bi bi-box-arrow-up-right"></i> Open</button>
          <button class="toolbar-btn" onclick="viewsAgent.renameProject(${p.id}, '${app.escapeHtml(p.name).replace(/'/g, "\\'")}')"><i class="bi bi-pencil"></i></button>
          <button class="toolbar-btn" onclick="viewsAgent.duplicateProject(${p.id})"><i class="bi bi-copy"></i></button>
          <button class="toolbar-btn" onclick="viewsAgent.archiveProject(${p.id})"><i class="bi ${p.status === 'archived' ? 'bi-arrow-counterclockwise' : 'bi-archive'}"></i></button>
          <button class="toolbar-btn" style="color:#f87171;" onclick="viewsAgent.deleteProject(${p.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  filterProjects(query) {
    const q = (query || '').toLowerCase();
    const filtered = this._projects.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    this.renderProjects(filtered);
  },

  async createProject() {
    const name = prompt('Project name:');
    if (!name || !name.trim()) return;
    const res = await app.api('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() })
    });
    if (res?.success) {
      app.showToast('Project Created', `"${name}" is ready.`, 'success');
      this.loadProjects();
    }
  },

  async renameProject(id, currentName) {
    const name = prompt('New project name:', currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;
    const res = await app.api(`/api/v1/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: name.trim() })
    });
    if (res?.success) {
      app.showToast('Renamed', 'Project updated.', 'success');
      this.loadProjects();
    }
  },

  async duplicateProject(id) {
    const res = await app.api(`/api/v1/projects/${id}/duplicate`, { method: 'POST' });
    if (res?.success) {
      app.showToast('Duplicated', 'A copy of the project was created.', 'success');
      this.loadProjects();
    }
  },

  async archiveProject(id) {
    const res = await app.api(`/api/v1/projects/${id}/archive`, { method: 'PUT' });
    if (res?.success) {
      app.showToast('Updated', `Project ${res.data.status === 'archived' ? 'archived' : 'restored'}.`, 'info');
      this.loadProjects();
    }
  },

  async deleteProject(id) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const res = await app.api(`/api/v1/projects/${id}`, { method: 'DELETE' });
    if (res?.success) {
      app.showToast('Deleted', 'Project removed.', 'info');
      this.loadProjects();
    }
  },

  async openProject(id) {
    const res = await app.api(`/api/v1/projects/${id}`);
    if (!res?.success) return;
    app.loadProject(res.data.project.name);
    app.showToast(res.data.project.name, `${res.data.asset_count} asset(s) in this project.`, 'info');
  },

  // ---------------- FILES ----------------

  async loadFiles() {
    const body = document.getElementById('filesTableBody');
    if (!body) return;
    const typeFilter = document.getElementById('filesTypeFilter')?.value || '';
    const res = await app.api(`/api/v1/files/list${typeFilter ? `?tool=${encodeURIComponent(typeFilter)}` : ''}`);
    this._files = res?.data || [];
    this.renderFiles(this._files);
    this.renderFileStats(this._files);
  },

  renderFileStats(files) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const totalBytes = files.reduce((sum, f) => sum + (f.size_bytes || 0), 0);
    set('filesStatTotal', files.length);
    set('filesStatImages', files.filter(f => (f.file_type || '').startsWith('image/')).length);
    set('filesStatDocs', files.filter(f => /word|excel|presentation|pdf/.test(f.file_type || '')).length);
    set('filesStatWebsites', files.filter(f => f.tool === 'website' || f.tool === '3d_websites').length);
    set('filesStatStorage', `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`);
  },

  renderFiles(files) {
    const body = document.getElementById('filesTableBody');
    if (!body) return;
    if (!files.length) {
      body.innerHTML = this.emptyRow(6, 'bi-file-earmark', 'No files yet. Generated and uploaded assets will appear here.');
      return;
    }
    body.innerHTML = files.map(f => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;"><i class="bi bi-file-earmark"></i></div>
          <div><div style="font-weight:500;color:var(--text-primary);">${app.escapeHtml(f.filename)}</div><div style="font-size:11px;color:var(--text-muted);">${app.escapeHtml(f.tool || '')}</div></div>
        </div></td>
        <td>${app.escapeHtml((f.file_type || '').split('/').pop() || '—')}</td>
        <td>${((f.size_bytes || 0) / 1024).toFixed(0)} KB</td>
        <td>${f.project_id || '—'}</td>
        <td>${app.timeAgo(f.created_at)}</td>
        <td style="display:flex;gap:8px;">
          <a class="toolbar-btn" href="${app.apiBase}${f.file_path}" target="_blank"><i class="bi bi-eye"></i></a>
          <a class="toolbar-btn" href="${app.apiBase}${f.file_path}" download><i class="bi bi-download"></i></a>
          <button class="toolbar-btn" style="color:#f87171;" onclick="viewsAgent.deleteFile(${f.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  filterFiles(query) {
    const q = (query || '').toLowerCase();
    this.renderFiles(this._files.filter(f => f.filename.toLowerCase().includes(q)));
  },

  async uploadFile(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${app.apiBase}/api/v1/files/upload`, {
        method: 'POST',
        headers: { Authorization: app.getAuthHeaders().Authorization || '' },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        app.showToast('Uploaded', `${file.name} uploaded.`, 'success');
        this.loadFiles();
      } else {
        app.showToast('Upload Failed', data?.error?.message || data?.detail || 'Could not upload file', 'error');
      }
    } catch (e) {
      app.showToast('Connection Error', 'Could not reach the server.', 'error');
    }
  },

  async deleteFile(id) {
    if (!confirm('Delete this file?')) return;
    const res = await app.api(`/api/v1/files/${id}`, { method: 'DELETE' });
    if (res?.success) {
      app.showToast('Deleted', 'File removed.', 'info');
      this.loadFiles();
    }
  },

  // ---------------- HISTORY ----------------

  async loadHistory() {
    const body = document.getElementById('historyTableBody');
    if (!body) return;
    const res = await app.api('/api/v1/history?limit=100');
    this._history = res?.data || [];
    this.renderHistory(this._history);
  },

  renderHistory(items) {
    const body = document.getElementById('historyTableBody');
    if (!body) return;
    if (!items.length) {
      body.innerHTML = this.emptyRow(5, 'bi-clock-history', 'No generation history yet.');
      return;
    }
    const statusPill = (status) => {
      if (status === 'failed') return `<span class="deploy-status-pill" style="background:rgba(239,68,68,0.15);color:#f87171;"><i class="bi bi-x-circle-fill"></i> Failed</span>`;
      if (status === 'processing' || status === 'pending') return `<span class="deploy-status-pill" style="background:rgba(245,158,11,0.15);color:#fbbf24;"><i class="bi bi-hourglass-split"></i> Processing</span>`;
      return `<span class="deploy-status-pill"><i class="bi bi-check-circle-fill"></i> Complete</span>`;
    };
    body.innerHTML = items.map(g => `
      <tr>
        <td style="text-transform:capitalize;">${app.escapeHtml(g.tool || '')}</td>
        <td>${app.escapeHtml((g.prompt || '').slice(0, 60) || 'Untitled')}</td>
        <td>${app.timeAgo(g.created_at)}</td>
        <td>${statusPill(g.status)}</td>
        <td>${g.result ? `<a class="toolbar-btn" href="${g.result.startsWith('http') ? g.result : app.apiBase + g.result}" target="_blank"><i class="bi bi-eye"></i> Open</a>` : '—'}</td>
      </tr>
    `).join('');
  }
};
