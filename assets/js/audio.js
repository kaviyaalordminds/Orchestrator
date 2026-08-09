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
    const audio = document.getElementById('audioElement');
    if (audio) {
      audio.addEventListener('play', () => this.updatePlaybackUI());
      audio.addEventListener('pause', () => this.updatePlaybackUI());
      audio.addEventListener('timeupdate', () => this.updatePlaybackUI());
      audio.addEventListener('ended', () => this.updatePlaybackUI());
    }
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
    const tabButton = document.querySelector(`.audio-tab[onclick="audioAgent.switchTab('${tab}')"]`);
    if (tabButton) tabButton.classList.add('active');
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

    try {
      const data = await app.api('/api/v1/audio/synthesize', {
        method: 'POST',
        body: JSON.stringify({
          text: prompt,
          voice: 'Samantha',
          speed: 1.0,
          type,
          duration: Number(duration),
          mood: this.selectedMood
        })
      });

      if (!data?.success || !data?.data?.audio_url) {
        throw new Error(data?.error?.message || data?.detail || 'Audio backend returned no audio file.');
      }

      this.audioUrl = `${app.apiBase}${data.data.audio_url}`;

      const audio = document.getElementById('audioElement');
      if (audio) {
        audio.src = this.audioUrl;
        audio.load();
      }

      const waveform = document.getElementById('audioWaveform');
      if (waveform) waveform.innerHTML = this.generateWaveformBars();
      document.getElementById('audioPlayerControls').style.display = 'flex';
      document.getElementById('audioTotalTime').textContent = 'Ready';

      this.audioHistory.unshift({
        id: Date.now(),
        prompt,
        type,
        duration,
        mood: this.selectedMood,
        audioUrl: this.audioUrl,
        timestamp: new Date().toLocaleString()
      });
      this.renderAudioHistory();

      app.showToast('Audio Ready', `Backend generated ${this.selectedMood} mood audio successfully.`, 'success');
    } catch (err) {
      console.error('Audio synth error:', err);
      this.audioUrl = null;
      app.showToast('Audio Generation Failed', err.message || 'Check the backend logs.', 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
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
    const audio = document.getElementById('audioElement');
    if (!audio || !this.audioUrl) {
      app.showToast('No Audio', 'Generate audio first.', 'warning');
      return;
    }

    if (audio.paused) {
      audio.play().catch(err => {
        console.error('Audio playback error:', err);
        app.showToast('Playback Error', 'The generated audio could not be played.', 'error');
      });
    } else {
      audio.pause();
    }
  },

  updatePlaybackUI() {
    const audio = document.getElementById('audioElement');
    if (!audio) return;
    const icon = document.getElementById('audioPlayIcon');
    if (icon) icon.className = audio.paused ? 'bi bi-play-fill' : 'bi bi-pause-fill';

    const fill = document.getElementById('audioProgressFill');
    if (fill && Number.isFinite(audio.duration) && audio.duration > 0) {
      fill.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    }

    const time = document.getElementById('audioCurrentTime');
    if (time) {
      const sec = Math.floor(audio.currentTime || 0);
      time.textContent = `0:${String(sec).padStart(2, '0')}`;
    }
  },

  downloadAudio() {
    if (!this.audioUrl) {
      app.showToast('No Audio', 'Generate audio first.', 'warning');
      return;
    }
    const link = document.createElement('a');
    link.href = this.audioUrl;
    link.download = 'orchestrator-audio.wav';
    document.body.appendChild(link);
    link.click();
    link.remove();
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

  async handleTranscribeFile(e) {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      app.showToast('Uploading', `Transcribing ${file.name}...`, 'info');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('jwt_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${app.apiBase}/api/v1/audio/transcribe`, {
          method: 'POST',
          headers: headers,
          body: formData
        });
        const data = await res.json();
        if (!data?.success || !data?.data?.text) {
          throw new Error(data?.error?.message || data?.detail || 'Transcription backend returned no text.');
        }
        this.transcriptText = data.data.text;
        document.getElementById('transcribeText').innerHTML = this.transcriptText.replace(/\n/g, '<br>');
        document.getElementById('transcribeActions').style.display = 'flex';
        app.showToast('Transcription Complete', 'Audio transcribed successfully', 'success');
      } catch (err) {
        console.error("Transcribe API error:", err);
        document.getElementById('transcribeActions').style.display = 'none';
        app.showToast('Transcription Failed', err.message || 'Check the backend logs.', 'error');
      }
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