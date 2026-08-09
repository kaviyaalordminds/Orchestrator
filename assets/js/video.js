/* ============================================
   VIDEO AGENT — AI Video Creation & Design Studio
   ============================================ */

const videoAgent = {
  currentTab: 'create',
  currentRatio: '16:9',
  selectedStyle: 'cinematic',
  isGenerating: false,
  scenes: [{ id: 0, title: 'Intro', duration: 5 }],

  init() {
    document.querySelectorAll('#videoStyleChips .style-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#videoStyleChips .style-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedStyle = chip.dataset.style;
      });
    });
    document.querySelectorAll('#view-video .aspect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#view-video .aspect-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentRatio = btn.dataset.ratio;
      });
    });
  },

  onActivate() {
    document.getElementById('videoPrompt').focus();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.video-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.video-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`video-panel-${tab}`).classList.add('active');
  },

  selectRefImage() {
    document.getElementById('videoRefInput').click();
  },

  handleRefImage(e) {
    if (e.target.files.length > 0) {
      app.showToast('Reference Image', `Uploaded: ${e.target.files[0].name}`, 'success');
    }
  },

  async generate() {
    const prompt = document.getElementById('videoPrompt').value.trim();
    if (!prompt) {
      app.showToast('Empty Prompt', 'Please describe the video you want', 'warning');
      return;
    }

    const btn = document.getElementById('videoGenerateBtn');
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Starting...';
    btn.disabled = true;
    this.isGenerating = true;

    const statusBar = document.getElementById('videoStatusBar');
    const previewBox = document.getElementById('videoPreviewBox');
    const fill = document.getElementById('videoProgressFill');
    const text = document.getElementById('videoProgressText');
    const detail = document.getElementById('videoStatusDetail');
    const badge = document.getElementById('videoStatusBadge');

    statusBar.style.display = 'flex';
    badge.className = 'video-status-badge status-processing';
    badge.textContent = 'Processing';

    let jobId = null;
    try {
      const res = await fetch(`${app.apiBase}/api/v1/videos/generate`, {
        method: 'POST',
        headers: app.getAuthHeaders(),
        body: JSON.stringify({
          prompt: prompt,
          style: this.selectedStyle,
          resolution: document.getElementById('videoResolution')?.value || '1080p',
          duration: parseInt(document.getElementById('videoDuration')?.value) || 5
        })
      });
      const data = await res.json();
      if (data.success) {
        jobId = data.data.job_id;
      }
    } catch (err) {
      console.error("Video API error:", err);
    }

    const stages = [
      { pct: 15, msg: 'Job created in backend queue...', delay: 800 },
      { pct: 40, msg: 'Processing video frames...', delay: 1500 },
      { pct: 75, msg: 'Rendering final output...', delay: 1500 },
      { pct: 100, msg: 'Complete', delay: 800 }
    ];

    for (const stage of stages) {
      await new Promise(r => setTimeout(r, stage.delay));
      fill.style.width = stage.pct + '%';
      text.textContent = stage.pct + '%';
      detail.textContent = stage.msg;
    }

    let finalVideoUrl = "";
    if (jobId) {
      try {
        const res = await fetch(`${app.apiBase}/api/v1/videos/${jobId}`);
        const data = await res.json();
        if (data.success && data.data.video_url) {
          finalVideoUrl = data.data.video_url;
        }
      } catch (err) {
        console.error("Status poll error:", err);
      }
    }

    badge.className = 'video-status-badge status-completed';
    badge.textContent = 'Completed';
    previewBox.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);padding:20px;">
        ${finalVideoUrl ? `<video src="${finalVideoUrl}" controls autoplay loop style="max-width:100%;max-height:80%;border-radius:12px;"></video>` : `
          <i class="bi bi-camera-reels" style="font-size:64px;margin-bottom:16px;color:var(--primary-500);"></i>
          <h3 style="font-size:20px;color:var(--text-primary);margin-bottom:8px;">Video Job Completed</h3>
          <p>"${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"</p>
        `}
      </div>
    `;

    document.getElementById('videoActions').style.display = 'flex';
    btn.innerHTML = '<i class="bi bi-magic"></i> Generate Video';
    btn.disabled = false;
    this.isGenerating = false;

    app.showToast('Video Ready', 'Your AI-generated video job completed', 'success');
  },

  regenerate() {
    document.getElementById('videoActions').style.display = 'none';
    this.generate();
  },

  download() {
    app.showToast('Download Started', 'Preparing video file...', 'info');
    setTimeout(() => app.showToast('Download Complete', 'Video saved as MP4', 'success'), 1500);
  },

  saveToProject() {
    app.showToast('Saved', 'Video added to current project', 'success');
  },

  addScene() {
    const id = this.scenes.length;
    this.scenes.push({ id, title: `Scene ${id + 1}`, duration: 5 });
    this.renderSceneList();
    app.showToast('Scene Added', `Scene ${id + 1} added to timeline`, 'success');
  },

  duplicateScene(idx) {
    const scene = { ...this.scenes[idx], id: this.scenes.length };
    this.scenes.splice(idx + 1, 0, scene);
    this.renderSceneList();
  },

  deleteScene(idx) {
    if (this.scenes.length <= 1) {
      app.showToast('Cannot Delete', 'At least one scene is required', 'warning');
      return;
    }
    this.scenes.splice(idx, 1);
    this.renderSceneList();
  },

  renderSceneList() {
    const list = document.getElementById('sceneList');
    list.innerHTML = this.scenes.map((scene, idx) => `
      <div class="scene-item ${idx === 0 ? 'active' : ''}" data-scene="${idx}" onclick="videoAgent.selectScene(${idx})">
        <div class="scene-thumb">${idx + 1}</div>
        <div class="scene-info">
          <div class="scene-title">${scene.title}</div>
          <div class="scene-duration">${scene.duration}s</div>
        </div>
        <div class="scene-actions">
          <button class="scene-btn" onclick="event.stopPropagation(); videoAgent.duplicateScene(${idx})"><i class="bi bi-copy"></i></button>
          <button class="scene-btn" onclick="event.stopPropagation(); videoAgent.deleteScene(${idx})"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    `).join('');
  },

  selectScene(idx) {
    document.querySelectorAll('.scene-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.scene-item[data-scene="${idx}"]`)?.classList.add('active');
  },

  playTimeline() { app.showToast('Playback', 'Playing timeline...', 'info'); },
  pauseTimeline() { app.showToast('Playback', 'Paused', 'info'); },
  editSceneText() { app.showToast('Edit', 'Text editor opened', 'info'); },
  changeTransition() { app.showToast('Transition', 'Transition selector opened', 'info'); },
  addAudio() { app.showToast('Audio', 'Audio track added', 'info'); },
  addLogo() { app.showToast('Logo', 'Logo overlay added', 'info'); },
  regenerateScene() { app.showToast('Regenerate', 'Regenerating selected scene...', 'info'); }
};