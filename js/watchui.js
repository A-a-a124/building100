/* Building 19 - Safety Watch screens: live camera feed with detection boxes, violators board, evidence replay, heatmap and fixes */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, A = B.actors, P = B.panel, Wt = B.watch;
  const { renderer, scene, camera, stage, controls } = B.three;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const esc = P.esc;
  const $ = (id) => document.getElementById(id);

  // ---------- live feed: a small render from the camera, read back, then boxes drawn on top ----------
  const FW = 512, FH = 288;
  const rt = new T.WebGLRenderTarget(FW, FH, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
  rt.texture.encoding = renderer.outputEncoding;
  const px = new Uint8Array(FW * FH * 4);
  const IDENT = new Uint8Array(256).map((_, i) => i), GAMMA = new Uint8Array(256).map((_, i) => Math.round(Math.pow(i / 255, 1 / 2.2) * 255));
  const card = document.createElement('div');
  card.className = 'camfeed'; card.hidden = true;
  card.innerHTML = '<div class="cfH"><b id="cfName"></b><span class="cfTag">Simulated detections</span><button class="chip" id="cfX">Close</button></div><canvas id="cfC" width="512" height="288"></canvas><div class="cfB"><button class="chip" id="cfPrev">Previous</button><button class="chip" id="cfNext">Next</button><label><input type="checkbox" id="cfAuto" checked> Jump to new violations</label><span id="cfCount"></span></div>';
  stage.appendChild(card);
  const css = document.createElement('style');
  css.textContent = `.camfeed { position: absolute; z-index: 6; left: 12px; bottom: 12px; width: min(440px, calc(100% - 24px)); background: rgba(9,14,20,0.95); color: #e8eef3; border-radius: 12px; padding: 8px; display: grid; gap: 6px; box-shadow: var(--shadow); }
    .camfeed canvas { width: 100%; display: block; border-radius: 6px; background: #000; cursor: pointer; } .cfH { display: flex; gap: 8px; align-items: center; } .cfH b { font: 700 13px var(--f-mono); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .cfTag { font: 700 10px var(--f-mono); color: #ffc75c; border: 1px solid #ffc75c; border-radius: 5px; padding: 1px 5px; white-space: nowrap; } .cfB { display: flex; gap: 8px; align-items: center; font-size: 12px; flex-wrap: wrap; } #cfCount { margin-left: auto; font: 600 11px var(--f-mono); color: #9fb1bf; } .camfeed .chip { background: rgba(255,255,255,0.12); color: #fff; border-color: transparent; }
    body.cine .camfeed.hideCine { display: none; }
    .wbars { display: grid; gap: 7px; } .wbar { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto auto; gap: 8px; align-items: center; font-size: 13px; cursor: pointer; padding: 3px 4px; border-radius: 6px; } .wbar:hover { background: var(--surface-2); } .wbar[aria-pressed="true"] { background: var(--surface-2); outline: 1px solid var(--accent-strong); } .wbar .rk { font: 700 12px var(--f-mono); color: var(--muted); } .wbar .nm { min-width: 0; } .wbar .nm span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; } .wbar .nm i { display: block; height: 5px; background: var(--surface-2); border-radius: 3px; overflow: hidden; margin-top: 3px; } .wbar .nm u { display: block; height: 100%; background: #e2513a; } .wbar .pt { font: 700 13px var(--f-mono); } .wbar .tr { font: 700 12px var(--f-mono); width: 44px; text-align: right; } .wbar .tr.up { color: var(--bad); } .wbar .tr.dn { color: var(--ok); } .wbar .tr.fl { color: var(--muted); }
    .wseg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; } .wseg button { border: 1px solid var(--line); background: var(--surface-2); padding: 6px 4px; border-radius: 8px; font-weight: 600; font-size: 12px; color: var(--ink); } .wseg button[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
    .wev { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; font-size: 12px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); } .wev b { font-weight: 700; } .wev small { color: var(--muted); display: block; } .wsim { font: 700 11px var(--f-mono); color: #9a6a00; background: #fff3d1; border-radius: 6px; padding: 3px 7px; display: inline-block; } .wfix { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: 12px; padding: 6px 0; border-bottom: 1px solid var(--line); } .wfix b { display: block; font-size: 13px; } .wfix small { color: var(--muted); }
    .evcard { position: absolute; z-index: 7; left: 50%; top: 14px; transform: translateX(-50%); background: rgba(12,18,26,0.94); color: #fff; padding: 9px 14px; border-radius: 12px; font-size: 13px; box-shadow: var(--shadow); max-width: min(620px, calc(100% - 24px)); border-left: 4px solid #ff3b30; } .evcard b { display: block; font: 700 14px var(--f-display); } .evcard small { color: #c6d0d9; }`;
  document.head.appendChild(css);
  const ctx = $('cfC').getContext('2d');
  const img = ctx.createImageData(FW, FH);
  let curCam = null, tFeed = 0, auto = true, flashT = 0, flashE = null;
  const V = new T.Vector3(), V2 = new T.Vector3();

  function renderFeed() {
    const c = curCam; if (!c) return;
    const linear = B.cinematic && B.cinematic.isOn(), tm0 = renderer.toneMapping, lut = linear ? GAMMA : IDENT;
    rt.texture.encoding = linear ? T.LinearEncoding : renderer.outputEncoding; if (linear) renderer.toneMapping = T.NoToneMapping;
    const target = renderer.getRenderTarget(), labels = W.labels.visible, cones = Wt.coneGroup.visible, tags = A.tagsShown(), sh = renderer.shadowMap.needsUpdate;
    W.labels.visible = false; Wt.coneGroup.visible = false; Wt.rigGroup.visible = false; A.showTags(false); renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, c.cam);
    renderer.readRenderTargetPixels(rt, 0, 0, FW, FH, px);
    renderer.setRenderTarget(target); renderer.toneMapping = tm0;
    W.labels.visible = labels; Wt.coneGroup.visible = cones; Wt.rigGroup.visible = true; A.showTags(tags); renderer.shadowMap.needsUpdate = sh;
    // flip vertically, then a slightly desaturated CCTV grade
    const d = img.data;
    for (let y = 0; y < FH; y++) {
      const r0 = (FH - 1 - y) * FW * 4, w0 = y * FW * 4;
      for (let x = 0; x < FW; x++) {
        const a = r0 + x * 4, b = w0 + x * 4, cr = lut[px[a]], cg = lut[px[a + 1]], cb = lut[px[a + 2]], l = cr * 0.3 + cg * 0.59 + cb * 0.11;
        d[b] = l + (cr - l) * 0.62; d[b + 1] = l + (cg - l) * 0.62; d[b + 2] = l + (cb - l) * 0.62 + 4; d[b + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    drawBoxes(c);
  }
  function project(c, x, y, z) { V.set(x, y, z).project(c.cam); return V.z < 1 && Math.abs(V.x) < 1.15 && Math.abs(V.y) < 1.15 ? { x: (V.x + 1) * 0.5 * FW, y: (1 - V.y) * 0.5 * FH } : null; }
  function box(x0, y0, x1, y1, color, label, thick) {
    ctx.strokeStyle = color; ctx.lineWidth = thick || 1.5; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.font = '700 10px monospace'; const w = ctx.measureText(label).width + 6;
    ctx.fillStyle = color; ctx.fillRect(x0, Math.max(0, y0 - 13), w, 13);
    ctx.fillStyle = '#000'; ctx.fillText(label, x0 + 3, Math.max(9, y0 - 3));
  }
  // a stable confidence figure per object so the labels do not flicker
  const conf = (k) => (0.88 + ((k * 2654435761) >>> 0) % 11 / 100).toFixed(2);
  function drawBoxes(c) {
    let hits = 0, viol = 0;
    A.list.forEach((a, i) => {
      if (a.kind !== 'person' || a.state === 'desk') return;
      const u = a.mesh.userData, foot = project(c, a.x, 0, a.z), head = project(c, a.x, 1.9 * (u.s || 1), a.z);
      if (!foot || !head || foot.y - head.y < 6) return;
      const hh = foot.y - head.y, st = Wt.active.get(a), off = !Wt.onPath(a.x, a.z), haz = a.x > 47.4 && a.x < 66 && a.z > 3 && a.z < 37;
      let label = 'PERSON ' + conf(i + 3), color = '#3df08a', thick = 1.5;
      if (st) { label = { helmet: 'NO HELMET', vest: 'NO VEST', phone: 'PHONE IN USE' }[st.kind]; color = '#ff3b30'; thick = 2.5; viol++; }
      else if (haz) { label = 'NO PERMIT'; color = '#ff3b30'; thick = 2.5; viol++; }
      else if (off && a.route) { label = 'OFF WALKWAY'; color = '#ffc21f'; thick = 2; viol++; }
      box(head.x - hh * 0.32, head.y - 2, head.x + hh * 0.32, foot.y + 2, color, label + (st || haz || off && a.route ? '' : ''), thick);
      hits++;
    });
    S.forklifts.forEach((f) => {
      const a = project(c, f.x, 0, f.z), b = project(c, f.x, 2.6, f.z);
      if (!a || !b || a.y - b.y < 8) return;
      const hh = a.y - b.y, over = (f.speedNow || 0) > Wt.SPEED_LIMIT && f.path && f.path.length;
      const kmh = Math.round((f.speedNow || 0) * 3.6);
      box(b.x - hh * 0.55, b.y - 2, b.x + hh * 0.55, a.y + 2, over ? '#ff5a3c' : '#39d1ff', over ? 'OVER SPEED ' + kmh + ' KM/H' : 'FORKLIFT ' + f.n + ' · ' + kmh + ' KM/H', over ? 2.5 : 1.5);
      if (over) viol++;
      hits++;
    });
    Wt.blocked.forEach((q) => { const a = project(c, q.exit.x, 0, q.exit.z), b = project(c, q.exit.x, 1.6, q.exit.z); if (a && b) { const hh = a.y - b.y; box(b.x - hh * 0.8, b.y - 2, b.x + hh * 0.8, a.y + 2, '#ff3b30', 'FIRE EXIT BLOCKED', 2.5); viol++; } });
    // overlay: camera id, clock, recording dot, scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, FW, 18); ctx.fillStyle = '#fff'; ctx.font = '700 11px monospace';
    ctx.fillText(c.id + '  ' + c.name.toUpperCase(), 6, 13);
    const clock = S.clock(S.st.t) + ':' + String(Math.floor(S.st.t % 60)).padStart(2, '0');
    ctx.fillText(clock, FW - 76, 13);
    if (Math.floor(performance.now() / 500) % 2) { ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(FW - 88, 9, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.05)'; for (let y = 0; y < FH; y += 3) ctx.fillRect(0, y, FW, 1);
    if (flashE && performance.now() - flashT < 4000 && flashE.cam === c.id) { ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 5; ctx.strokeRect(2, 2, FW - 4, FH - 4); ctx.fillStyle = '#ff3b30'; ctx.fillRect(0, FH - 22, FW, 22); ctx.fillStyle = '#fff'; ctx.font = '700 12px monospace'; ctx.fillText((flashE.who + ': ' + Wt.TYPES[flashE.type].name).toUpperCase().slice(0, 60), 6, FH - 7); }
    $('cfCount').textContent = hits + ' objects · ' + viol + ' flagged';
  }
  function openCam(c) { curCam = c; card.hidden = false; $('cfName').textContent = c.id + ' · ' + c.name; tFeed = 9; Wt.CAMS.forEach((q) => { q.cone.material.opacity = q === c ? 0.22 : 0.09; }); }
  function closeCam() { curCam = null; card.hidden = true; Wt.CAMS.forEach((q) => { q.cone.material.opacity = 0.09; }); }
  $('cfX').addEventListener('click', closeCam);
  const stepCam = (d) => { if (!curCam) return; const i = Wt.CAMS.indexOf(curCam); openCam(Wt.CAMS[(i + d + Wt.CAMS.length) % Wt.CAMS.length]); };
  $('cfNext').addEventListener('click', () => stepCam(1));
  $('cfPrev').addEventListener('click', () => stepCam(-1));
  $('cfAuto').addEventListener('change', (e) => (auto = e.target.checked));
  $('cfC').addEventListener('click', () => { if (curCam) goToCam(curCam); });
  function goToCam(c) { const p = c.pos, l = c.look; B.ui.flyTo([p[0], p[1], p[2]], [p[0] + (l[0] - p[0]) * 0.35, l[1] + (p[1] - l[1]) * 0.65, p[2] + (l[2] - p[2]) * 0.35], 1.2); }

  // click a camera in the scene to open it
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!Wt.coneGroup.visible) return;
    const r = renderer.domElement.getBoundingClientRect(); let best = null, bd = 26;
    Wt.CAMS.forEach((c) => { V2.set(...c.pos).project(camera); if (V2.z > 1) return; const d = Math.hypot(((V2.x + 1) / 2) * r.width + r.left - e.clientX, ((1 - V2.y) / 2) * r.height + r.top - e.clientY); if (d < bd) { bd = d; best = c; } });
    if (best) openCam(best);
  });
  Wt.onEvent.push((e) => {
    flashE = e; flashT = performance.now();
    if (curCam && auto && e.points >= 2) { const c = Wt.CAMS.find((q) => q.id === e.cam); if (c) openCam(c); }
    if (B.sound && e.points >= 4) B.sound.alert();
    if (B.tools.isOpen('watch')) B.tools.refresh();
  });
  function setCams(on) { Wt.coneGroup.visible = on; const b = $('vCams'); if (b) b.setAttribute('aria-pressed', on); }
  $('views').insertAdjacentHTML('beforeend', '<button class="vbtn" id="vCams" aria-pressed="false" title="Show the cameras and their view, then click one">Cameras</button>');
  $('vCams').addEventListener('click', () => { const on = !Wt.coneGroup.visible; setCams(on); if (on) { if (!curCam) openCam(Wt.CAMS[Math.floor(Math.random() * Wt.CAMS.length)]); B.ui.setView('overview'); } else closeCam(); });

  // ---------- evidence: back in the time machine at that moment, seen from that camera ----------
  const evCard = document.createElement('div'); evCard.className = 'evcard'; evCard.hidden = true; stage.appendChild(evCard);
  const ringGeo = new T.RingGeometry(0.9, 1.25, 40);
  const evRing = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false, toneMapped: false })); evRing.rotation.x = -Math.PI / 2; evRing.visible = false; evRing.renderOrder = 9; scene.add(evRing);
  const evBeam = new T.Mesh(new T.CylinderGeometry(0.5, 0.9, 7, 20, 1, true), new T.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false, toneMapped: false })); evBeam.visible = false; scene.add(evBeam);
  function evidence(e) {
    const TL = B.timeline;
    if (!TL.active()) TL.enter();
    if (!TL.active()) return;
    const s = TL.samples; let i = s.findIndex((q) => q.t >= e.t - 25); if (i < 0) i = s.length - 1;
    TL.apply(i); const sl = $('tmS'); if (sl) sl.value = (i / Math.max(1, s.length - 1)) * 1000;
    const play = $('tmPlay'); if (play && play.textContent === 'Play') play.click();
    const c = Wt.CAMS.find((q) => q.id === e.cam);
    if (c) B.ui.flyTo([c.pos[0], c.pos[1], c.pos[2]], [e.x, 0.8, e.z], 1.4);
    evRing.position.set(e.x, 0.1, e.z); evBeam.position.set(e.x, 3.5, e.z); evRing.visible = evBeam.visible = true;
    evCard.innerHTML = '<b>Evidence · ' + esc(e.who) + '</b>' + esc(Wt.TYPES[e.type].name) + ' · ' + esc(e.zone) + ' · ' + S.clock(e.t) + ' · ' + esc(e.cam) + '<br><small>Time machine, camera angle. Simulated detection. Press Back to live to return.</small>';
    evCard.hidden = false;
    const was = TL.exit;
    if (!evidence.hooked) { evidence.hooked = true; const live = $('tmLive'); live.addEventListener('click', endEvidence); document.addEventListener('keydown', (k) => { if (k.key === 'Escape') endEvidence(); }); }
  }
  function endEvidence() { evCard.hidden = true; evRing.visible = evBeam.visible = false; }

  // ---------- violations heatmap ----------
  const GX0 = -72, GZ0 = -42, CELL = 2, NX = 96, NZ = 42;
  const hc = document.createElement('canvas'); hc.width = NX; hc.height = NZ;
  const htex = new T.CanvasTexture(hc); htex.magFilter = T.LinearFilter;
  const heat = new T.Mesh(new T.PlaneGeometry(NX * CELL, NZ * CELL), new T.MeshBasicMaterial({ map: htex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  heat.rotation.x = -Math.PI / 2; heat.position.set(GX0 + (NX * CELL) / 2, 0.08, GZ0 + (NZ * CELL) / 2); heat.visible = false; heat.renderOrder = 6; scene.add(heat);
  function paintHeat() {
    const g = new Float32Array(NX * NZ);
    Wt.events.forEach((e) => {
      const i = Math.floor((e.x - GX0) / CELL), j = Math.floor((e.z - GZ0) / CELL);
      for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) { const a = i + di, b = j + dj; if (a >= 0 && a < NX && b >= 0 && b < NZ) g[b * NX + a] += e.points / (1 + di * di + dj * dj); }
    });
    let max = 0; for (const v of g) max = Math.max(max, v);
    const c = hc.getContext('2d'), im = c.createImageData(NX, NZ);
    for (let k = 0; k < g.length; k++) { const v = max ? Math.pow(g[k] / max, 0.6) : 0, o = k * 4; im.data[o] = 255; im.data[o + 1] = Math.round(190 * (1 - v)); im.data[o + 2] = Math.round(50 * (1 - v)); im.data[o + 3] = v < 0.06 ? 0 : Math.round(55 + 190 * v); }
    c.putImageData(im, 0, 0); htex.needsUpdate = true;
  }
  function setHeat(on) { heat.visible = on; if (on) { paintHeat(); B.ui.setView('top'); } }

  // ---------- fixes: each builds something visible and cuts the rate of what it targets by about 70% ----------
  const barrierMat = new T.MeshStandardMaterial({ color: '#f2c21b', roughness: 0.5, metalness: 0.25 });
  function rail(x0, z0, x1, z1) {
    const g = new T.Group(), len = Math.hypot(x1 - x0, z1 - z0), ang = -Math.atan2(z1 - z0, x1 - x0);
    [0.55, 1.05].forEach((y) => { const b = new T.Mesh(new T.BoxGeometry(len, 0.09, 0.09), barrierMat); b.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); b.rotation.y = ang; g.add(b); });
    const n = Math.ceil(len / 2.4);
    for (let k = 0; k <= n; k++) { const q = new T.Mesh(new T.BoxGeometry(0.1, 1.1, 0.1), barrierMat); q.position.set(x0 + ((x1 - x0) * k) / n, 0.55, z0 + ((z1 - z0) * k) / n); g.add(q); }
    scene.add(g); return g;
  }
  const FIXES = [
    { id: 'barrier', name: 'Steel barrier along the east walkway', types: ['lane', 'close'], why: 'Most path breaches happen where people cut across to the forklift lane.', build: () => { rail(43, -22, 43, 28); rail(-30, -24.2, 40, -24.2); } },
    { id: 'gate', name: 'Permit lock on the hazmat cage gate', types: ['hazmat'], why: 'A badge lock stops anyone without a permit entering.', build: () => { const z = 3.2, g = new T.Mesh(new T.BoxGeometry(0.3, 0.5, 0.2), new T.MeshStandardMaterial({ color: '#1b2026', emissive: '#16c26a', emissiveIntensity: 0.9 })); g.position.set(46.1, 1.4, z + 5); scene.add(g); } },
    { id: 'limiter', name: 'Speed limiter on every forklift', types: ['speed'], why: 'Caps travel speed at 14 km/h in the building.', build: () => {} },
    { id: 'ppe', name: 'PPE check point at the doors', types: ['helmet', 'vest'], why: 'A station and camera check at the entrances, with spare helmets and vests.', build: () => { [[44.4, -28], [-46, -24]].forEach(([x, z]) => { const st = new T.Mesh(new T.BoxGeometry(0.9, 1.5, 0.35), new T.MeshStandardMaterial({ color: '#1b6fd1', roughness: 0.5 })); st.position.set(x, 0.75, z); scene.add(st); const l = W.makeLabel('PPE CHECK', { size: 0.7, bg: 'rgba(16,80,160,0.95)', fg: '#fff', weight: 700 }); l.position.set(x, 2, z); scene.add(l); }); } },
    { id: 'forkzone', name: 'Exclusion zone light under raised forks', types: ['forks'], why: 'Forklifts project a red zone on the floor while the mast is up.', build: () => {} },
    { id: 'exits', name: 'Hatched keep-clear boxes at fire exits', types: ['exit'], why: 'Floor marking plus a camera rule at every exit.', build: () => { const m = new T.MeshBasicMaterial({ color: '#d7282f', transparent: true, opacity: 0.4, depthWrite: false }); [[-26, -38], [22, -38], [-32, 38], [44, 38], [-67, -15], [-67, 22], [67, 0]].forEach(([x, z]) => { const p = new T.Mesh(new T.PlaneGeometry(4, 4), m); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.035, z); scene.add(p); }); } },
    { id: 'phones', name: 'Phone-free zones on the floor', types: ['phone'], why: 'Lockers at the entrances and signs along the walkways.', build: () => {} },
  ];
  const fixState = {};
  function applyFix(fix) {
    if (fixState[fix.id]) return;
    fix.types.forEach((t) => (Wt.applied[t] = 0.3));
    fixState[fix.id] = { at: S.st.t, before: rate(fix.types, 0, S.st.t) };
    fix.build();
    B.tools.toast('Applied: ' + fix.name + '. This type of violation now falls by about 70%.');
  }
  // events an hour of simulated time, for a set of types between two times
  function rate(types, from, to) {
    const list = Wt.events.filter((e) => types.includes(e.type) && e.t >= from && e.t <= to);
    const start = Wt.events.length ? Math.max(from, Wt.events[0].t) : from;
    const h = Math.max(0.2, (to - start) / 3600);
    return list.length / h;
  }
  function suggestion() {
    const byType = Wt.board('type');
    const ranked = byType.map((q) => ({ q, fix: FIXES.find((f) => f.types.includes(q.key) && !fixState[f.id]) })).filter((q) => q.fix);
    return ranked[0] || null;
  }

  // ---------- the tab ----------
  let by = 'person', pick = null;
  function render(el) {
    const ev = Wt.events, total = ev.length, pts = ev.reduce((n, e) => n + e.points, 0), rows = Wt.board(by), top = rows[0] ? rows[0].pts : 1, sug = suggestion();
    const filtered = (pick ? ev.filter((e) => e[{ person: 'who', shift: 'shift', zone: 'zone', type: 'type' }[by]] === pick) : ev).slice(-12).reverse();
    const cov = Wt.coverage();
    el.innerHTML = `<div class="btnrow" style="justify-content:space-between;align-items:center"><h4>Safety Watch</h4><span class="wsim">SIMULATED DETECTIONS</span></div>
      <p>${Wt.CAMS.length} cameras watch the floor. The twin checks every position against the walkways, the cage and the forklifts, and logs who, what, where and when. These events are generated to show how a real camera system would work; none of them is a real record.</p>
      <div class="row2"><div class="stat"><b>${fmt(total)}</b><small>detections so far</small></div><div class="stat"><b>${fmt(pts)}</b><small>safety points</small></div><div class="stat"><b>${Wt.open.length}</b><small>open supervisor tickets</small></div><div class="stat"><b>${fmt(cov * 100, 0)}%</b><small>of the floor seen by a camera</small></div></div>
      <div class="btnrow"><button class="btn primary" id="wCams">${Wt.coneGroup.visible ? 'Hide cameras' : 'Show cameras and live feed'}</button><button class="btn" id="wHeat">${heat.visible ? 'Hide violations heatmap' : 'Violations heatmap'}</button></div>
      <h4>Most violations by</h4>
      <div class="wseg">${[['person', 'Person'], ['shift', 'Shift'], ['zone', 'Zone'], ['type', 'Rule']].map(([k, n]) => '<button data-by="' + k + '" aria-pressed="' + (by === k) + '">' + n + '</button>').join('')}</div>
      <div class="wbars">${rows.length ? rows.slice(0, 9).map((r, i) => { const d = r.recent - r.prev, cls = d > 0 ? 'up' : d < 0 ? 'dn' : 'fl'; return '<div class="wbar" data-pick="' + esc(r.key) + '" aria-pressed="' + (pick === r.key) + '"><span class="rk">' + (i + 1) + '</span><div class="nm"><span>' + esc(r.label) + '</span><i><u style="width:' + (r.pts / top) * 100 + '%"></u></i></div><span class="pt">' + r.pts + ' pts</span><span class="tr ' + cls + '">' + (d > 0 ? '▲ ' + d : d < 0 ? '▼ ' + -d : '=') + '</span></div>'; }).join('') : '<p>No detections yet. Run the simulation for a few minutes.</p>'}</div>
      <p>Points by severity. The arrow compares the last 30 simulated minutes with the 30 before.</p>
      <h4>${pick ? 'Latest for ' + esc(by === 'type' ? Wt.TYPES[pick].name : pick) : 'Latest detections'}</h4>
      <div>${filtered.map((e) => '<div class="wev"><div><b>' + esc(e.who) + '</b> · ' + esc(Wt.TYPES[e.type].name) + '<small>' + S.clock(e.t) + ' · ' + esc(e.zone) + ' · ' + esc(e.cam) + (e.closed ? ' · ticket closed' : '') + '</small></div><div class="btnrow"><button class="chip" data-ev="' + e.id + '">Evidence</button>' + (Wt.open.includes(e) ? '<button class="chip" data-cl="' + e.id + '">Close ticket</button>' : '') + '</div></div>').join('') || '<p>Nothing yet.</p>'}</div>
      <h4>Suggested fixes</h4>
      ${sug ? '<p>Top issue now: <b>' + esc(Wt.TYPES[sug.q.key].name) + '</b> (' + sug.q.n + ' times). Suggested: ' + esc(sug.fix.name) + '.</p>' : ''}
      <div>${FIXES.map((f) => { const st = fixState[f.id], now = st ? rate(f.types, st.at, S.st.t) : null; return '<div class="wfix"><div><b>' + esc(f.name) + '</b><small>' + esc(f.why) + (st ? ' Before ' + fmt(st.before, 1) + ' an hour, now ' + fmt(now, 1) + ' an hour.' : '') + '</small></div>' + (st ? '<span class="pill ok"><i></i>Applied</span>' : '<button class="btn" data-fix="' + f.id + '">Apply</button>') + '</div>'; }).join('')}</div>
      <label><input type="checkbox" id="wWarn" ${Wt.warnOn() ? 'checked' : ''}> Beacon, ring and warning beep when a person is within 5 m of a moving forklift</label>
      <div class="btnrow"><button class="btn" id="wCsv">Export detections (CSV)</button></div>`;
    el.querySelector('#wCams').addEventListener('click', () => { const on = !Wt.coneGroup.visible; setCams(on); if (on && !curCam) openCam(Wt.CAMS[0]); if (!on) closeCam(); render(el); });
    el.querySelector('#wHeat').addEventListener('click', () => { setHeat(!heat.visible); render(el); });
    el.querySelectorAll('[data-by]').forEach((b) => b.addEventListener('click', () => { by = b.dataset.by; pick = null; render(el); }));
    el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { pick = pick === b.dataset.pick ? null : b.dataset.pick; render(el); }));
    el.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => evidence(ev.find((q) => q.id === +b.dataset.ev))));
    el.querySelectorAll('[data-cl]').forEach((b) => b.addEventListener('click', () => { const e = ev.find((q) => q.id === +b.dataset.cl); const x = Wt.blocked.find((q) => q.ev === e); if (x) Wt.clearExit(x); else Wt.closeTicket(e); render(el); }));
    el.querySelectorAll('[data-fix]').forEach((b) => b.addEventListener('click', () => { applyFix(FIXES.find((f) => f.id === b.dataset.fix)); if (heat.visible) paintHeat(); render(el); }));
    el.querySelector('#wWarn').addEventListener('change', (e) => Wt.setWarn(e.target.checked));
    el.querySelector('#wCsv').addEventListener('click', () => B.tools.download('building19-safety-watch-simulated.csv', 'Time,Person,Rule,Points,Zone,Shift,Camera,Status\n' + ev.map((e) => [S.clock(e.t), e.who, Wt.TYPES[e.type].name, e.points, e.zone, e.shift, e.cam, e.closed ? 'Closed' : 'Open'].map((v) => '"' + v + '"').join(',')).join('\n')));
  }
  B.tools.add({ id: 'watch', label: 'Safety Watch', render });

  let tHeat = 0;
  B.hooks.frame.push((dt) => {
    if (curCam && (tFeed += dt) > 0.2) { tFeed = 0; renderFeed(); }
    if (heat.visible && (tHeat += dt) > 2) { tHeat = 0; paintHeat(); }
    if (evRing.visible) { const k = 1 + 0.35 * Math.sin(performance.now() / 180); evRing.scale.setScalar(k); }
    // exclusion light under raised forks once that fix is applied
    if (fixState.forkzone) S.forklifts.forEach((f) => { const u = f.mesh.userData; if (u.warnRing && f.carY > 1.2) { u.warnRing.visible = true; u.warnRing.material.opacity = 0.6; } });
  });
  Object.assign(Wt, { open_: openCam, openCam, closeCam, setCams, evidence, endEvidence, setHeat, heat, FIXES, applyFix, fixState, rate, suggestion, renderFeed, feedOn: () => !!curCam, hideInCine: (v) => card.classList.toggle('hideCine', v) });
})();
