
/* ============================================
   3D WEBSITE AGENT — Three.js / WebGL Studio
   ============================================ */

const website3dAgent = {
  currentTab: 'build',
  generatedCode: '',

  onActivate() {},

  switchTab(tab) {
    document.querySelectorAll('#view-website3d .website-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('#view-website3d .website-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('3d-panel-' + tab).classList.add('active');
  },

  async generate() {
    const name = document.getElementById('threeName').value.trim();
    if (!name) {
      app.showToast('Missing Name', 'Please enter a website name', 'warning');
      return;
    }

    const btn = document.getElementById('threeGenerateBtn');
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Building 3D...';
    btn.disabled = true;

    app.showToast('3D Website', `Building immersive "${name}"...`, 'info');
    await new Promise(r => setTimeout(r, 3500));

    const c1 = document.getElementById('threeColor1').value;
    const c2 = document.getElementById('threeColor2').value;
    const c3 = document.getElementById('threeColor3').value;
    const hasHero = document.getElementById('threeHero').checked;
    const hasParticles = document.getElementById('threeParticles').checked;
    const hasGlobe = document.getElementById('threeGlobe').checked;
    const hasMouse = document.getElementById('threeMouse').checked;
    const hasScroll = document.getElementById('threeScroll').checked;

    const html = this.generate3DHTML(name, c1, c2, c3, hasHero, hasParticles, hasGlobe, hasMouse, hasScroll);
    this.generatedCode = html;

    const container = document.getElementById('threePreviewContainer');
    container.innerHTML = '<iframe id="threePreviewFrame" class="preview-iframe" title="3D preview" style="width:100%;height:100%;border:none;"></iframe>';
    container.querySelector('iframe').srcdoc = html;

    document.getElementById('threePreviewFrame').srcdoc = html;

    btn.innerHTML = '<i class="bi bi-magic"></i> Generate 3D Website';
    btn.disabled = false;

    app.showToast('3D Website Ready', 'Immersive experience generated', 'success');
  },

  generate3DHTML(name, c1, c2, c3, hasHero, hasParticles, hasGlobe, hasMouse, hasScroll) {
    const particleScript = hasParticles ? `
      // Particle system
      const pGeo = new THREE.BufferGeometry();
      const pCount = 2000;
      const pPos = new Float32Array(pCount * 3);
      for(let i=0;i<pCount*3;i++) pPos[i] = (Math.random()-0.5)*20;
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const pMat = new THREE.PointsMaterial({ color: '${c2}', size: 0.03, transparent: true, opacity: 0.6 });
      const particles = new THREE.Points(pGeo, pMat);
      scene.add(particles);
    ` : '';

    const globeScript = hasGlobe ? `
      // Rotating globe
      const gGeo = new THREE.IcosahedronGeometry(1.5, 2);
      const gMat = new THREE.MeshBasicMaterial({ color: '${c3}', wireframe: true, transparent: true, opacity: 0.5 });
      const globe = new THREE.Mesh(gGeo, gMat);
      globe.position.set(3, 0, -2);
      scene.add(globe);
    ` : '';

    const mouseScript = hasMouse ? `
      // Mouse interaction
      let mouseX = 0, mouseY = 0;
      document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      });
    ` : '';

    const scrollScript = hasScroll ? `
      // Scroll reveal
      const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          }
        });
      }, { threshold: 0.1 });
      document.querySelectorAll('.scroll-reveal').forEach(el => scrollObserver.observe(el));
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} — 3D Experience</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: #0b0f19; color: #f8fafc; overflow-x: hidden; }
  #canvas-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
  .content { position: relative; z-index: 1; }
  .hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; }
  .hero h1 { font-size: 5rem; font-weight: 700; background: linear-gradient(135deg, ${c1}, ${c2}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .hero p { font-size: 1.25rem; color: rgba(255,255,255,0.6); margin-top: 1rem; }
  .section { padding: 120px 40px; max-width: 1200px; margin: 0 auto; }
  .section h2 { font-size: 3rem; margin-bottom: 2rem; }
  .section p { font-size: 1.1rem; line-height: 1.8; color: rgba(255,255,255,0.7); }
  .scroll-reveal { opacity: 0; transform: translateY(50px); transition: all 0.8s ease; }
  .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-top: 3rem; }
  .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 2rem; }
  .card h3 { color: ${c1}; margin-bottom: 1rem; }
</style>
</head>
<body>
<div id="canvas-container"></div>
<div class="content">
  <section class="hero">
    <div>
      <h1>${name}</h1>
      <p>Immersive 3D Web Experience</p>
    </div>
  </section>
  <section class="section scroll-reveal">
    <h2>About</h2>
    <p>This website features real-time 3D rendering powered by Three.js. The interactive elements respond to your mouse and scroll actions, creating an immersive browsing experience.</p>
    <div class="card-grid">
      <div class="card scroll-reveal"><h3>Interactive</h3><p>Real-time 3D elements that respond to user input.</p></div>
      <div class="card scroll-reveal"><h3>Immersive</h3><p>Particle systems and animated geometries create depth.</p></div>
      <div class="card scroll-reveal"><h3>Performant</h3><p>Optimized WebGL rendering for smooth 60fps experience.</p></div>
    </div>
  </section>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  const geometry = new THREE.IcosahedronGeometry(2, 1);
  const material = new THREE.MeshBasicMaterial({ color: '${c1}', wireframe: true, transparent: true, opacity: 0.8 });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  ${particleScript}
  ${globeScript}
  ${mouseScript}

  camera.position.z = 6;

  function animate() {
    requestAnimationFrame(animate);
    sphere.rotation.x += 0.003;
    sphere.rotation.y += 0.005;
    ${hasGlobe ? 'globe.rotation.y -= 0.002;' : ''}
    ${hasMouse ? 'camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.05; camera.position.y += (mouseY * 0.5 - camera.position.y) * 0.05; camera.lookAt(scene.position);' : ''}
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
<\/script>
${scrollScript ? '<script>' + scrollScript + '<\/script>' : ''}
</body>
</html>`;
  }
};