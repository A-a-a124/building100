/* Building 100 - emergency drill: fire scenario, escape routes, assembly points and evacuation time */
(function () {
  const B = window.B100, W = B.world, S = B.sim, T = THREE, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const tr = (t) => (B.tr ? B.tr(t) : t);
  const BLD = B.BUILDING, WALK = 1.3, TARGET = 180;
  const EXITS = [
    { id: 'N1', x: -26, z: BLD.z0, nx: 0, nz: -1 }, { id: 'N2', x: 22, z: BLD.z0, nx: 0, nz: -1 },
    { id: 'S1', x: -32, z: BLD.z1, nx: 0, nz: 1 }, { id: 'S2', x: 44, z: BLD.z1, nx: 0, nz: 1 },
    { id: 'W1', x: BLD.x0, z: -15, nx: -1, nz: 0 }, { id: 'W2', x: BLD.x0, z: 22, nx: -1, nz: 0 }, { id: 'E1', x: BLD.x1, z: 0, nx: 1, nz: 0 },
  ];
  const POINTS = [{ id: 'Assembly point A', x: -10, z: -60 }, { id: 'Assembly point B', x: -92, z: 4 }, { id: 'Assembly point C', x: 58, z: 60 }];
  const FIRES = {
    haz: { name: 'Fire in the hazardous materials cage', x: 58, z: 22, r: 26 },
    chg: { name: 'Battery fire at the forklift chargers', x: 8, z: -35, r: 16 },
  };
  let scenario = 'haz', drill = null, last = null;
  // every finished drill is kept in this browser, to show whether evacuation is getting faster
  const KEY = 'b100.drills', CAPTURE = /[?&]capture/.test(location.search);
  let history = [];
  try { history = CAPTURE ? [] : JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) {}
  last = history[history.length - 1] || null;
  const saveHistory = () => { try { if (!CAPTURE) localStorage.setItem(KEY, JSON.stringify(history.slice(-30))); } catch (e) {} };

  // ---------- permanent fire exits with green signs ----------
  const exitMat = W.mat('#1f8a4c', { roughness: 0.5 });
  EXITS.forEach((e) => {
    const side = e.nx !== 0;
    const door = W.box(side ? 0.12 : 1.4, 2.3, side ? 1.4 : 0.12, '#1f8a4c'); door.material = exitMat;
    door.position.set(e.x - e.nx * 0.12, 1.15, e.z - e.nz * 0.12);
    const sign = W.box(side ? 0.08 : 0.9, 0.32, side ? 0.9 : 0.08, '#27c26a', { emissive: '#1fd16a', emissiveIntensity: 0.9 });
    sign.position.set(e.x - e.nx * 0.3, 2.75, e.z - e.nz * 0.3);
    W.scene.add(door, sign);
    e.sign = sign;
  });

  // ---------- routing ----------
  const inRacks = (x, z) => x > -34 && x < 37 && z > -24 && z < 25;
  const inZone = (id, x, z) => { const q = B.zoneById(id); return x >= q.x[0] && x <= q.x[1] && z >= q.z[0] && z <= q.z[1]; };
  const len = (pts) => pts.reduce((n, p, i) => (i ? n + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0), 0);
  function route(x, z, fire) {
    let best = null;
    EXITS.forEach((e) => {
      if (Math.hypot(e.x - fire.x, e.z - fire.z) < fire.r) return;
      const pts = [{ x, z }];
      if (inRacks(x, z)) pts.push({ x: e.x < 2 ? -36 : 40, z });
      if (inZone('OFF', x, z)) { const o = B.zoneById('OFF'); pts.push({ x: o.x[1] - 1.5, z: o.z[1] - 1 }, { x: o.x[1] - 1.5, z: o.z[1] + 1 }); }
      if (inZone('HAZ', x, z)) { const hz = B.zoneById('HAZ'); pts.push({ x: hz.x[0] - 1, z: (hz.z[0] + hz.z[1]) / 2 }); }
      pts.push({ x: e.x - e.nx * 1.5, z: e.z - e.nz * 1.5 }, { x: e.x + e.nx * 3, z: e.z + e.nz * 3 });
      const ap = POINTS.slice().sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))[0];
      pts.push({ x: ap.x + (Math.random() - 0.5) * 3, z: ap.z + (Math.random() - 0.5) * 3 });
      const inside = len(pts.slice(0, -1));
      if (!best || inside < best.inside) best = { pts, exit: e, ap, inside, total: len(pts) };
    });
    return best;
  }
  function expected(fire) {
    return B.ZONES.filter((z) => !z.outdoor && z.id !== 'CHG' || (z.id === 'CHG' && fire !== FIRES.chg)).map((zn) => {
      const r = route((zn.x[0] + zn.x[1]) / 2, (zn.z[0] + zn.z[1]) / 2, fire);
      return { zone: zn.name, exit: r.exit.id, t: 30 + r.inside / WALK };
    });
  }

  // ---------- fire, smoke and alarm effects ----------
  function smokeTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(c);
  }
  const tex = smokeTex();
  function makeFire(f) {
    const g = new T.Group(); g.position.set(f.x, 0, f.z);
    const flames = [];
    for (let k = 0; k < 14; k++) {
      const m = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k % 3 ? '#ff7a1a' : '#ffd23a', blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
      m.userData = { a: Math.random() * 6.28, r: Math.random() * 1.6, s: 1.2 + Math.random() * 1.6, sp: 2 + Math.random() * 2 };
      g.add(m); flames.push(m);
    }
    const smoke = [];
    for (let k = 0; k < 26; k++) {
      const m = new T.Sprite(new T.SpriteMaterial({ map: tex, color: '#3a3a3a', depthWrite: false, transparent: true, opacity: 0.5 }));
      m.userData = { life: Math.random() * 6, a: Math.random() * 6.28 };
      g.add(m); smoke.push(m);
    }
    const light = new T.PointLight('#ff6a00', 3, 40, 2); light.position.y = 3; g.add(light);
    W.scene.add(g);
    return { g, flames, smoke, light };
  }
  function animFire(fx, t, dt) {
    fx.flames.forEach((m) => {
      const u = m.userData, k = (t * u.sp + u.a) % 1;
      m.position.set(Math.cos(u.a) * u.r * (1 - k), 0.4 + k * 3.2, Math.sin(u.a) * u.r * (1 - k));
      m.scale.setScalar(u.s * (1 - k * 0.6)); m.material.opacity = 1 - k;
    });
    fx.smoke.forEach((m) => {
      const u = m.userData; u.life += dt; if (u.life > 6) u.life = 0;
      const k = u.life / 6;
      m.position.set(Math.cos(u.a) * k * 6, 3 + k * 9, Math.sin(u.a) * k * 6);
      m.scale.setScalar(2 + k * 9); m.material.opacity = 0.55 * (1 - k);
    });
    fx.light.intensity = 2.5 + Math.sin(t * 23) * 0.6 + Math.sin(t * 7) * 0.5;
  }

  // ---------- the drill ----------
  const banner = document.createElement('div');
  banner.className = 'drill'; banner.hidden = true;
  banner.innerHTML = '<b id="drTitle"></b><span id="drInfo"></span><div class="btnrow"><button class="chip" id="drSpeed">Speed 1x</button><button class="chip" id="drEnd">End drill</button></div>';
  B.three.stage.appendChild(banner);
  const css = document.createElement('style');
  css.textContent = `.drill { position: absolute; z-index: 6; top: 12px; left: 50%; transform: translateX(-50%); background: #b3261e; color: #fff; border-radius: 12px; padding: 10px 14px; display: grid; gap: 4px; text-align: center; box-shadow: var(--shadow); max-width: calc(100% - 32px); }
    .drill b { font: 700 15px var(--f-display); letter-spacing: 0.02em; } .drill span { font: 600 13px var(--f-mono); } .drill .chip { background: rgba(255,255,255,0.18); color: #fff; border-color: transparent; } .drill .btnrow { justify-content: center; }`;
  document.head.appendChild(css);

  function start() {
    if (drill) return;
    const fire = FIRES[scenario], people = B.actors.list.filter((a) => a.kind === 'person');
    const lines = new T.Group(); W.scene.add(lines);
    const markers = new T.Group(); W.scene.add(markers);
    POINTS.forEach((p) => {
      const ring = new T.Mesh(new T.RingGeometry(3, 3.6, 40), new T.MeshBasicMaterial({ color: '#27c26a', side: T.DoubleSide, toneMapped: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.08, p.z);
      const lab = W.makeLabel(tr(p.id), { size: 1.2, bg: 'rgba(31,138,76,0.95)', weight: 700 }); lab.position.set(p.x, 3.4, p.z);
      markers.add(ring, lab);
    });
    const R = B.rng(99);
    const runners = people.map((a) => {
      const r = route(a.x, a.z, fire);
      const ln = new T.Line(new T.BufferGeometry().setFromPoints(r.pts.map((p) => new T.Vector3(p.x, 0.15, p.z))), new T.LineDashedMaterial({ color: '#27c26a', dashSize: 1.2, gapSize: 0.8, depthTest: false, toneMapped: false }));
      ln.computeLineDistances(); ln.renderOrder = 8; lines.add(ln);
      return { a, path: r.pts.slice(1), exit: r.exit, ap: r.ap, delay: 5 + R() * 20, out: null, safe: null, snap: { x: a.x, z: a.z, head: a.head, i: a.i, wait: a.wait, state: a.state, t: a.t, status: a.status, path: a.path ? a.path.map((p) => Object.assign({}, p)) : a.path } };
    });
    drill = { fire, fx: makeFire(fire), runners, lines, markers, t: 0, mult: 1, wasRunning: S.st.running };
    S.st.running = false;
    EXITS.forEach((e) => (e.blocked = Math.hypot(e.x - fire.x, e.z - fire.z) < fire.r));
    S.addLog('Fire alarm: ' + fire.name + '. Everyone to the assembly points.', 'warn');
    document.getElementById('drTitle').textContent = tr('FIRE DRILL') + ' · ' + tr(fire.name);
    banner.hidden = false;
    B.tools.isOpen('drill') && (document.getElementById('drawerClose').click());
    B.ui.setView('top');
  }
  function end(silent) {
    if (!drill) return;
    W.scene.remove(drill.fx.g, drill.lines, drill.markers);
    drill.runners.forEach(({ a, snap }) => { Object.assign(a, snap); a.mesh.position.set(a.x, 0, a.z); });
    S.st.running = drill.wasRunning;
    EXITS.forEach((e) => { e.blocked = false; e.sign.material.emissiveIntensity = 0.9; });
    drill = null; banner.hidden = true;
    if (!silent) B.tools.open('drill');
  }
  function stepRunner(q, dt) {
    const a = q.a, u = a.mesh.userData;
    if (q.delay > 0) { q.delay -= dt; a.status = 'Heard the alarm'; return; }
    const p = q.path[0];
    if (!p) { if (q.safe == null) q.safe = drill.t; a.status = 'Safe at ' + q.ap.id; u.legL.rotation.x = u.legR.rotation.x = 0; return; }
    const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), st = WALK * dt;
    if (d <= st) { a.x = p.x; a.z = p.z; q.path.shift(); if (q.path.length === 1 && q.out == null) q.out = drill.t; }
    else { a.x += (dx / d) * st; a.z += (dz / d) * st; a.head = Math.atan2(dx, dz); }
    a.status = q.out == null ? 'Walking to exit ' + q.exit.id : 'Walking to ' + q.ap.id;
    a.phase = (a.phase || 0) + dt * WALK * 5.2;
    const sw = Math.sin(a.phase) * 0.55;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8;
    a.mesh.position.set(a.x, 0, a.z); a.mesh.rotation.y = a.head;
  }
  let flash = 0;
  B.hooks.frame.push((dt) => {
    if (!drill) return;
    const d = dt * drill.mult;
    if (!drill.finished) drill.t += d;
    animFire(drill.fx, performance.now() / 1000, dt);
    drill.runners.forEach((q) => stepRunner(q, d));
    B.actors.list.filter((x) => x.kind === 'drone').forEach((x) => { x.y = Math.max(x.padY, x.y - dt * 1.5); x.mesh.position.y = x.y; x.status = 'Landed: fire alarm'; });
    flash += dt;
    EXITS.forEach((e) => (e.sign.material.emissiveIntensity = e.blocked ? 0.1 : 0.6 + 0.6 * Math.abs(Math.sin(flash * 4))));
    const safe = drill.runners.filter((q) => q.safe != null).length, n = drill.runners.length;
    const mm = Math.floor(drill.t / 60), ss = Math.floor(drill.t % 60);
    document.getElementById('drInfo').textContent = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + ' · ' + safe + ' / ' + n + ' ' + tr('at the assembly points');
    if (safe === n && !drill.finished) {
      drill.finished = true;
      const lastOut = drill.runners.slice().sort((p, q) => q.out - p.out)[0];
      last = { fire: drill.fire.name, t: Math.max(...drill.runners.map((q) => q.out)), all: Math.max(...drill.runners.map((q) => q.safe)), lastName: lastOut.a.anon ? 'a worker' : lastOut.a.name, people: drill.runners.map((q) => ({ name: q.a.anon ? 'Worker' : q.a.name, exit: q.exit.id, out: q.out, ap: q.ap.id })), date: new Date() };
      last.scenario = scenario; history.push(last); saveHistory();
      S.addLog('Drill complete: building clear in ' + fmt(last.t, 0) + ' s', 'info');
      B.tools.toast('Building clear in ' + mmss(last.t) + '. Everyone at the assembly points.', 6000);
      setTimeout(() => end(), 1800);
    }
  });
  const mmss = (s) => Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0') + ' s';
  document.getElementById('drEnd').addEventListener('click', () => end());
  document.getElementById('drSpeed').addEventListener('click', (e) => { if (!drill) return; drill.mult = drill.mult === 1 ? 4 : 1; e.target.textContent = tr('Speed') + ' ' + drill.mult + 'x'; });

  function render(el) {
    const fire = FIRES[scenario], ex = expected(fire), worst = ex.reduce((m, q) => (q.t > m.t ? q : m), ex[0]);
    el.innerHTML = `<h4>Emergency drill</h4><p>Start a fire scenario: the alarm sounds, forklifts stop, exits near the fire are closed and every person walks the shortest safe route to the nearest assembly point. The timer shows how long the building takes to clear.</p>
      <label class="f">Scenario<select id="drSc">${Object.entries(FIRES).map(([k, f]) => '<option value="' + k + '"' + (k === scenario ? ' selected' : '') + '>' + f.name + '</option>').join('')}</select></label>
      <div class="btnrow"><button class="btn primary" id="drGo">Start the drill</button></div>
      <h4>Expected evacuation time</h4><p>Walking at ${WALK} m/s after 30 s to react to the alarm. Common site target: everyone out within 3 minutes.</p>
      <table><thead><tr><th>Area</th><th>Exit</th><th class="num">Time out</th></tr></thead><tbody>
      ${ex.map((q) => '<tr><td>' + P.esc(q.zone) + '</td><td class="code">' + q.exit + '</td><td class="num ' + (q.t > TARGET ? 'bad' : 'good') + '">' + mmss(q.t) + '</td></tr>').join('')}</tbody></table>
      <p>Closed by this fire: ${EXITS.filter((e) => Math.hypot(e.x - fire.x, e.z - fire.z) < fire.r).map((e) => e.id).join(', ') || 'none'}. Slowest area: <b>${P.esc(worst.zone)}</b>.</p>
      ${last ? `<h4>Last drill result</h4><div class="card"><b>Building clear in ${mmss(last.t)} ${last.t <= TARGET ? '· within target' : '· over the 3 minute target'}</b><p>${P.esc(last.fire)}. Everyone reached an assembly point after ${mmss(last.all)}. Last one out: ${P.esc(last.lastName)}.</p></div>
        <table><thead><tr><th>Person</th><th>Exit</th><th class="num">Out after</th></tr></thead><tbody>${last.people.map((p) => '<tr><td>' + P.esc(p.name) + '</td><td class="code">' + p.exit + '</td><td class="num">' + mmss(p.out) + '</td></tr>').join('')}</tbody></table>` : ''}
      ${history.length ? `<h4>Drill history · ${history.length} drills</h4><p>${trend()}</p><canvas id="drHist" width="840" height="260"></canvas>
        <table><thead><tr><th>Date</th><th>Scenario</th><th class="num">Building clear</th></tr></thead><tbody>${history.slice().reverse().slice(0, 10).map((h) => '<tr><td>' + new Date(h.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + '</td><td>' + P.esc(h.fire) + '</td><td class="num ' + (h.t > TARGET ? 'bad' : 'good') + '">' + mmss(h.t) + '</td></tr>').join('')}</tbody></table>
        <div class="btnrow"><button class="btn" id="drCsv">Export drill history (CSV)</button><button class="btn" id="drClear">Clear the history</button></div>` : ''}`;
    if (history.length) {
      histChart(el.querySelector('#drHist'));
      el.querySelector('#drCsv').addEventListener('click', () => B.tools.download('building100-drills.csv', ['Date,Scenario,Building clear (s),All at assembly points (s),Last out'].concat(history.map((h) => [new Date(h.date).toISOString().slice(0, 16).replace('T', ' '), '"' + h.fire + '"', Math.round(h.t), Math.round(h.all), '"' + h.lastName + '"'].join(','))).join('\n')));
      el.querySelector('#drClear').addEventListener('click', () => { history = []; last = null; saveHistory(); render(el); });
    }
    el.querySelector('#drSc').addEventListener('change', (e) => { scenario = e.target.value; render(el); });
    el.querySelector('#drGo').addEventListener('click', () => { document.getElementById('drawerClose').click(); start(); });
  }
  function trend() {
    if (history.length < 2) return 'Run more drills to see whether the evacuation is getting faster.';
    const a = history[0].t, b = history[history.length - 1].t, d = a - b;
    return Math.abs(d) < 3 ? 'Evacuation time is steady at about ' + mmss(b) + '.' : d > 0 ? 'Evacuation is ' + Math.round(d) + ' s faster than in the first drill.' : 'Evacuation is ' + Math.round(-d) + ' s slower than in the first drill: check the routes to the exits.';
  }
  function histChart(c) {
    const ctx = c.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const acc = cs.getPropertyValue('--accent-strong').trim(), muted = cs.getPropertyValue('--muted').trim(), bad = cs.getPropertyValue('--bad').trim();
    const pts = history.slice(-12), max = Math.max(TARGET * 1.2, ...pts.map((h) => h.t)), bw = 740 / Math.max(pts.length, 4);
    const Y = (v) => 220 - (v / max) * 190;
    ctx.clearRect(0, 0, c.width, c.height); ctx.font = '600 17px "IBM Plex Sans", sans-serif';
    ctx.strokeStyle = bad; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(60, Y(TARGET)); ctx.lineTo(810, Y(TARGET)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = bad; ctx.fillText(tr('3 min target'), 700, Y(TARGET) - 8);
    pts.forEach((h, i) => { const x = 70 + i * bw, y = Y(h.t); ctx.fillStyle = h.t > TARGET ? bad : acc; ctx.fillRect(x, y, bw * 0.6, 220 - y); ctx.fillStyle = muted; ctx.fillText(Math.round(h.t) + ' s', x, y - 6); ctx.fillText('#' + (history.length - pts.length + i + 1), x, 244); });
  }
  B.tools.add({ id: 'drill', label: 'Emergency', render });
  B.evac = { start, end, last: () => last, history: () => history, expected: () => expected(FIRES[scenario]), active: () => !!drill };
})();
