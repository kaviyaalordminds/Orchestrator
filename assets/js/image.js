
/* ============================================
   IMAGE AGENT — AI Image Generation & Enhancement
   ============================================ */

const imageAgent = {
  currentTab: 'generate',
  selectedStyle: 'realistic',
  currentRatio: '1:1',
  selectedModel: 'sdxl',
  generatedImages: [],
  uploadedImage: null,

  init() {
    document.querySelectorAll('#styleChips .style-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#styleChips .style-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedStyle = chip.dataset.style;
      });
    });
    document.querySelectorAll('#panel-generate .aspect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#panel-generate .aspect-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentRatio = btn.dataset.ratio;
      });
    });
  },

  onActivate() {
    document.getElementById('imgPrompt').focus();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.image-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.image-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + tab).classList.add('active');
  },

  async generate() {
    const prompt = document.getElementById('imgPrompt').value.trim();
    if (!prompt) {
      app.showToast('Empty Prompt', 'Please describe the image you want', 'warning');
      return;
    }

    const btn = document.getElementById('generateBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Generating...';
    btn.disabled = true;

    const count = parseInt(document.getElementById('imgCount').value) || 4;
    const model = document.getElementById('imgModel').value;
    app.showToast('Image Generation', `Creating ${count} images with ${model.toUpperCase()}...`, 'info');

    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #3b82f6, #06b6d4)',
      'linear-gradient(135deg, #10b981, #34d399)',
      'linear-gradient(135deg, #f59e0b, #ef4444)',
      'linear-gradient(135deg, #ec4899, #f43f5e)',
      'linear-gradient(135deg, #8b5cf6, #a855f7)'
    ];

    for (let i = 0; i < count; i++) {
      await new Promise(r => setTimeout(r, 800));
      const seed = Date.now() + i * 137;
      const color = colors[i % colors.length];
      const imgUrl = `https://picsum.photos/seed/${seed}/400/400`;

      this.generatedImages.push({ id: seed, url: imgUrl, prompt, style: this.selectedStyle, ratio: this.currentRatio });

      grid.innerHTML += `
        <div class="gallery-item" onclick="imageAgent.viewImage(${seed})">
          <img src="${imgUrl}" alt="Generated ${i + 1}" loading="lazy">
          <div class="gallery-overlay">
            <div class="gallery-overlay-actions">
              <button class="gallery-action-btn" onclick="event.stopPropagation(); imageAgent.downloadImage(${seed})"><i class="bi bi-download"></i></button>
              <button class="gallery-action-btn" onclick="event.stopPropagation(); imageAgent.enhanceImage(${seed})"><i class="bi bi-stars"></i></button>
              <button class="gallery-action-btn" onclick="event.stopPropagation(); imageAgent.upsample(${seed})"><i class="bi bi-arrows-fullscreen"></i></button>
              <button class="gallery-action-btn" onclick="event.stopPropagation(); imageAgent.removeBg(${seed})"><i class="bi bi-eraser"></i></button>
            </div>
          </div>
        </div>
      `;
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
    app.showToast('Images Ready', `${count} images generated`, 'success');
  },

  viewImage(id) {
    const img = this.generatedImages.find(i => i.id === id);
    if (img) app.showImageModal(img.url);
  },

  downloadImage(id) {
    app.showToast('Download', 'Image download started', 'success');
  },

  enhanceImage(id) {
    app.showToast('Enhance', 'AI enhancing image quality...', 'info');
    setTimeout(() => app.showToast('Complete', 'Image enhanced', 'success'), 1500);
  },

  upsample(id) {
    app.showToast('Upsample', 'Upscaling to 4x resolution...', 'info');
    setTimeout(() => app.showToast('Complete', 'Image upscaled to 4x', 'success'), 1500);
  },

  removeBg(id) {
    app.showToast('Remove BG', 'Removing background...', 'info');
    setTimeout(() => app.showToast('Complete', 'Background removed', 'success'), 1500);
  },

  selectFile() {
    document.getElementById('enhanceFileInput').click();
  },

  handleFileSelect(e) {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.uploadedImage = ev.target.result;
        document.getElementById('enhancePreview').innerHTML = `
          <div class="before-after-slider" id="beforeAfterSlider">
            <img src="${ev.target.result}" class="img-before" alt="Original">
            <div class="img-after" style="width:50%;"><img src="${ev.target.result}" alt="Enhanced" style="filter:contrast(1.1) saturate(1.2) brightness(1.05);"></div>
            <div class="slider-handle" id="sliderHandle"></div>
          </div>
        `;
        this.initSlider();
        document.getElementById('enhancementOptions').style.display = 'grid';
        document.getElementById('enhanceBtn').style.display = 'flex';
        app.showToast('Image Loaded', file.name, 'success');
      };
      reader.readAsDataURL(file);
    }
  },

  initSlider() {
    const slider = document.getElementById('beforeAfterSlider');
    const handle = document.getElementById('sliderHandle');
    const after = slider.querySelector('.img-after');
    if (!slider || !handle) return;

    let isDragging = false;
    const move = (e) => {
      if (!isDragging) return;
      const rect = slider.getBoundingClientRect();
      const x = (e.clientX || e.touches[0].clientX) - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      handle.style.left = pct + '%';
      after.style.width = pct + '%';
    };
    handle.addEventListener('mousedown', () => isDragging = true);
    handle.addEventListener('touchstart', () => isDragging = true);
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move);
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('touchend', () => isDragging = false);
  },

  async enhance() {
    const btn = document.getElementById('enhanceBtn');
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Enhancing...';
    btn.disabled = true;
    app.showToast('Enhancement', 'Applying AI enhancements...', 'info');
    await new Promise(r => setTimeout(r, 2500));
    btn.innerHTML = '<i class="bi bi-stars"></i> Enhance Image';
    btn.disabled = false;
    app.showToast('Complete', 'Image enhanced successfully', 'success');
  }
};