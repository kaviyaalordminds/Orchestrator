
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
    await new Promise(r => setTimeout(r, 2500));

    const count = parseInt(document.getElementById('pptSlides').value) || 8;
    const audience = document.getElementById('pptAudience').value;
    const style = document.getElementById('pptStyle').value;

    this.slides = [
      { title: topic, subtitle: `A ${audience} Presentation`, type: 'title' },
      { title: 'Introduction', bullets: ['Overview of the topic', 'Key objectives', 'Target audience'], type: 'content' },
      { title: 'Market Analysis', bullets: ['Current landscape', 'Growth trends', 'Competitive positioning'], type: 'content' },
      { title: 'Key Findings', bullets: ['Data-driven insights', 'Performance metrics', 'Opportunity areas'], type: 'content' },
      { title: 'Strategic Recommendations', bullets: ['Short-term actions', 'Long-term vision', 'Resource allocation'], type: 'content' },
      { title: 'Implementation Plan', bullets: ['Phase 1: Foundation', 'Phase 2: Growth', 'Phase 3: Scale'], type: 'content' },
      { title: 'Expected Outcomes', bullets: ['ROI projections', 'KPI targets', 'Success criteria'], type: 'content' },
      { title: 'Thank You', subtitle: 'Questions & Discussion', type: 'title' }
    ];

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
    await new Promise(r => setTimeout(r, 2000));

    const type = document.getElementById('wordType').value;
    const tone = document.getElementById('wordTone').value;

    const content = `
      <h1>${title}</h1>
      <p><strong>Document Type:</strong> ${type} | <strong>Tone:</strong> ${tone}</p>
      <h2>Executive Summary</h2>
      <p>This document provides a comprehensive overview of ${title.toLowerCase()}. It covers key aspects including background analysis, strategic recommendations, and actionable next steps.</p>
      <h2>Introduction</h2>
      <p>The purpose of this ${type.toLowerCase()} is to outline the current state of affairs and propose a structured approach moving forward. The analysis is based on the latest available data and industry best practices.</p>
      <h2>Key Findings</h2>
      <p>Our research has identified several critical areas that require attention. These findings are supported by quantitative data and qualitative assessments from subject matter experts.</p>
      <ul>
        <li>Market positioning remains strong with 24% year-over-year growth</li>
        <li>Customer satisfaction scores have improved by 15 points</li>
        <li>Operational efficiency gains of 18% were achieved</li>
        <li>New product lines contributed 32% of total revenue</li>
      </ul>
      <h2>Recommendations</h2>
      <p>Based on the findings, we recommend the following strategic initiatives:</p>
      <ol>
        <li>Invest in digital transformation infrastructure</li>
        <li>Expand into emerging markets with localized offerings</li>
        <li>Strengthen partnerships with key technology vendors</li>
        <li>Implement agile methodologies across all teams</li>
      </ol>
      <h2>Conclusion</h2>
      <p>The path forward requires commitment to innovation and operational excellence. With the right strategy and execution, significant growth opportunities can be realized.</p>
    `;

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
    setTimeout(() => app.showToast('Complete', 'Text rewritten', 'success'), 1500);
  },

  aiSummarize() {
    app.showToast('AI Summarize', 'Generating summary...', 'info');
    setTimeout(() => app.showToast('Complete', 'Summary added', 'success'), 1500);
  },

  exportWord(format) {
    app.showToast('Export', `Preparing ${format.toUpperCase()}...`, 'info');
    setTimeout(() => app.showToast('Complete', `Document exported as .${format}`, 'success'), 1500);
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
    await new Promise(r => setTimeout(r, 2000));

    if (this.excelData.length === 0) this.generateSampleData();
    this.renderExcelTable();
    this.generateChart();
    document.getElementById('excelActions').style.display = 'block';
    app.showToast('Complete', 'Data generated and analyzed', 'success');
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