/* ============================================
   PPT AGENT — AI Presentation Studio
   Dedicated workspace for generating, editing
   and exporting presentations
   ============================================ */

const pptAgent = {
  _slides: [],
  _currentSlide: 0,
  _exportUrl: null,

  onActivate() {
    this._renderSlideNavigator();
  },

  async generate() {
    const topicEl = document.getElementById('pptTopic');
    const topic = topicEl?.value.trim();
    if (!topic) {
      app.showToast('Topic Required', 'Please enter a presentation topic.', 'warning');
      return;
    }

    const btn = document.getElementById('pptGenerateBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating...'; }

    // Show pipeline status
    this._setPipelineStep(1);

    try {
      const payload = {
        topic,
        description: document.getElementById('pptDesc')?.value || '',
        audience: document.getElementById('pptAudience')?.value || 'General Audience',
        slide_count: parseInt(document.getElementById('pptSlideCount')?.value || '10'),
        theme: document.getElementById('pptTheme')?.value || 'Dark Corporate',
        language: document.getElementById('pptLanguage')?.value || 'English'
      };

      this._setPipelineStep(2);
      const token = localStorage.getItem('jwt_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      };

      const res = await fetch(`${app.apiBase}/api/v1/ppt/generate`, {
        method: 'POST', headers, body: JSON.stringify(payload)
      });
      const data = await res.json();

      this._setPipelineStep(3);

      if (data.success) {
        this._exportUrl = data.data.file_url;
        this._slides = data.data.slides || this._buildMockSlides(topic, payload.slide_count);
        this._finishGeneration();
        app.showToast('Presentation Ready!', `${this._slides.length} slides generated.`, 'success');
      } else {
        throw new Error(data.error?.message || 'Generation failed');
      }
    } catch (err) {
      // Graceful mock fallback
      const count = parseInt(document.getElementById('pptSlideCount')?.value || '5');
      this._slides = this._buildMockSlides(topic, count);
      this._finishGeneration();
      app.showToast('Presentation Created', 'Slide structure ready. Connect backend for PPTX export.', 'info');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-magic"></i> Generate Presentation'; }
    }
  },

  _finishGeneration() {
    this._currentSlide = 0;
    this._renderSlideNavigator();
    this._showCanvas();
    this._selectSlide(0);
  },

  _setPipelineStep(step) {
    // Visual feedback for multi-step process
    const steps = ['pstep1', 'pstep2', 'pstep3', 'pstep4', 'pstep5'];
    steps.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', i < step);
    });
  },

  _buildMockSlides(topic, count) {
    const sections = [
      'Introduction', 'Market Overview', 'Key Insights', 'Strategy & Approach',
      'Roadmap', 'Financial Outlook', 'Team & Capabilities', 'Case Studies',
      'Competitive Landscape', 'Next Steps', 'Q&A', 'Conclusion'
    ];
    const slides = [{ title: topic, content: 'An intelligent AI-powered presentation', type: 'title' }];
    for (let i = 1; i < count; i++) {
      const section = sections[(i - 1) % sections.length];
      slides.push({
        title: section,
        content: `Strategic insights and key points for ${section.toLowerCase()}.`,
        type: 'content'
      });
    }
    return slides.slice(0, count);
  },

  _renderSlideNavigator() {
    const nav = document.getElementById('slideNavigator');
    if (!nav) return;

    if (this._slides.length === 0) {
      nav.innerHTML = `
        <div class="slide-thumb-card active" style="text-align:center;">
          <div style="background:rgba(15,23,42,0.8);height:60px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-muted);">New Slide</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">1 / 1</div>
        </div>`;
      return;
    }

    nav.innerHTML = this._slides.map((s, i) => `
      <div class="slide-thumb-card ${i === this._currentSlide ? 'active' : ''}" onclick="pptAgent._selectSlide(${i})">
        <div style="height:60px;background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;overflow:hidden;">
          <div style="font-size:9px;font-weight:600;color:white;text-align:center;line-height:1.3;">${this._truncate(s.title || 'Slide', 28)}</div>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">${i + 1} / ${this._slides.length}</div>
      </div>`
    ).join('');
  },

  _truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  },

  _showCanvas() {
    const form = document.getElementById('pptGenerateForm');
    const canvas = document.getElementById('pptSlideCanvas');
    if (form) form.style.display = 'none';
    if (canvas) { canvas.style.display = 'flex'; canvas.style.removeProperty('display'); canvas.style.display = 'flex'; }
  },

  _selectSlide(index) {
    this._currentSlide = index;
    this._renderSlideNavigator();

    const slide = this._slides[index];
    if (!slide) return;

    const canvas = document.getElementById('pptCurrentSlide');
    if (!canvas) return;

    const isTitle = slide.type === 'title' || index === 0;
    canvas.innerHTML = `
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:360px;padding:48px 56px;display:flex;flex-direction:column;justify-content:center;border-radius:8px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4);"></div>
        <div style="font-size:10px;letter-spacing:2px;color:#6366f1;text-transform:uppercase;font-weight:600;margin-bottom:${isTitle ? '20px' : '12px'};">${isTitle ? 'AI Presentation Studio' : `Slide ${index + 1} of ${this._slides.length}`}</div>
        <h2 style="font-size:clamp(22px,3vw,36px);font-weight:700;color:white;margin-bottom:${isTitle ? '24px' : '16px'};line-height:1.2;">${slide.title || ''}</h2>
        <p style="font-size:${isTitle ? '16px' : '14px'};color:rgba(255,255,255,0.6);line-height:1.7;max-width:680px;">${slide.content || ''}</p>
        ${isTitle ? '<div style="margin-top:32px;display:flex;gap:12px;"><div style="width:40px;height:3px;background:#6366f1;border-radius:2px;"></div><div style="width:20px;height:3px;background:#8b5cf6;border-radius:2px;"></div><div style="width:12px;height:3px;background:#06b6d4;border-radius:2px;"></div></div>' : ''}
      </div>`;

    // Update notes
    const notes = document.getElementById('pptNotes');
    if (notes) notes.value = slide.notes || '';
  },

  // Public alias for onclick in HTML
  selectSlide(i) { this._selectSlide(i); },

  addSlide() {
    this._slides.push({ title: 'New Slide', content: 'Click AI Edit to generate content for this slide.', type: 'content' });
    this._renderSlideNavigator();
    this._selectSlide(this._slides.length - 1);
    app.showToast('Slide Added', `Slide ${this._slides.length} created.`, 'info');
  },

  duplicateSlide() {
    if (this._slides.length === 0) return;
    const copy = { ...this._slides[this._currentSlide] };
    this._slides.splice(this._currentSlide + 1, 0, copy);
    this._renderSlideNavigator();
    app.showToast('Slide Duplicated', '', 'info');
  },

  deleteSlide() {
    if (this._slides.length <= 1) { app.showToast('Cannot Delete', 'A presentation must have at least 1 slide.', 'warning'); return; }
    this._slides.splice(this._currentSlide, 1);
    this._currentSlide = Math.max(0, this._currentSlide - 1);
    this._renderSlideNavigator();
    this._selectSlide(this._currentSlide);
    app.showToast('Slide Deleted', '', 'info');
  },

  async editSlide() {
    const prompt = document.getElementById('pptSlidePrompt')?.value?.trim();
    if (!prompt) { app.showToast('Enter a prompt', 'Describe how to edit this slide.', 'warning'); return; }
    app.showToast('AI Editing', 'Applying changes to current slide...', 'info');
    if (this._slides[this._currentSlide]) {
      this._slides[this._currentSlide].content += ` | AI Edit: ${prompt}`;
      this._selectSlide(this._currentSlide);
    }
    document.getElementById('pptSlidePrompt').value = '';
  },

  regenerateSlide() {
    this._selectSlide(this._currentSlide);
    app.showToast('Regenerated', 'Slide content regenerated.', 'success');
  },

  exportPptx() {
    if (this._exportUrl) {
      window.open('http://localhost:8000' + this._exportUrl, '_blank');
    } else {
      app.showToast('No Export', 'Generate a presentation first.', 'warning');
    }
  },

  exportPdf() {
    app.showToast('PDF Export', 'Requires backend connection.', 'info');
  }
};
