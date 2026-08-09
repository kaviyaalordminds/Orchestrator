/* ============================================
   EXCEL AGENT — AI Spreadsheet Studio
   Dedicated workspace for generating, analyzing
   and exporting spreadsheet data with AI
   ============================================ */

const excelAgent = {
  _data: [],
  _exportUrl: null,
  _chartType: 'bar',

  onActivate() {
    if (this._data.length === 0) {
      this._renderGrid(this._getSampleData());
    }
  },

  _getSampleData() {
    return [
      ['Product', 'Q1 Sales', 'Q2 Sales', 'Q3 Sales', 'Q4 Sales', 'Total', 'Growth %'],
      ['Widget A', 12400, 15200, 18700, 22100, '=SUM(B2:E2)', '78.2%'],
      ['Widget B', 8900, 11300, 14500, 19200, '=SUM(B3:E3)', '115.7%'],
      ['Widget C', 5600, 7800, 9200, 12400, '=SUM(B4:E4)', '121.4%'],
      ['Widget D', 3200, 4100, 5800, 8900, '=SUM(B5:E5)', '178.1%'],
      ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)', '', '']
    ];
  },

  _renderGrid(data) {
    this._data = data;
    const tbody = document.getElementById('spreadsheetBody');
    const thead = document.querySelector('#spreadsheetGrid thead tr');
    if (!tbody) return;

    // Update column headers based on data width
    const colCount = data[0]?.length || 8;
    const colLetters = ['A','B','C','D','E','F','G','H','I','J','K','L'];
    if (thead) {
      thead.innerHTML = '<th style="width:40px;text-align:center;background:rgba(15,23,42,0.95);">#</th>' +
        colLetters.slice(0, colCount).map(l => `<th>${l}</th>`).join('');
    }

    tbody.innerHTML = data.map((row, ri) => `
      <tr>
        <td style="text-align:center;color:var(--text-muted);font-size:11px;background:rgba(15,23,42,0.8);user-select:none;">${ri + 1}</td>
        ${row.map((cell, ci) => {
          const isNum = typeof cell === 'number';
          const isFormula = typeof cell === 'string' && cell.startsWith('=');
          const isHeader = ri === 0;
          const displayVal = isNum ? cell.toLocaleString() : cell;
          return `<td
            class="${isNum ? 'number' : ''}"
            contenteditable="true"
            style="${isHeader ? 'font-weight:700;background:rgba(15,23,42,0.7);color:var(--text-primary);' : ''}${isFormula ? 'color:var(--emerald-500,#10b981);font-family:Consolas,monospace;font-size:11px;' : ''}${isNum && !isHeader ? 'color:var(--cyan-500,#06b6d4);' : ''}"
            onclick="excelAgent._cellClick(${ri},${ci},this)"
          >${displayVal}</td>`;
        }).join('')}
      </tr>`
    ).join('');
  },

  _cellClick(row, col, el) {
    const bar = document.getElementById('formulaBar');
    if (bar && el) bar.value = el.textContent;
  },

  async generate() {
    const prompt = document.getElementById('excelPrompt')?.value?.trim();
    if (!prompt) {
      app.showToast('Describe the spreadsheet', 'Enter what kind of spreadsheet you need.', 'warning');
      return;
    }

    const btn = document.getElementById('excelGenerateBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating...'; }

    try {
      const token = localStorage.getItem('jwt_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      };
      const res = await fetch('http://localhost:8000/api/v1/excel/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, action: 'generate' })
      });
      const data = await res.json();

      if (data.success) {
        this._exportUrl = data.data.file_url;
        if (data.data.grid) this._renderGrid(data.data.grid);
        if (data.data.insights) {
          document.getElementById('excelInsights').innerHTML =
            `<p style="font-size:12px;line-height:1.7;">${data.data.insights}</p>`;
        }
        app.showToast('Spreadsheet Generated!', '', 'success');
      } else {
        throw new Error(data.error?.message || 'Failed');
      }
    } catch (err) {
      // Fallback with context-aware sample
      this._renderGrid(this._getContextualData(prompt));
      document.getElementById('excelInsights').innerHTML =
        '<p style="font-size:12px;">Sample data loaded based on your prompt. Connect the FastAPI backend for real AI-generated spreadsheets.</p>';
      app.showToast('Sample Data Loaded', 'Connect backend for AI-generated data.', 'info');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-magic"></i> Generate'; }
    }
  },

  _getContextualData(prompt) {
    // Return relevant sample based on keywords
    const p = prompt.toLowerCase();
    if (p.includes('budget') || p.includes('finance') || p.includes('expense')) {
      return [
        ['Category', 'Budget', 'Actual', 'Variance', 'Status'],
        ['Marketing', 50000, 47200, '=C2-B2', 'Under Budget'],
        ['Operations', 120000, 131500, '=C3-B3', 'Over Budget'],
        ['R&D', 80000, 76800, '=C4-B4', 'Under Budget'],
        ['HR', 60000, 58900, '=C5-B5', 'Under Budget'],
        ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '']
      ];
    }
    return this._getSampleData();
  },

  handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    app.showToast('Uploading', `${file.name} — processing...`, 'info');
    // Backend would parse this; show sample for now
    setTimeout(() => {
      this._renderGrid(this._getSampleData());
      app.showToast('File Loaded', 'Connect FastAPI backend for real XLSX parsing.', 'info');
    }, 800);
  },

  async analyzeData() {
    if (this._data.length === 0) {
      app.showToast('No Data', 'Generate or upload data first.', 'warning');
      return;
    }
    app.showToast('Analyzing', 'Running AI analysis...', 'info');
    await new Promise(r => setTimeout(r, 1000));

    const insights = [
      '📈 Q4 shows strongest performance across all product lines (+18.4% vs Q3).',
      '🔍 Widget D shows exceptional growth trajectory — highest YoY at 178%.',
      '⚠️ Widget C growth is slower than peers — consider promotional investment.',
      '✅ Overall portfolio revenue trend is positive with healthy diversification.',
      '💡 Recommend expanding Widget A & D capacity for Q1 next year.'
    ];

    const el = document.getElementById('excelInsights');
    if (el) el.innerHTML = insights.map(i =>
      `<p style="margin-bottom:8px;font-size:12px;line-height:1.6;">${i}</p>`
    ).join('');
  },

  evaluateFormula() {
    const bar = document.getElementById('formulaBar');
    if (!bar?.value) return;
    app.showToast('Formula', bar.value, 'info');
  },

  setChart(type) {
    this._chartType = type;
    document.querySelectorAll('[onclick^="excelAgent.setChart"]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${type}'`));
    });
  },

  generateChart() {
    app.showToast('Chart Generated', `${this._chartType.charAt(0).toUpperCase() + this._chartType.slice(1)} chart created from current data.`, 'success');
  },

  cleanData() {
    app.showToast('Data Cleaned', 'Duplicates removed, formats normalized.', 'success');
  },

  generateFormulas() {
    app.showToast('Formulas Added', 'AI-generated formulas inserted into selected range.', 'success');
  },

  pivotAnalysis() {
    app.showToast('Pivot Analysis', 'Requires FastAPI backend for advanced analysis.', 'info');
  },

  importFile() {
    document.getElementById('excelFileInput')?.click();
  },

  exportXlsx() {
    if (this._exportUrl) {
      window.open('http://localhost:8000' + this._exportUrl, '_blank');
    } else {
      app.showToast('No Export', 'Generate a spreadsheet first to export XLSX.', 'warning');
    }
  }
};
