/* Building 100 - scene, camera, interaction and render loop */
(function () {
  const B = window.B100, W = B.world, S = B.sim, P = B.panel;
  const T = THREE;
  const $ = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  // ---------- Scene ----------
  const stage = $('stage');
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;
  stage.prepend(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(42, 1, 0.3, 1200);
  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 2;
  controls.maxDistance = 320;
  controls.screenSpacePanning = true;

  scene.add(new T.HemisphereLight(0xffffff, 0x9c8b6c, 0.72));
  const sun = new T.DirectionalLight(0xfff4e0, 0.95);
  sun.position.set(70, 110, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 70, bottom: -70, near: 10, far: 300 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  W.build(scene);
  S.init();

  function applyTheme() {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--scene').trim() || '#dbe2e8';
    scene.background = new T.Color(c);
    scene.fog = new T.Fog(c, 220, 520);
    // Desert ground follows the theme: bright sand by day, dusk tone in dark mode
    const bg = new T.Color(c);
    W.sand.material.color.set(bg.r + bg.g + bg.b < 1.2 ? '#6b604d' : '#cbb68e');
    drawChart();
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function resize() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => W.buildLabels());

  // ---------- Camera ----------
  const VIEWS = [
    { id: 'overview', name: 'Overview', pos: [-62, 70, 92], tgt: [2, 0, 2] },
    { id: 'top', name: 'Plan view', pos: [0, 145, 0.1], tgt: [0, 0, 0] },
    { id: 'rcv', name: 'Receiving', pos: [-30, 20, -2], tgt: [-40, 0, -29] },
    { id: 'rack', name: 'Racking', pos: [-48, 22, 34], tgt: [2, 3, 0] },
    { id: 'aisle', name: 'In an aisle', pos: [-30, 2.6, -12.2], tgt: [14, 3.4, -12.2] },
    { id: 'pipe', name: 'Pipe yard', pos: [-76, 17, 28], tgt: [-46, 1, 13] },
    { id: 'haz', name: 'Hazmat', pos: [28, 18, 44], tgt: [48, 0, 19] },
    { id: 'dsp', name: 'Shipping', pos: [4, 20, 62], tgt: [5, 0, 29] },
  ];
  let fly = null, follow = null;
  function flyTo(pos, tgt, dur) {
    follow = null;
    if (reduced) dur = 0.01;
    fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new T.Vector3(...pos), t1: new T.Vector3(...tgt), k: 0, dur: dur || 1.4 };
  }
  function setView(id) {
    const v = VIEWS.find((q) => q.id === id);
    flyTo(v.pos, v.tgt);
    document.querySelectorAll('.vbtn').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === id));
  }
  function clearViewPressed() { document.querySelectorAll('.vbtn').forEach((b) => b.setAttribute('aria-pressed', 'false')); }
  $('views').innerHTML = VIEWS.map((v) => '<button class="vbtn" data-view="' + v.id + '" aria-pressed="false">' + v.name + '</button>').join('');
  $('views').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) { stopTour(); setView(b.dataset.view); } });

  // ---------- Selection ----------
  let selected = null;
  function focusSlot(s, move) {
    selected = { type: 'slot', s };
    const h = s.item >= 0 ? B.ITEMS[s.item].h + 0.14 : 1.4;
    W.highlightAt(s.x, s.y, s.z, h);
    P.showSlot(s);
    if (move !== false) {
      // Look at the pallet face from across its aisle, high enough to clear the opposite rack row
      const side = Math.sign(s.access - s.z);
      flyTo([s.x - 6, 28, s.z + side * 12.4], [s.x, s.y + 0.6, s.z], 1.2);
      clearViewPressed();
    }
  }
  function focusZone(id, move) {
    const zn = B.zoneById(id);
    selected = { type: 'zone', id };
    const cx = (zn.x[0] + zn.x[1]) / 2, cz = (zn.z[0] + zn.z[1]) / 2;
    const size = Math.max(zn.x[1] - zn.x[0], zn.z[1] - zn.z[0]);
    W.highlightAt(cx, 0, cz, 0.01, zn.x[1] - zn.x[0], zn.z[1] - zn.z[0]);
    W.hlBeam.visible = false;
    P.showZone(id);
    if (move !== false) {
      flyTo([cx - size * 0.55, size * 0.75 + 6, cz + size * 0.9 + 6], [cx, 0, cz], 1.3);
      clearViewPressed();
    }
  }
  function focusForklift(n) {
    selected = { type: 'forklift', n };
    W.clearHighlight();
    P.showForklift(n);
  }
  B.ui = { focusSlot, focusZone, setView };

  const ray = new T.Raycaster();
  const mouse = new T.Vector2();
  function pickAt(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(W.pickables, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (!o) continue;
      const pk = o.userData.pick;
      if (pk.type === 'slot') return { type: 'slot', s: B.SLOTS[h.instanceId] };
      return pk;
    }
    return null;
  }
  function describe(pk) {
    if (pk.type === 'slot') return pk.s.code + (pk.s.item >= 0 ? ': ' + B.ITEMS[pk.s.item].name : ' (empty)');
    if (pk.type === 'zone') return B.zoneById(pk.id).name;
    if (pk.type === 'forklift') return 'Forklift ' + pk.n;
    return '';
  }
  let down = null, hoverReq = null;
  const tip = $('tip');
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; fly = null; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const pk = pickAt(e.clientX, e.clientY);
    if (!pk) return;
    stopTour();
    if (pk.type === 'slot') focusSlot(pk.s, false);
    else if (pk.type === 'zone') focusZone(pk.id, false);
    else if (pk.type === 'forklift') focusForklift(pk.n);
    if (innerWidth <= 900) $('details').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) { tip.hidden = true; return; }
    if (hoverReq) return;
    hoverReq = requestAnimationFrame(() => {
      hoverReq = null;
      const pk = pickAt(e.clientX, e.clientY);
      const r = stage.getBoundingClientRect();
      if (pk) {
        tip.textContent = describe(pk);
        tip.style.left = e.clientX - r.left + 'px';
        tip.style.top = e.clientY - r.top + 'px';
        tip.hidden = false;
        renderer.domElement.style.cursor = 'pointer';
      } else {
        tip.hidden = true;
        renderer.domElement.style.cursor = '';
      }
    });
  });
  renderer.domElement.addEventListener('pointerleave', () => (tip.hidden = true));

  // ---------- Panel ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-slot],[data-zone],[data-copy],[data-follow]');
    if (!t) return;
    stopTour();
    if (t.dataset.slot) focusSlot(B.SLOTS[+t.dataset.slot]);
    else if (t.dataset.zone) focusZone(t.dataset.zone);
    else if (t.dataset.follow) { const f = S.forklifts.find((q) => q.n === +t.dataset.follow); if (f) { fly = null; follow = f; } }
    else if (t.dataset.copy) {
      const txt = t.dataset.copy;
      const done = () => { t.textContent = 'Copied'; setTimeout(() => (t.textContent = 'Copy'), 1500); };
      try { navigator.clipboard.writeText(txt).then(done, () => (t.textContent = txt)); } catch (err) { t.textContent = txt; }
    }
    if (innerWidth <= 900 && !t.dataset.copy) stage.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });
  const q = $('q');
  q.addEventListener('input', () => P.renderSearch(q.value));
  q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = $('results').querySelector('[data-slot],[data-zone]');
    if (first) first.click();
  });
  P.renderExamples((v) => { q.value = v; P.renderSearch(v); });
  P.renderZones();
  P.renderLegend(false);
  P.showWelcome();

  $('lyLabels').addEventListener('change', (e) => (W.labels.visible = e.target.checked));
  $('lyWalls').addEventListener('change', (e) => (W.shell.visible = e.target.checked));
  $('lyLanes').addEventListener('change', (e) => (W.laneGroup.visible = e.target.checked));
  $('lyHeat').addEventListener('change', (e) => { W.setHeatmap(e.target.checked); P.renderLegend(e.target.checked); });

  // ---------- Simulation dock ----------
  const playIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  function syncDock() {
    $('play').innerHTML = S.st.running ? pauseIcon : playIcon;
    $('play').setAttribute('aria-label', S.st.running ? 'Pause simulation' : 'Run simulation');
    document.querySelectorAll('#speed button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.v === S.st.speed));
    document.querySelectorAll('#rate button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === S.st.rate));
    $('flN').textContent = S.targetForklifts;
  }
  $('play').addEventListener('click', () => { S.st.running = !S.st.running; syncDock(); });
  $('speed').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.st.speed = +b.dataset.v; syncDock(); } });
  $('rate').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.st.rate = b.dataset.v; S.resetStats(); syncDock(); } });
  $('flMinus').addEventListener('click', () => { S.setForklifts(S.targetForklifts - 1); S.resetStats(); syncDock(); });
  $('flPlus').addEventListener('click', () => { S.setForklifts(S.targetForklifts + 1); S.resetStats(); syncDock(); });
  if (reduced) S.st.running = false;
  syncDock();

  const KPI = [
    ['occ', 'Rack occupancy', 'of 2,400 positions'], ['received', 'Pallets put away', 'since stats reset'], ['shipped', 'Pallets shipped', 'loaded on trucks'],
    ['open', 'Open tasks', 'put-away + picking'], ['util', 'Forklift utilisation', 'fleet average'], ['cycle', 'Order cycle time', 'minutes, order to truck'],
  ];
  $('kpis').innerHTML = KPI.map(([k, n, d]) => '<div class="kpi"><small>' + n + '</small><b id="k_' + k + '">–</b><em>' + d + '</em></div>').join('');
  let lastDetailKey = '', lastZoneKey = '';
  function renderKpis() {
    const k = S.kpis();
    $('clock').textContent = k.clock;
    $('k_occ').textContent = (k.occ * 100).toFixed(1) + '%';
    $('k_received').textContent = k.received;
    $('k_shipped').textContent = k.shipped;
    $('k_open').textContent = k.open;
    $('k_util').textContent = Math.round(k.util * 100) + '%';
    $('k_cycle').textContent = k.cycle == null ? '–' : k.cycle.toFixed(0);
    // Re-render the panel only when its content changes, so clicks are not lost
    let key = '';
    if (selected && selected.type === 'forklift') { const d = S.describeForklift(selected.n); key = d ? d.status + d.detail + Math.round(d.util * 100) : 'x'; }
    if (selected && selected.type === 'slot') key = selected.s.item + '|' + selected.s.reserved + '|' + selected.s.qty;
    if (selected && key !== lastDetailKey) {
      lastDetailKey = key;
      if (selected.type === 'forklift') P.showForklift(selected.n);
      else if (selected.type === 'slot') P.showSlot(selected.s);
    }
    const zk = B.ZONES.map((z) => { const o = P.zoneOccupancy(z.id); return o == null ? '' : Math.round(o * 100); }).join(',');
    if (zk !== lastZoneKey) { lastZoneKey = zk; P.renderZones(); }
    drawChart();
  }
  S.onLog = () => {
    $('log').innerHTML = S.log.slice(0, 5).map((l) => '<div><time>' + l.t + '</time><span>' + P.esc(l.msg) + '</span></div>').join('');
  };
  S.onLog();

  function drawChart() {
    const c = $('chart'), ctx = c.getContext('2d');
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent-strong').trim(), muted = cs.getPropertyValue('--muted').trim(), line = cs.getPropertyValue('--line').trim();
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, (c.height * i) / 4); ctx.lineTo(c.width, (c.height * i) / 4); ctx.stroke(); }
    const h = S.history;
    if (h.length < 2) return;
    const maxOpen = Math.max(8, ...h.map((p) => p.open));
    const X = (i) => 8 + (i / (h.length - 1)) * (c.width - 16);
    const series = (val, color, fill) => {
      ctx.beginPath();
      h.forEach((p, i) => (i ? ctx.lineTo(X(i), val(p)) : ctx.moveTo(X(i), val(p))));
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      if (fill) {
        ctx.lineTo(X(h.length - 1), c.height);
        ctx.lineTo(X(0), c.height);
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const last = h[h.length - 1];
      ctx.beginPath();
      ctx.arc(X(h.length - 1), val(last), 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };
    series((p) => c.height - 10 - ((p.occ - 0.5) / 0.5) * (c.height - 20), accent, true);
    series((p) => c.height - 10 - (p.open / maxOpen) * (c.height - 20), muted, false);
  }

  // ---------- Guided tour ----------
  const TOUR = [
    ['overview', null, 'Building 100 from outside', 'A 120 x 70 m materials warehouse. Stock arrives through 4 doors on the north side and leaves through 4 doors on the south side. Yellow lines mark the forklift lanes.'],
    ['rcv', 'RCV', 'Receiving', 'Inbound trucks back onto the doors and their pallets are unloaded into the staging lane. A door light turns red while the door is occupied.'],
    [null, 'QC', 'Quality inspection', 'Material is checked against the purchase order here. A green tag means accepted, red means on hold for non-conformance.'],
    ['rack', 'RACK', 'Pallet racking', '12 rows, A to L, each with 20 bays on 5 levels. Pallet colour shows the material category, and the yellow letters on the row ends tell you which row you are looking at.'],
    ['aisle', null, 'Inside an aisle', 'This is the operator view down an aisle. Drag to look around and click any pallet to see its contents, quantity and material number.'],
    ['pipe', 'PIPE', 'Pipe yard', 'Cantilever racks hold bundles of 12 m pipe on three arm levels.'],
    [null, 'SHELF', 'Small parts store', 'Bin shelving for small spares such as O-rings, fuses and needle bearings.'],
    ['haz', 'HAZ', 'Hazardous materials cage', 'A fenced cage with a containment floor. Drums are colour-coded by hazard class and gas cylinders are chained in a rack.'],
    ['dsp', 'DSP', 'Shipping and issue', 'Forklifts gather the pallets for each issue order in front of a door, then a truck arrives and loads them.'],
    ['overview', null, 'Your turn', 'Search for a material in the left panel, or change the workload and forklift count at the bottom and watch the indicators respond.'],
  ];
  let tourI = -1, tourT = 0;
  const DWELL = 9;
  function showTour(i) {
    tourI = Math.max(0, Math.min(TOUR.length - 1, i));
    tourT = 0;
    const [view, zone, title, text] = TOUR[tourI];
    $('tour').hidden = false;
    $('tourStep').textContent = 'Step ' + (tourI + 1) + ' of ' + TOUR.length;
    $('tourTitle').textContent = title;
    $('tourText').textContent = text;
    $('tourNext').textContent = tourI === TOUR.length - 1 ? 'Finish' : 'Next';
    $('tourPrev').disabled = tourI === 0;
    if (zone) focusZone(zone, !view);
    else { selected = null; W.clearHighlight(); P.showWelcome(); }
    if (view) setView(view);
  }
  function stopTour() { if (tourI < 0) return; tourI = -1; $('tour').hidden = true; }
  $('tourBtn').addEventListener('click', () => { closeIntro(); showTour(0); });
  $('tourNext').addEventListener('click', () => (tourI === TOUR.length - 1 ? stopTour() : showTour(tourI + 1)));
  $('tourPrev').addEventListener('click', () => showTour(tourI - 1));
  $('tourClose').addEventListener('click', stopTour);

  // ---------- Welcome screen ----------
  function closeIntro() { $('intro').hidden = true; store.set('b100.intro', '1'); }
  $('helpBtn').addEventListener('click', () => ($('intro').hidden = false));
  $('introClose').addEventListener('click', closeIntro);
  $('introTour').addEventListener('click', () => { closeIntro(); showTour(0); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeIntro(); stopTour(); } });
  // ?capture: frame-by-frame mode used to render the promo video (no intro, no real-time loop)
  const CAPTURE = /[?&]capture/.test(location.search);
  if (!store.get('b100.intro') && !CAPTURE) $('intro').hidden = false;

  // Opening shot: camera sweeps in toward the building
  camera.position.set(-190, 140, 210);
  controls.target.set(0, 0, 0);
  flyTo(VIEWS[0].pos, VIEWS[0].tgt, 4.2);
  document.querySelector('[data-view="overview"]').setAttribute('aria-pressed', 'true');

  // ---------- Loop ----------
  const clock = new T.Clock();
  let kpiT = 0, pulse = 0;
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  function frame(dt) {
    S.update(dt);
    if (fly) {
      fly.k = Math.min(1, fly.k + dt / fly.dur);
      const e = ease(fly.k);
      camera.position.lerpVectors(fly.p0, fly.p1, e);
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (fly.k >= 1) fly = null;
    }
    if (follow) {
      const tgt = new T.Vector3(follow.x, 1.5, follow.z);
      const off = camera.position.clone().sub(controls.target);
      controls.target.lerp(tgt, 0.12);
      camera.position.copy(controls.target).add(off);
    }
    if (tourI >= 0 && $('intro').hidden) {
      tourT += dt;
      $('tourProg').style.width = Math.min(100, (tourT / DWELL) * 100) + '%';
      if (tourT > DWELL) tourI === TOUR.length - 1 ? stopTour() : showTour(tourI + 1);
    }
    if (W.hl.visible) {
      pulse += dt * 3;
      const s = 0.5 + 0.5 * Math.sin(pulse);
      W.hlBeam.material.opacity = 0.2 + 0.3 * s;
      W.hlRing.scale.setScalar(1 + 0.25 * s);
      W.hlGlow.material.opacity = 0.25 + 0.4 * s;
      if (selected && selected.type === 'slot') W.hlBeam.visible = true;
    }
    kpiT += dt;
    if (kpiT > 0.4) { kpiT = 0; renderKpis(); }
    controls.update();
    renderer.render(scene, camera);
  }
  function loop() {
    frame(Math.min(clock.getDelta(), 0.1));
    requestAnimationFrame(loop);
  }
  resize();
  applyTheme();
  renderKpis();
  if (CAPTURE) {
    fly = null;
    B.capture = {
      step: (dt) => frame(dt),
      flyTo, setView, focusSlot, focusZone, focusForklift, showTour, stopTour, camera, controls,
      follow: (n) => { const f = S.forklifts.find((q) => q.n === n); fly = null; follow = f || null; },
      cine: (on) => document.body.classList.toggle('cine', on),
      jump: (pos, tgt) => { fly = null; follow = null; camera.position.set(...pos); controls.target.set(...tgt); },
      // Page coordinates of a world point, so a scripted cursor can aim at 3D objects
      screen: (x, y, z) => {
        const v = new T.Vector3(x, y, z).project(camera), r = renderer.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
    };
  } else loop();
})();
