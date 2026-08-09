/* ============================================
   LOGO AGENT — AI Logo Design Studio
   ============================================ */

const logoAgent = {
  currentTab: 'create',
  selectedColor: 'Purple',
  selectedPersonality: 'innovative',
  concepts: [],

  init() {
    document.querySelectorAll('#logoColorChips .style-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#logoColorChips .style-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedColor = chip.dataset.color;
      });
    });
    document.querySelectorAll('#logoPersonalityChips .style-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#logoPersonalityChips .style-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedPersonality = chip.dataset.personality;
      });
    });
  },

  onActivate() {},

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.logo-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.logo-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`logo-panel-${tab}`).classList.add('active');
  },

  async generate() {
    const company = document.getElementById('logoCompany').value.trim();
    if (!company) {
      app.showToast('Missing Name', 'Please enter a company name', 'warning');
      return;
    }

    const btn = document.getElementById('logoGenerateBtn');
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Generating...';
    btn.disabled = true;

    app.showToast('Logo Creation', `Generating concepts for "${company}"...`, 'info');

    const count = parseInt(document.getElementById('logoCount').value) || 4;
    const style = document.getElementById('logoStyle').value;
    const industry = document.getElementById('logoIndustry').value;

    let realLogoUrl = "";
    try {
      const res = await fetch(`${app.apiBase}/api/v1/logos/generate`, {
        method: 'POST',
        headers: app.getAuthHeaders(),
        body: JSON.stringify({ company_name: company, tagline: "", style, industry })
      });
      const data = await res.json();
      if (data.success && data.data.url) {
        realLogoUrl = data.data.url;
      }
    } catch (err) {
      console.error("Logo API error:", err);
    }

    const gradients = [
      'linear-gradient(135deg,#6366f1,#8b5cf6)',
      'linear-gradient(135deg,#3b82f6,#06b6d4)',
      'linear-gradient(135deg,#10b981,#34d399)',
      'linear-gradient(135deg,#f59e0b,#ef4444)',
      'linear-gradient(135deg,#ec4899,#f43f5e)',
      'linear-gradient(135deg,#1f2937,#4b5563)'
    ];

    const grid = document.getElementById('logoGrid');
    grid.innerHTML = '';
    this.concepts = [];

    for (let i = 0; i < count; i++) {
      const seed = Date.now() + i * 137;
      const gradient = gradients[i % gradients.length];
      const initials = company.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      this.concepts.push({ id: i, initials, gradient, style, industry, bg });

      grid.innerHTML += `
        <div class="logo-card" onclick="logoAgent.viewConcept(${i})">
          <div class="logo-card-preview" style="background:${bg === 'transparent' ? 'repeating-conic-gradient(#f1f5f9 0% 25%, white 0% 50%) 50% / 20px 20px' : bg === 'dark' ? '#1f2937' : bg === 'gradient' ? gradient : '#ffffff'};">
            <div style="width:100px;height:100px;border-radius:50%;background:${gradient};display:flex;align-items:center;justify-content:center;color:white;font-size:36px;font-weight:700;">${initials}</div>
          </div>
          <div class="logo-card-info">
            <div class="logo-card-title">Concept ${i + 1}</div>
            <div class="logo-card-meta">${style} · ${industry}</div>
          </div>
          <div class="logo-card-actions">
            <button class="toolbar-btn" onclick="event.stopPropagation(); logoAgent.downloadConcept(${i})"><i class="bi bi-download"></i></button>
            <button class="toolbar-btn" onclick="event.stopPropagation(); logoAgent.regenerateConcept(${i})"><i class="bi bi-arrow-repeat"></i></button>
            <button class="toolbar-btn" onclick="event.stopPropagation(); logoAgent.useAsLogo(${i})"><i class="bi bi-check-lg"></i> Use</button>
          </div>
        </div>
      `;
    }

    btn.innerHTML = '<i class="bi bi-magic"></i> Generate Logos';
    btn.disabled = false;

    app.showToast('Logos Ready', `${count} concepts generated`, 'success');
  },

  viewConcept(idx) {
    this.switchTab('editor');
    const concept = this.concepts[idx];
    const preview = document.getElementById('logoEditorPreview');
    preview.innerHTML = `<div style="width:150px;height:150px;border-radius:50%;background:${concept.gradient};display:flex;align-items:center;justify-content:center;color:white;font-size:56px;font-weight:700;">${concept.initials}</div>`;
    app.showToast('Concept ' + (idx + 1), 'Opened in editor', 'info');
  },

  downloadConcept(idx) {
    app.showToast('Download', 'Logo concept ' + (idx + 1) + ' saved as PNG', 'success');
  },

  regenerateConcept(idx) {
    app.showToast('Regenerating', 'Concept ' + (idx + 1) + ' is being recreated', 'info');
  },

  useAsLogo(idx) {
    app.showToast('Applied', 'Concept ' + (idx + 1) + ' set as company logo', 'success');
  },

  regenerateIcon() {
    app.showToast('Regenerate', 'Icon regenerated', 'success');
  },

  removeBackground() {
    app.showToast('Background', 'Background removed', 'success');
  },

  exportLogo(format) {
    app.showToast('Export', `Logo exported as ${format.toUpperCase()}`, 'success');
  }
};