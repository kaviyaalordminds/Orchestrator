/* ============================================
   AUDIO AGENT — Generation, Voice Clone, Transcribe
   ============================================ */

const audioAgent = {
  currentTab: 'generate',
  selectedMood: 'epic',
  audioHistory: [],
  isPlaying: false,
  transcriptText: '',

  init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    document.querySelectorAll('#audioMoodChips .style-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#audioMoodChips .style-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedMood = chip.dataset.mood;
      });
    });
  },

  onActivate() {},

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.audio-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.audio-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`audio-panel-${tab}`).classList.add('active');
  },

  async generate() {
    const prompt = document.getElementById('audioPrompt').value.trim();
    if (!prompt) {
      app.showToast('Empty Prompt', 'Please describe the audio you want', 'warning');
      return;
    }

    const btn = document.getElementById('audioGenerateBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Generating...';
    btn.disabled = true;

    const duration = document.getElementById('audioDuration').value;
    const type = document.getElementById('audioType').value;

    app.showToast('Audio Generation', `Creating ${duration}s of ${type.toLowerCase()}...`, 'info');
    await new Promise(r => setTimeout(r, 2500));

    const waveform = document.getElementById('audioWaveform');
    waveform.innerHTML = this.generateWaveformBars();
    document.getElementById('audioPlayerControls').style.display = 'flex';
    document.getElementById('audioTotalTime').textContent = `0:${duration.padStart(2, '0')}`;

    this.audioHistory.unshift({
      id: Date.now(),
      prompt: prompt,
      type: type,
      duration: duration,
      mood: this.selectedMood,
      timestamp: new Date().toLocaleString()
    });
    this.renderAudioHistory();

    btn.innerHTML = originalText;
    btn.disabled = false;
    app.showToast('Audio Ready', `${duration}s ${type} generated`, 'success');
  },

  generateWaveformBars() {
    let html = '<div style="display:flex;align-items:center;gap:3px;height:100%;padding:0 20px;">';
    for (let i = 0; i < 60; i++) {
      const h = Math.floor(Math.random() * 80) + 20;
      html += `<div style="flex:1;height:${h}%;background:linear-gradient(to top,var(--primary-500),var(--accent-500));border-radius:2px;opacity:0.7;"></div>`;
    }
    html += '</div>';
    return html;
  },

  renderAudioHistory() {
    const list = document.getElementById('audioHistoryList');
    list.innerHTML = this.audioHistory.map(item => `
      <div class="audio-history-item" onclick="audioAgent.loadAudio(${item.id})">
        <i class="bi bi-music-note-beamed"></i>
        <div class="audio-history-info">
          <div class="audio-history-title">${item.prompt.substring(0, 40)}${item.prompt.length > 40 ? '...' : ''}</div>
          <div class="audio-history-meta">${item.type} · ${item.duration}s · ${item.mood}</div>
        </div>
      </div>
    `).join('');
  },

  loadAudio(id) {
    const item = this.audioHistory.find(a => a.id === id);
    if (item) {
      document.getElementById('audioPrompt').value = item.prompt;
      app.showToast('Loaded', `Audio: ${item.prompt.substring(0, 30)}...`, 'info');
    }
  },

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    const icon = document.getElementById('audioPlayIcon');
    icon.className = this.isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    if (this.isPlaying) {
      this.simulatePlayback();
    }
  },

  simulatePlayback() {
    let progress = 0;
    const fill = document.getElementById('audioProgressFill');
    const time = document.getElementById('audioCurrentTime');
    const interval = setInterval(() => {
      if (!this.isPlaying) { clearInterval(interval); return; }
      progress += 1;
      fill.style.width = progress + '%';
      const secs = Math.floor((progress / 100) * 30);
      time.textContent = `0:${secs.toString().padStart(2, '0')}`;
      if (progress >= 100) {
        this.isPlaying = false;
        document.getElementById('audioPlayIcon').className = 'bi bi-play-fill';
        clearInterval(interval);
      }
    }, 300);
  },

  downloadAudio() {
    app.showToast('Download', 'Audio download started', 'success');
  },

  selectVoiceSample() {
    document.getElementById('voiceSampleInput').click();
  },

  handleVoiceSample(e) {
    if (e.target.files.length > 0) {
      app.showToast('Voice Sample', `Uploaded: ${e.target.files[0].name}`, 'success');
    }
  },

  async cloneVoice() {
    const text = document.getElementById('voiceCloneText').value.trim();
    if (!text) {
      app.showToast('Empty Text', 'Please enter text for the voice to speak', 'warning');
      return;
    }
    app.showToast('Cloning', 'Processing voice clone...', 'info');
    await new Promise(r => setTimeout(r, 3000));
    app.showToast('Complete', 'Voice clone generated', 'success');
  },

  selectTranscribeFile() {
    document.getElementById('transcribeInput').click();
  },

  handleTranscribeFile(e) {
    if (e.target.files.length > 0) {
      app.showToast('Uploading', `Processing ${e.target.files[0].name}...`, 'info');
      setTimeout(() => {
        this.transcriptText = `This is a simulated transcription of the uploaded audio file.\\n\\n[00:00:01] Welcome to the meeting.\\n[00:00:05] Today we will discuss the quarterly results.\\n[00:00:12] Revenue has increased by 24% compared to last quarter.\\n[00:00:18] Our primary growth drivers were the enterprise segment and international markets.\\n[00:00:25] We also launched three new product lines that exceeded expectations.`;
        document.getElementById('transcribeText').innerHTML = this.transcriptText.replace(/\\n/g, '<br>');
        document.getElementById('transcribeActions').style.display = 'flex';
        app.showToast('Transcription Complete', 'Audio transcribed successfully', 'success');
      }, 2000);
    }
  },

  exportTranscript(format) {
    app.showToast('Export', `Transcript exported as .${format}`, 'success');
  },

  aiSummarizeTranscript() {
    app.showToast('AI Summarize', 'Generating summary...', 'info');
    setTimeout(() => {
      const summary = '<h4 style="font-size:16px;font-weight:600;margin-bottom:12px;">Summary</h4><p>Quarterly revenue increased by 24%. Growth driven by enterprise segment and international markets. Three new product lines exceeded expectations.</p><h4 style="font-size:14px;font-weight:600;margin:16px 0 8px;">Key Points</h4><ul><li>Revenue up 24% QoQ</li><li>Enterprise segment strong</li><li>International growth</li><li>3 new product launches successful</li></ul>';
      document.getElementById('transcribeText').innerHTML = summary;
      app.showToast('Complete', 'Summary added', 'success');
    }, 1500);
  }
};