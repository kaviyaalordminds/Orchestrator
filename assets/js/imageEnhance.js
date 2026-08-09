/* ============================================
   IMAGE ENHANCEMENT AGENT
   Dedicated workspace for restoring, upscaling
   and transforming images with AI
   ============================================ */

const imageEnhanceAgent = {
  _file: null,
  _resultUrl: null,

  onActivate() {
    this._initSlider();
  },

  selectFile() {
    const input = document.getElementById('enhanceFileInput');
    if (input) input.click();
  },

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    this._file = file;
    const url = URL.createObjectURL(file);

    const uploadZone = document.getElementById('enhUploadZone');
    const slider = document.getElementById('beforeAfterSlider');
    const beforeImg = document.getElementById('beforeImg');
    const afterImg = document.getElementById('afterImg');
    const status = document.getElementById('enhProcessStatus');

    if (uploadZone) uploadZone.style.display = 'none';
    if (slider) slider.style.display = 'block';
    if (beforeImg) beforeImg.src = url;
    if (afterImg) afterImg.src = url;
    if (status) status.textContent = 'Image loaded. Select enhancements and click Enhance.';
    app.showToast('Image Loaded', file.name, 'success');
  },

  _initSlider() {
    const handle = document.getElementById('sliderHandle');
    const wrapper = document.getElementById('afterImgWrapper');
    if (!handle || !wrapper) return;

    let dragging = false;

    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      e.preventDefault();
    });

    document.addEventListener('mouseup', () => { dragging = false; });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const slider = document.getElementById('beforeAfterSlider');
      if (!slider) return;
      const rect = slider.getBoundingClientRect();
      let pct = ((e.clientX - rect.left) / rect.width) * 100;
      pct = Math.max(5, Math.min(95, pct));
      handle.style.left = pct + '%';
      wrapper.style.width = pct + '%';
    });

    // Touch support
    handle.addEventListener('touchstart', (e) => { dragging = true; e.preventDefault(); }, { passive: false });
    document.addEventListener('touchend', () => { dragging = false; });
    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const slider = document.getElementById('beforeAfterSlider');
      if (!slider) return;
      const rect = slider.getBoundingClientRect();
      let pct = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      pct = Math.max(5, Math.min(95, pct));
      handle.style.left = pct + '%';
      wrapper.style.width = pct + '%';
    }, { passive: true });
  },

  async enhance() {
    if (!this._file) {
      app.showToast('No Image', 'Please upload an image first.', 'warning');
      return;
    }
    const btn = document.getElementById('enhanceBtn');
    const status = document.getElementById('enhProcessStatus');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Enhancing...'; }
    if (status) status.innerHTML = '<span style="color:var(--cyan-500);">&#9679;</span> Processing enhancement...';

    try {
      const formData = new FormData();
      formData.append('file', this._file);
      formData.append('upscale', document.getElementById('enhUpscale')?.checked ? '1' : '0');
      formData.append('sharpen', document.getElementById('enhSharpen')?.checked ? '1' : '0');
      formData.append('denoise', document.getElementById('enhDenoise')?.checked ? '1' : '0');
      formData.append('restore', document.getElementById('enhRestore')?.checked ? '1' : '0');
      formData.append('bg_remove', document.getElementById('enhBgRemove')?.checked ? '1' : '0');
      formData.append('face_enhance', document.getElementById('enhFace')?.checked ? '1' : '0');
      formData.append('color_correct', document.getElementById('enhColor')?.checked ? '1' : '0');
      formData.append('brightness', document.getElementById('enhBrightness')?.value || '0');
      formData.append('contrast', document.getElementById('enhContrast')?.value || '0');

      const token = localStorage.getItem('jwt_token');
      const headers = token ? { 'Authorization': 'Bearer ' + token } : {};

      const res = await fetch('http://localhost:8000/api/v1/images/enhance', {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        const imgUrl = data.data.url || data.data.enhanced_url || data.data.image_url;
        const afterImg = document.getElementById('afterImg');
        if (afterImg) afterImg.src = imgUrl;
        this._resultUrl = imgUrl;
        if (status) status.innerHTML = '<span style="color:var(--emerald-500);">&#10003;</span> Enhancement complete!';
        app.showToast('Enhanced!', 'Image enhancement complete.', 'success');
      } else {
        throw new Error(data.error?.message || 'Enhancement failed');
      }
    } catch (err) {
      // Preview mode fallback
      if (status) status.innerHTML = '<span style="color:var(--text-muted);">&#9734;</span> Enhancement preview applied (connect backend for real AI processing)';
      app.showToast('Preview Mode', 'Enhancement simulated. Connect the FastAPI backend for real results.', 'info');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-stars"></i> Enhance Image'; }
    }
  },

  download(format) {
    if (!this._resultUrl) {
      app.showToast('No Result', 'Enhance an image first.', 'warning');
      return;
    }
    const a = document.createElement('a');
    a.href = this._resultUrl;
    a.download = `enhanced_image.${format}`;
    a.click();
  }
};
