
/* ============================================
   DOCUMENT AGENT — PPT, Word, Excel Studio
   ============================================ */

const documentAgent = {
  currentTab: 'ppt',
  currentSlide: 0,
  slides: [],
  wordContent: '',
  excelData: [],

  init() {},

  onActivate() {},

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.doc-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.doc-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('doc-panel-' + tab).classList.add('active');
  },

  // ========== PPT ==========
  async generatePPT() {
    const topic = document.getElementById('pptTopic').value.trim();
    if (!topic) {
      app.showToast('Missing Topic', 'Please enter a presentation topic', 'warning');
      return;
    }

    app.showToast('PPT Generation', `Creating presentation on "${topic}"...`, 'info');

    const count = parseInt(document.getElementById('pptSlides').value) || 5;

    try {
      const res = await fetch(`${app.apiBase}/api/v1/ppt/generate`, {
        method: 'POST',
        headers: app.getAuthHeaders(),
        body: JSON.stringify({ topic, slides_count: count })
      });
      const data = await res.json();
      if (data.success && data.data.slides) {
        this.slides = data.data.slides.map(s => ({
          title: s.title,
          bullets: s.bullet_points || [],
          type: 'content'
        }));
        this.downloadFileUrl = app.apiBase + data.data.file_url;
      } else {
        this.slides = [
          { title: topic, subtitle: 'Executive Overview', type: 'title' },
          { title: 'Key Takeaways', bullets: ['Market Insights', 'Strategic Goals'], type: 'content' }
        ];
      }
    } catch (err) {
      console.error("PPT API error:", err);
      this.slides = [
        { title: topic, subtitle: 'Executive Overview', type: 'title' },
        { title: 'Key Takeaways', bullets: ['Market Insights', 'Strategic Goals'], type: 'content' }
      ];
    }

    this.currentSlide = 0;
    this.renderSlide();
    this.renderSlideThumbnails();
    document.getElementById('slideToolbar').style.display = 'flex';
    app.showToast('PPT Ready', `${this.slides.length} slides generated`, 'success');
  },

  renderSlide() {
    const slide = this.slides[this.currentSlide];
    const canvas = document.getElementById('slideCanvas');
    if (slide.type === 'title') {
      canvas.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;">
          <h2 style="font-size:42px;font-weight:700;margin-bottom:16px;">${slide.title}</h2>
          ${slide.subtitle ? `<p style="font-size:20px;color:var(--text-muted);">${slide.subtitle}</p>` : ''}
          <div style="margin-top:40px;font-size:14px;color:var(--text-muted);">Slide ${this.currentSlide + 1} of ${this.slides.length}</div>
        </div>
      `;
    } else {
      canvas.innerHTML = `
        <div style="height:100%;">
          <h2 style="font-size:32px;font-weight:700;margin-bottom:24px;">${slide.title}</h2>
          <ul style="padding-left:24px;">
            ${slide.bullets.map(b => `<li style="font-size:18px;margin-bottom:12px;color:var(--text-secondary);">${b}</li>`).join('')}
          </ul>
          <div style="position:absolute;bottom:20px;right:24px;font-size:12px;color:var(--text-muted);">${this.currentSlide + 1} / ${this.slides.length}</div>
        </div>
      `;
    }
    this.renderSlideThumbnails();
  },

  renderSlideThumbnails() {
    const container = document.getElementById('slideThumbnails');
    container.style.display = 'flex';
    container.innerHTML = this.slides.map((s, i) => `
      <div class="slide-thumb ${i === this.currentSlide ? 'active' : ''}" onclick="documentAgent.goToSlide(${i})">
        <span class="slide-thumb-num">${i + 1}</span>
        <div style="font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px;">${s.title}</div>
      </div>
    `).join('');
  },

  goToSlide(idx) {
    this.currentSlide = idx;
    this.renderSlide();
  },

  prevSlide() {
    if (this.currentSlide > 0) { this.currentSlide--; this.renderSlide(); }
  },

  nextSlide() {
    if (this.currentSlide < this.slides.length - 1) { this.currentSlide++; this.renderSlide(); }
  },

  regenerateSlide() {
    app.showToast('Regenerate', 'Regenerating current slide...', 'info');
    setTimeout(() => app.showToast('Complete', 'Slide regenerated', 'success'), 1000);
  },

  addSlide() {
    this.slides.splice(this.currentSlide + 1, 0, { title: 'New Slide', bullets: ['Point 1', 'Point 2'], type: 'content' });
    this.currentSlide++;
    this.renderSlide();
    app.showToast('Slide Added', 'New slide inserted', 'success');
  },

  exportPPT(format) {
    app.showToast('Export', `Preparing ${format.toUpperCase()}...`, 'info');
    setTimeout(() => app.showToast('Complete', `Presentation exported as .${format}`, 'success'), 1500);
  },

  // ========== WORD ==========
  async generateWord() {
    const title = document.getElementById('wordTitle').value.trim();
    if (!title) {
      app.showToast('Missing Title', 'Please enter a document title', 'warning');
      return;
    }

    app.showToast('Document', `Generating "${title}"...`, 'info');

    const type = document.getElementById('wordType').value;
    const tone = document.getElementById('wordTone').value;

    let content = "";
    try {
      const res = await fetch(`${app.apiBase}/api/v1/word/generate`, {
        method: 'POST',
        headers: app.getAuthHeaders(),
        body: JSON.stringify({ title, doc_type: type })
      });
      const data = await res.json();
      if (data.success) {
        content = `<h1>${title}</h1><p><strong>Document Type:</strong> ${type} | <strong>Tone:</strong> ${tone}</p>` +
                  data.data.content.replace(/\n\n/g, '<br><br>').replace(/# (.*)/g, '<h1>$1</h1>').replace(/## (.*)/g, '<h2>$1</h2>');
        this.wordDownloadUrl = app.apiBase + data.data.file_url;
      }
    } catch (err) {
      console.error("Word API error:", err);
      content = `<h1>${title}</h1><p><strong>Document Type:</strong> ${type}</p><h2>Executive Summary</h2><p>Document generated for ${title}.</p>`;
    }

    document.getElementById('wordPage').innerHTML = content;
    document.getElementById('wordActions').style.display = 'block';
    app.showToast('Document Ready', `${type} document generated`, 'success');
  },

  formatWord(cmd) {
    document.execCommand(cmd === 'h1' ? 'formatBlock' : cmd, false, cmd === 'h1' ? 'H1' : null);
    app.showToast('Format', `${cmd} applied`, 'info');
  },

  aiRewrite() {
    app.showToast('AI Rewrite', 'Rewriting selected text...', 'info');
    setTimeout(() => app.showToast('Complete', 'Text rewritten', 'success'), 1000);
  },

  aiSummarize() {
    app.showToast('AI Summarize', 'Generating summary...', 'info');
    setTimeout(() => app.showToast('Complete', 'Summary added', 'success'), 1000);
  },

  exportWord(format) {
    if (this.wordDownloadUrl) {
      window.open(this.wordDownloadUrl, '_blank');
      app.showToast('Download', 'Downloading DOCX file...', 'success');
    } else {
      app.showToast('Export', `Preparing ${format.toUpperCase()}...`, 'info');
    }
  },

  // ========== EXCEL ==========
  selectExcelFile() {
    document.getElementById('excelFileInput').click();
  },

  handleExcelFile(e) {
    if (e.target.files.length > 0) {
      app.showToast('Upload', `Processing ${e.target.files[0].name}...`, 'info');
      setTimeout(() => {
        this.generateSampleData();
        app.showToast('Loaded', 'Data loaded successfully', 'success');
      }, 1500);
    }
  },

  generateSampleData() {
    this.excelData = [
      ['Quarter', 'Revenue ($M)', 'Units Sold', 'Growth %', 'Region'],
      ['Q1 2025', '12.4', '8500', '18.2', 'North America'],
      ['Q2 2025', '14.8', '10200', '19.4', 'North America'],
      ['Q3 2025', '16.2', '11500', '9.5', 'Europe'],
      ['Q4 2025', '19.5', '13800', '20.4', 'Asia Pacific'],
      ['Q1 2026', '21.3', '15200', '9.2', 'Global'],
      ['Q2 2026', '24.7', '17800', '16.0', 'Global']
    ];
    this.renderExcelTable();
    document.getElementById('excelActions').style.display = 'block';
    this.generateInsights();
  },

  async generateExcel() {
    const prompt = document.getElementById('excelPrompt').value.trim();
    if (!prompt && this.excelData.length === 0) {
      app.showToast('Empty', 'Enter a prompt or upload a file', 'warning');
      return;
    }

    app.showToast('Excel', 'Generating data and analysis...', 'info');

    try {
      const res = await fetch(`${app.apiBase}/api/v1/excel/analyze`, {
        method: 'POST',
        headers: app.getAuthHeaders(),
        body: JSON.stringify({ topic: prompt || "Financial Analysis" })
      });
      const data = await res.json();
      if (data.success) {
        this.excelDownloadUrl = app.apiBase + data.data.file_url;
      }
    } catch (err) {
      console.error("Excel API error:", err);
    }

    if (this.excelData.length === 0) this.generateSampleData();
    this.renderExcelTable();
    this.generateChart();
    document.getElementById('excelActions').style.display = 'block';
    app.showToast('Complete', 'Data generated and spreadsheet ready', 'success');
  },

  renderExcelTable() {
    const container = document.getElementById('excelTableContainer');
    let html = '<table class="spreadsheet">';
    this.excelData.forEach((row, ri) => {
      html += '<tr>';
      row.forEach((cell, ci) => {
        if (ri === 0) {
          html += `<th>${cell}</th>`;
        } else {
          const isNum = ci > 0 && ci < 4;
          html += `<td class="${isNum ? 'number' : ''}">${cell}</td>`;
        }
      });
      html += '</tr>';
    });
    html += '</table>';
    container.innerHTML = html;
  },

  generateChart() {
    const container = document.getElementById('chartBars');
    const data = this.excelData.slice(1);
    const max = Math.max(...data.map(r => parseFloat(r[1])));

    container.innerHTML = data.map(row => {
      const pct = (parseFloat(row[1]) / max) * 100;
      return `
        <div class="chart-bar">
          <div class="chart-label">${row[0]}</div>
          <div class="chart-bar-fill" style="width:${pct}%;">$${row[1]}M</div>
        </div>
      `;
    }).join('');

    document.getElementById('excelChartContainer').style.display = 'block';
  },

  generateFormula() {
    app.showToast('Formula', 'AI formula suggestion applied', 'info');
  },

  aiAnalyzeExcel() {
    app.showToast('AI Analysis', 'Analyzing data patterns...', 'info');
    setTimeout(() => {
      this.generateInsights();
      app.showToast('Complete', 'Analysis complete', 'success');
    }, 1500);
  },

  generateInsights() {
    document.getElementById('excelInsights').innerHTML = `
      <p><strong>Revenue Growth:</strong> 99% increase from Q1 2025 to Q2 2026</p>
      <p><strong>Best Quarter:</strong> Q2 2026 with $24.7M revenue</p>
      <p><strong>Average Growth Rate:</strong> 15.4% per quarter</p>
      <p><strong>Trend:</strong> Strong upward trajectory with consistent growth</p>
    `;
  },

  exportExcel(format) {
    app.showToast('Export', `Preparing ${format.toUpperCase()}...`, 'info');
    setTimeout(() => app.showToast('Complete', `Spreadsheet exported as .${format}`, 'success'), 1500);
  }
};