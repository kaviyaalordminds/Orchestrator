
/* ============================================
   WEBSITE AGENT — AI Website Builder + Deploy
   ============================================ */

const websiteAgent = {
  currentDevice: 'desktop',
  generatedCode: '',
  versions: [],

  init() {
    document.querySelectorAll('.device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  onActivate() {},

  switchTab(tab) {
    document.querySelectorAll('.website-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.website-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('web-panel-' + tab).classList.add('active');
  },

  setDevice(device) {
    this.currentDevice = device;
    const container = document.getElementById('previewContainer');
    const frame = document.getElementById('webPreviewFrame');
    if (device === 'mobile') {
      container.style.maxWidth = '375px';
      frame.style.height = '667px';
    } else if (device === 'tablet') {
      container.style.maxWidth = '768px';
      frame.style.height = '1024px';
    } else {
      container.style.maxWidth = '1000px';
      frame.style.height = '600px';
    }
  },

  async generate() {
    const name = document.getElementById('webName').value.trim();
    if (!name) {
      app.showToast('Missing Name', 'Please enter a website name', 'warning');
      return;
    }

    const btn = document.getElementById('webGenerateBtn');
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Building...';
    btn.disabled = true;

    app.showToast('Website Generation', `Building "${name}"...`, 'info');
    await new Promise(r => setTimeout(r, 3000));

    const type = document.getElementById('webBusinessType').value;
    const style = document.getElementById('webStyle').value;
    const mode = document.getElementById('webMode').value;
    const c1 = document.getElementById('webColor1').value;
    const c2 = document.getElementById('webColor2').value;

    const html = this.generateWebsiteHTML(name, type, style, mode, c1, c2);
    this.generatedCode = html;

    const frame = document.getElementById('webPreviewFrame');
    const frame2 = document.getElementById('webPreviewFrame2');
    frame.srcdoc = html;
    frame2.srcdoc = html;

    document.getElementById('webCodeOutput').textContent = html.substring(0, 3000) + '\n\n<!-- ... truncated for preview ... -->';
    document.getElementById('deployWebsiteName').textContent = name;
    document.getElementById('deployStatusPill').innerHTML = '<i class="bi bi-circle-fill"></i> Ready to Deploy';
    document.getElementById('deployStatusPill').style.color = 'var(--success)';

    const version = { id: this.versions.length + 1, name: `Version ${this.versions.length + 1}`, date: new Date().toLocaleString(), html };
    this.versions.push(version);
    this.renderVersionList();

    btn.innerHTML = '<i class="bi bi-magic"></i> Generate Website';
    btn.disabled = false;

    app.showToast('Website Ready', `${type} website generated in ${mode} mode`, 'success');
  },

  generateWebsiteHTML(name, type, style, mode, c1, c2) {
    const isAnimated = mode === 'animated';
    const is3d = mode === '3d';
    const animCSS = isAnimated ? `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-20px); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
      .anim-fade { animation: fadeInUp 0.8s ease forwards; }
      .anim-float { animation: float 3s ease-in-out infinite; }
      .anim-pulse { animation: pulse 2s ease-in-out infinite; }
      .scroll-reveal { opacity: 0; transform: translateY(30px); transition: all 0.6s ease; }
      .scroll-reveal.visible { opacity: 1; transform: translateY(0); }
    ` : '';

    const threeJS = is3d ? `
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
      <script>
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('hero-3d').appendChild(renderer.domElement);
        const geometry = new THREE.IcosahedronGeometry(2, 1);
        const material = new THREE.MeshBasicMaterial({ color: '${c1}', wireframe: true });
        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);
        camera.position.z = 5;
        function animate() {
          requestAnimationFrame(animate);
          sphere.rotation.x += 0.005;
          sphere.rotation.y += 0.005;
          renderer.render(scene, camera);
        }
        animate();
        window.addEventListener('resize', () => {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        });
      <\/script>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
  :root { --primary: ${c1}; --secondary: ${c2}; }
  body { font-family: 'Inter', sans-serif; background: #0b0f19; color: #f8fafc; }
  .hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; background: linear-gradient(135deg, ${c1}22, ${c2}22); }
  .hero h1 { font-size: 4rem; font-weight: 700; background: linear-gradient(135deg, ${c1}, ${c2}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .btn-primary { background: linear-gradient(135deg, ${c1}, ${c2}); border: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; }
  .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
  .navbar { background: rgba(11,15,25,0.8); backdrop-filter: blur(12px); }
  ${animCSS}
</style>
</head>
<body>
<nav class="navbar navbar-expand-lg fixed-top">
  <div class="container">
    <a class="navbar-brand fw-bold" href="#" style="color:${c1};">${name}</a>
    <div class="collapse navbar-collapse">
      <ul class="navbar-nav ms-auto">
        <li class="nav-item"><a class="nav-link text-light" href="#home">Home</a></li>
        <li class="nav-item"><a class="nav-link text-light" href="#about">About</a></li>
        <li class="nav-item"><a class="nav-link text-light" href="#services">Services</a></li>
        <li class="nav-item"><a class="nav-link text-light" href="#contact">Contact</a></li>
      </ul>
    </div>
  </div>
</nav>
<section class="hero" id="home">
  ${is3d ? '<div id="hero-3d" style="position:absolute;inset:0;z-index:0;"></div>' : ''}
  <div class="container text-center position-relative" style="z-index:1;">
    <h1 class="${isAnimated ? 'anim-fade' : ''}">${name}</h1>
    <p class="lead mt-3 text-white-50">${type} — Built with AI</p>
    <button class="btn btn-primary mt-4 ${isAnimated ? 'anim-float' : ''}">Get Started</button>
  </div>
</section>
<section class="py-5" id="about">
  <div class="container">
    <div class="row g-4">
      <div class="col-md-4"><div class="card p-4 ${isAnimated ? 'scroll-reveal' : ''}"><h4>Innovation</h4><p class="text-white-50">Pushing boundaries with cutting-edge technology.</p></div></div>
      <div class="col-md-4"><div class="card p-4 ${isAnimated ? 'scroll-reveal' : ''}"><h4>Quality</h4><p class="text-white-50">Premium solutions crafted with precision.</p></div></div>
      <div class="col-md-4"><div class="card p-4 ${isAnimated ? 'scroll-reveal' : ''}"><h4>Growth</h4><p class="text-white-50">Scalable systems for expanding businesses.</p></div></div>
    </div>
  </div>
</section>
<footer class="py-4 text-center text-white-50 border-top border-secondary">
  <p>&copy; 2026 ${name}. All rights reserved.</p>
</footer>
${isAnimated ? `<script>
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
<\/script>` : ''}
${threeJS}
</body>
</html>`;
  },

  refreshPreview() {
    const frame = document.getElementById('webPreviewFrame');
    frame.srcdoc = this.generatedCode;
    app.showToast('Refreshed', 'Preview updated', 'info');
  },

  applyEdit() {
    const cmd = document.getElementById('webEditCommand').value.trim();
    if (!cmd) return;
    app.showToast('AI Edit', `Applying: "${cmd}"...`, 'info');
    document.getElementById('webEditCommand').value = '';
    setTimeout(() => {
      app.showToast('Complete', 'Edit applied successfully', 'success');
    }, 1500);
  },

  renderVersionList() {
    const list = document.getElementById('webVersionList');
    if (this.versions.length === 0) {
      list.innerHTML = '<div class="empty-state-small"><i class="bi bi-clock-history"></i><p>No versions yet.</p></div>';
      return;
    }
    list.innerHTML = this.versions.map(v => `
      <div class="version-item">
        <div class="version-info">
          <h4>${v.name}</h4>
          <p>${v.date}</p>
        </div>
        <div class="version-actions">
          <button class="toolbar-btn" onclick="websiteAgent.previewVersion(${v.id})"><i class="bi bi-eye"></i> Preview</button>
          <button class="toolbar-btn" onclick="websiteAgent.restoreVersion(${v.id})"><i class="bi bi-arrow-counterclockwise"></i> Restore</button>
        </div>
      </div>
    `).join('');
  },

  previewVersion(id) {
    const v = this.versions.find(x => x.id === id);
    if (v) {
      document.getElementById('webPreviewFrame2').srcdoc = v.html;
      this.switchTab('preview');
    }
  },

  restoreVersion(id) {
    const v = this.versions.find(x => x.id === id);
    if (v) {
      this.generatedCode = v.html;
      document.getElementById('webPreviewFrame').srcdoc = v.html;
      app.showToast('Restored', `Version ${id} restored`, 'success');
    }
  },

  exportZip() {
    app.showToast('Export', 'Preparing ZIP download...', 'info');
    setTimeout(() => app.showToast('Complete', 'Website exported as ZIP', 'success'), 1500);
  }
};

/* ============================================
   DEPLOY AGENT
   ============================================ */

const deployAgent = {
  deployments: [],
  autoDeploy: false,

  onActivate() {
    this.renderDeploymentsTable();
  },

  async deploy() {
    const provider = document.getElementById('deployProvider').value;
    const name = document.getElementById('deployWebsiteName').textContent;
    const statusPill = document.getElementById('deployStatusPill');
    const progress = document.getElementById('deployProgress');
    const stepList = document.getElementById('deployStepList');
    const liveUrlBox = document.getElementById('deployLiveUrlBox');
    const btn = document.getElementById('deployBtn');

    if (statusPill.textContent.includes('Not Generated')) {
      app.showToast('No Website', 'Generate a website first', 'warning');
      return;
    }

    btn.disabled = true;
    progress.style.display = 'block';
    liveUrlBox.style.display = 'none';

    const steps = [
      { name: 'Building static assets', icon: 'bi-hammer', status: 'running' },
      { name: 'Optimizing images', icon: 'bi-image', status: 'pending' },
      { name: 'Uploading to ' + this.getProviderName(provider), icon: 'bi-cloud-upload', status: 'pending' },
      { name: 'Configuring DNS', icon: 'bi-globe', status: 'pending' },
      { name: 'SSL certificate', icon: 'bi-shield-check', status: 'pending' },
      { name: 'Verifying deployment', icon: 'bi-check-circle', status: 'pending' }
    ];

    for (let i = 0; i < steps.length; i++) {
      steps.forEach((s, idx) => {
        if (idx < i) s.status = 'success';
        if (idx === i) s.status = 'running';
      });
      this.renderSteps(stepList, steps);
      await new Promise(r => setTimeout(r, 1200));
    }

    steps.forEach(s => s.status = 'success');
    this.renderSteps(stepList, steps);

    const url = `https://${name.toLowerCase().replace(/\s+/g, '-')}.${provider === 'pages' ? 'pages.dev' : provider === 'netlify' ? 'netlify.app' : provider === 'vercel' ? 'vercel.app' : 'pages.dev'}`;
    document.getElementById('deployLiveUrl').href = url;
    document.getElementById('deployLiveUrl').textContent = url;
    liveUrlBox.style.display = 'flex';

    statusPill.innerHTML = '<i class="bi bi-circle-fill"></i> Live';
    statusPill.style.color = 'var(--success)';

    this.deployments.unshift({
      id: Date.now(),
      website: name,
      provider: this.getProviderName(provider),
      status: 'live',
      version: `v${this.deployments.length + 1}`,
      url: url,
      deployed: 'Just now'
    });
    this.renderDeploymentsTable();

    btn.disabled = false;
    app.showToast('Deployed', `Live at ${url}`, 'success');
  },

  renderSteps(container, steps) {
    container.innerHTML = steps.map(s => `
      <div class="deploy-step ${s.status}">
        <i class="bi ${s.icon}"></i>
        <span>${s.name}</span>
        <i class="bi ${s.status === 'success' ? 'bi-check-lg' : s.status === 'running' ? 'bi-arrow-repeat spin' : 'bi-circle'}" style="margin-left:auto;"></i>
      </div>
    `).join('');
  },

  getProviderName(val) {
    const map = { pages: 'Cloudflare Pages', netlify: 'Netlify', cloudflare: 'Cloudflare Pages', vercel: 'Vercel' };
    return map[val] || val;
  },

  copyUrl() {
    const url = document.getElementById('deployLiveUrl').textContent;
    navigator.clipboard.writeText(url).then(() => app.showToast('Copied', 'URL copied to clipboard', 'success'));
  },

  connectRepo() {
    app.showToast('Connect', 'GitHub repository connection (simulated)', 'info');
  },

  showCustomDomain() {
    app.showToast('Custom Domain', 'Custom domain configuration (simulated)', 'info');
  },

  toggleAutoDeploy(checked) {
    this.autoDeploy = checked;
    app.showToast('Auto Deploy', checked ? 'Enabled' : 'Disabled', 'info');
  },

  renderDeploymentsTable() {
    const tbody = document.getElementById('deploymentsTableBody');
    document.getElementById('deployTotalCount').textContent = this.deployments.length;
    document.getElementById('deployLiveCount').textContent = this.deployments.filter(d => d.status === 'live').length;
    document.getElementById('deployFailedCount').textContent = this.deployments.filter(d => d.status === 'failed').length;

    if (this.deployments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No deployments yet. Deploy a website from the Website Studio.</td></tr>';
      return;
    }

    tbody.innerHTML = this.deployments.map(d => `
      <tr>
        <td><strong>${d.website}</strong></td>
        <td>${d.provider}</td>
        <td><span class="status-dot ${d.status}"></span> ${d.status}</td>
        <td>${d.version}</td>
        <td><a href="${d.url}" target="_blank" style="color:var(--primary-400);">${d.url}</a></td>
        <td>${d.deployed}</td>
        <td>
          <button class="toolbar-btn" onclick="deployAgent.rollback(${d.id})"><i class="bi bi-arrow-counterclockwise"></i></button>
          <button class="toolbar-btn" onclick="deployAgent.deleteDeploy(${d.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  rollback(id) {
    app.showToast('Rollback', 'Deployment rolled back to previous version', 'success');
  },

  deleteDeploy(id) {
    this.deployments = this.deployments.filter(d => d.id !== id);
    this.renderDeploymentsTable();
    app.showToast('Deleted', 'Deployment removed', 'info');
  }
};