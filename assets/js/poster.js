/* ============================================
   POSTER AGENT — AI Poster Design Studio
   ============================================ */

const posterAgent = {
  currentTab: 'create',
  currentSize: 'a4',
  variations: [],

  init() {
    document.getElementById('posterSize').addEventListener('change', (e) => {
      this.currentSize = e.target.value;
      const canvas = document.getElementById('posterCanvas');
      canvas.className = `poster-canvas poster-size-${this.currentSize}`;
    });
  },

  onActivate() {},

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.poster-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.poster-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`poster-panel-${tab}`).classList.add('active');
  },

  selectLogo() {
    document.getElementById('posterLogoInput').click();
  },

  handleLogo(e) {
    if (e.target.files.length > 0) {
      app.showToast('Logo Uploaded', e.target.files[0].name, 'success');
    }
  },

  async generate() {
    const title = document.getElementById('posterTitle').value.trim();
    if (!title) {
      app.showToast('Missing Title', 'Please enter a poster title', 'warning');
      return;
    }

    const btn = document.getElementById('posterGenerateBtn');
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Designing...';
    btn.disabled = true;

    app.showToast('Poster Design', 'AI is designing your poster...', 'info');
    await new Promise(r => setTimeout(r, 2500));

    const type = document.getElementById('posterType').value;
    const style = document.getElementById('posterStyle').value;
    const date = document.getElementById('posterDate').value;
    const time = document.getElementById('posterTime').value;
    const location = document.getElementById('posterLocation').value;
    const desc = document.getElementById('posterDesc').value;
    const c1 = document.getElementById('posterColor1').value;
    const c2 = document.getElementById('posterColor2').value;

    const canvas = document.getElementById('posterCanvas');
    canvas.innerHTML = `
      <div style="width:100%;height:100%;background:linear-gradient(135deg,${c1},${c2});display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;color:white;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;bottom:0;opacity:0.1;background-image:url('data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"100\\" height=\\"100\\"><circle cx=\\"50\\" cy=\\"50\\" r=\\"40\\" fill=\\"white\\"/></svg>');background-size:80px;"></div>
        <div style="position:relative;z-index:1;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:3px;opacity:0.8;margin-bottom:20px;">${type}</div>
          <h1 style="font-size:32px;font-weight:700;margin-bottom:16px;line-height:1.2;">${title}</h1>
          ${desc ? `<p style="font-size:16px;opacity:0.9;margin-bottom:24px;max-width:80%;margin-left:auto;margin-right:auto;">${desc}</p>` : ''}
          <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;font-size:14px;opacity:0.85;">
            ${date ? `<span><i class="bi bi-calendar"></i> ${date}</span>` : ''}
            ${time ? `<span><i class="bi bi-clock"></i> ${time}</span>` : ''}
            ${location ? `<span><i class="bi bi-geo-alt"></i> ${location}</span>` : ''}
          </div>
          <div style="margin-top:30px;padding:10px 24px;border:2px solid rgba(255,255,255,0.4);border-radius:30px;display:inline-block;font-size:13px;font-weight:600;">${style} Design</div>
        </div>
      </div>
    `;

    document.getElementById('posterToolbar').style.display = 'flex';
    btn.innerHTML = '<i class="bi bi-magic"></i> Generate Poster';
    btn.disabled = false;

    app.showToast('Poster Ready', 'Your poster design is complete', 'success');
  },

  regenerate() {
    this.generate();
  },

  edit() {
    this.switchTab('editor');
    const canvas = document.getElementById('posterCanvas');
    const editorCanvas = document.getElementById('posterEditorCanvas');
    editorCanvas.innerHTML = canvas.innerHTML;
    app.showToast('Edit Mode', 'Poster editor opened', 'info');
  },

  download(format) {
    app.showToast('Export', `Preparing ${format.toUpperCase()}...`, 'info');
    setTimeout(() => app.showToast('Complete', `Poster saved as .${format}`, 'success'), 1200);
  },

  generateVariations() {
    app.showToast('Variations', 'Generating 4 design variations...', 'info');
    setTimeout(() => {
      app.showToast('Ready', 'Variations generated', 'success');
    }, 2000);
  },

  selectVariation(idx) {
    app.showToast('Selected', `Design ${idx + 1} selected`, 'success');
  },

  editVariation(idx) {
    this.switchTab('editor');
    app.showToast('Edit', `Editing variation ${idx + 1}`, 'info');
  },

  regenerateVariation(idx) {
    app.showToast('Regenerate', `Regenerating design ${idx + 1}`, 'info');
  },

  toolSelect() { document.querySelectorAll('.editor-tool').forEach(t => t.classList.remove('active')); event.target.closest('.editor-tool').classList.add('active'); },
  toolText() { this.toolSelect(); app.showToast('Tool', 'Text tool selected', 'info'); },
  toolImage() { this.toolSelect(); app.showToast('Tool', 'Image tool selected', 'info'); },
  toolShape() { this.toolSelect(); app.showToast('Tool', 'Shape tool selected', 'info'); },
  toolLogo() { this.toolSelect(); app.showToast('Tool', 'Logo tool selected', 'info'); },
  alignLeft() { app.showToast('Align', 'Left aligned', 'info'); },
  alignCenter() { app.showToast('Align', 'Center aligned', 'info'); },
  alignRight() { app.showToast('Align', 'Right aligned', 'info'); },
  undo() { app.showToast('Undo', 'Last action undone', 'info'); },
  redo() { app.showToast('Redo', 'Action redone', 'info'); },
  duplicateLayer() { app.showToast('Duplicate', 'Layer duplicated', 'info'); },
  deleteLayer() { app.showToast('Delete', 'Layer deleted', 'info'); }
};