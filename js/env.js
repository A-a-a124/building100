/* Building 100 - environment: day/night from the simulation clock, shifts and breaks, visual polish, low-quality mode */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE;
  const { renderer, scene, sun, hemi } = B.three;
  const CAPTURE = /[?&]capture/.test(location.search);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const opts = { cycle: true };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hour = () => ((S.st.t / 3600) % 24 + 24) % 24;

  // ---------- shifts ----------
  function shift(h) {
    if (h >= 7 && h < 15) return { name: 'Day shift', k: 1, brk: h >= 12 && h < 12.5 ? 'lunch break' : '' };
    if (h >= 15 && h < 23) return { name: 'Evening shift', k: 0.8, brk: h >= 19 && h < 19.5 ? 'dinner break' : '' };
    return { name: 'Night shift', k: 0.3, brk: h >= 3 && h < 3.5 ? 'meal break' : '' };
  }
  let lastShift = shift(hour()).name;

  // ---------- night lighting ----------
  const amb = new T.AmbientLight(0xfff1d6, 0);
  scene.add(amb);
  const lampMat = new T.MeshStandardMaterial({ color: '#f6f2e6', emissive: '#fff3d0', emissiveIntensity: 0.2 });
  const lamps = new T.InstancedMesh(new T.BoxGeometry(3.2, 0.12, 0.5), lampMat, 60);
  let li = 0;
  for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) {
    const m = new T.Matrix4().makeTranslation(-60 + i * 13.3, 11.6, -32 + j * 12.8);
    lamps.setMatrixAt(li++, m);
  }
  scene.add(lamps);

  // ---------- visual polish: forklift beacons and headlights, eyes on people ----------
  function dress() {
    S.forklifts.forEach((f) => {
      if (f.mesh.userData.beacon) return;
      const b = new T.Mesh(new T.SphereGeometry(0.11, 12, 8), new T.MeshStandardMaterial({ color: '#ffb000', emissive: '#ff9500', emissiveIntensity: 1 }));
      b.position.set(0, 2.47, 0.6);
      const lightMat = new T.MeshStandardMaterial({ color: '#ffffff', emissive: '#fffbe8', emissiveIntensity: 0.8 });
      [-0.4, 0.4].forEach((x) => { const h = new T.Mesh(new T.BoxGeometry(0.14, 0.1, 0.04), lightMat); h.position.set(x, 1.05, -0.72); f.mesh.add(h); });
      f.mesh.add(b);
      f.mesh.userData.beacon = b;
    });
  }
  B.actors.list.forEach((a) => {
    if (a.kind !== 'person' || a.mesh.userData.eyes) return;
    const u = a.mesh.userData, r = 0.115 * u.s, eyeMat = new T.MeshBasicMaterial({ color: '#1b1b1b' });
    [-1, 1].forEach((side) => { const e = new T.Mesh(new T.SphereGeometry(r * 0.13, 8, 6), eyeMat); e.position.set(side * r * 0.36, u.head.position.y + r * 0.12, r * 0.9); u.body.add(e); });
    u.eyes = true;
  });

  // ---------- low-quality mode ----------
  function setLow(on, quiet) {
    renderer.setPixelRatio(on ? 1 : Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = !on;
    sun.castShadow = !on;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    const r = B.three.stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    store.set('b100.low', on ? '1' : '0');
    const cb = document.getElementById('lyLow'); if (cb) cb.checked = on;
    if (!quiet) B.tools.toast(on ? 'Low-quality mode on: no shadows, lower resolution' : 'Full quality restored');
  }

  const layers = document.querySelector('.ovl.layers');
  layers.insertAdjacentHTML('beforeend', '<label><input type="checkbox" id="lyDay" checked>Day and night cycle</label><label><input type="checkbox" id="lyLow">Low-quality mode</label>');
  document.getElementById('lyDay').addEventListener('change', (e) => (opts.cycle = e.target.checked));
  document.getElementById('lyLow').addEventListener('change', (e) => setLow(e.target.checked));
  if (store.get('b100.low') === '1') setLow(true, true);
  // the layer list is long now: fold it behind a "Layers" button, open by default on wide screens
  const fold = document.createElement('button');
  fold.className = 'chip'; fold.textContent = 'Layers'; fold.style.justifySelf = 'start';
  layers.prepend(fold);
  const setFold = (o) => { layers.querySelectorAll('label').forEach((l) => (l.hidden = !o)); fold.setAttribute('aria-expanded', o); };
  let folded = innerWidth > 1100;
  fold.addEventListener('click', () => setFold((folded = !folded)));
  setFold(folded);

  // switch to low quality on its own if the first seconds run slowly
  let probeT = 0, probeN = 0, probed = CAPTURE || store.get('b100.low') != null;

  // ---------- frame ----------
  const night = new T.Color('#0a1019'), sandNight = new T.Color('#2c2822');
  let base = null, sandBase = null, themeT = 0, blink = 0;
  B.hooks.frame.push((dt) => {
    if (!probed) {
      probeT += dt; probeN++;
      if (probeT > 6) { probed = true; if (probeN / probeT < 24) { setLow(true, true); B.tools.toast('Switched to low-quality mode for smoother motion on this device'); } }
    }
    if (!base || (themeT += dt) > 1) {
      themeT = 0;
      base = new T.Color(getComputedStyle(document.documentElement).getPropertyValue('--scene').trim() || '#dbe2e8');
      sandBase = new T.Color(base.r + base.g + base.b < 1.2 ? '#4d4538' : '#cbb68e');
    }
    const h = hour();
    const d = opts.cycle ? smooth(5, 8, h) * (1 - smooth(17.5, 20, h)) : 1;
    const ang = ((h - 6) / 12) * Math.PI;
    sun.position.set(110 * Math.cos(ang), Math.max(12, 120 * Math.sin(ang)), 45);
    sun.intensity = 0.08 + 0.87 * d;
    hemi.intensity = 0.2 + 0.52 * d;
    amb.intensity = 0.42 * (1 - d);
    lampMat.emissiveIntensity = 0.15 + 1.6 * (1 - d);
    const bg = night.clone().lerp(base, d);
    scene.background = bg;
    if (scene.fog) scene.fog.color.copy(bg);
    W.sand.material.color.copy(sandNight.clone().lerp(sandBase, d));
    dress();
    blink += dt;
    S.forklifts.forEach((f, i) => { const b = f.mesh.userData.beacon; if (b) b.material.emissiveIntensity = (f.path && f.path.length) || f.lift ? (Math.sin(blink * 7 + i) > 0 ? 1.6 : 0.1) : 0.15; });
    const sh = shift(h);
    if (sh.name !== lastShift) {
      lastShift = sh.name;
      S.addLog('Shift change: ' + sh.name + ' starts', 'info');
      if (!CAPTURE) B.tools.toast(sh.name + ' starts');
    }
  });

  B.env = {
    shiftName: () => { const s = shift(hour()); return s.name + (s.brk ? ' · ' + s.brk : ''); },
    onBreak: () => !!shift(hour()).brk,
    rateFactor: () => { const s = shift(hour()); return s.k * (s.brk ? 0.5 : 1); },
    setLow, opts,
  };
})();
