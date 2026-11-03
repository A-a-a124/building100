/* Building 19 - Spot the hazard: the floor freezes, five hazards are hidden in the scene, find them before the time runs out */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, A = B.actors;
  const { renderer, scene, camera, controls, stage } = B.three;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const LIMIT = 60, FIND = 5;
  const $ = (id) => document.getElementById(id);
  const CAM = [[-24, 5, -25.4], [12, 0.6, -26.6]];

  const person = (o) => A.makePerson(Object.assign({ height: 1.74, girth: 1, skin: '#a8754f', shirt: '#2a7fd4', pants: '#26303b' }, o));
  // each builder returns a group placed in the scene; the point is what the player has to click
  const HAZ = [
    { name: 'Worker without a helmet', why: 'Head protection is required everywhere on the floor.', at: [-5, 1.2, -25.2], make: () => { const g = person({ vest: true }); g.rotation.y = 0.8; return g; } },
    { name: 'Oil spill on the forklift lane', why: 'A skid risk for forklifts and people. Contain it and report it.', at: [6, 0.05, -27], make: () => { const g = new T.Group(), m = new T.MeshStandardMaterial({ color: '#0b0a08', roughness: 0.08, metalness: 0.6 }); [[0, 0, 1.3], [0.9, 0.5, 0.7], [-0.8, -0.4, 0.55]].forEach(([x, z, r]) => { const d = new T.Mesh(new T.CircleGeometry(r, 26), m); d.rotation.x = -Math.PI / 2; d.position.set(x, 0, z); g.add(d); }); return g; } },
    { name: 'Pallet left on the walkway', why: 'It forces people out into the forklift lane.', at: [14, 0.7, -25.2], make: () => W.makePallet(1) },
    { name: 'Forklift parked with the forks raised', why: 'Forks go fully down whenever a forklift is left.', at: [22, 1.8, -30.5], make: () => { const f = W.makeForklift('!'); f.userData.car.position.y = 2.3; f.userData.inner.scale.y = 3.2; f.userData.inner.position.y = 2.3; f.rotation.y = 0.3; return f; } },
    { name: 'Phone in use on the forklift lane', why: 'No phones while walking on the floor. Eyes on the traffic.', at: [11, 1.2, -27.4], make: () => { const g = person({ vest: true, hat: 'helmet' }), u = g.userData; u.armR.rotation.x = -1.75; u.elbowR.rotation.x = -1.65; const ph = new T.Mesh(new T.BoxGeometry(0.05, 0.1, 0.012), W.mat('#0d1014')); ph.position.set(0, -0.32 * u.s, 0.05); u.elbowR.add(ph); g.rotation.y = -2.2; return g; } },
    { name: 'Loose cable across the walkway', why: 'A trip hazard. Cables run overhead or in covers.', at: [1, 0.08, -25], make: () => { const g = new T.Group(), c = new T.CatmullRomCurve3([[-2.4, 0.03, -1.3], [-1, 0.03, -0.4], [0.2, 0.03, -0.5], [0.8, 0.03, 0.7], [2.2, 0.03, 1.2]].map((p) => new T.Vector3(...p))); g.add(new T.Mesh(new T.TubeGeometry(c, 40, 0.035, 8), new T.MeshStandardMaterial({ color: '#ff7a00', roughness: 0.5 }))); return g; } },
    { name: 'Unstable leaning pallet stack', why: 'Stacks must be square and within the height limit.', at: [-12, 1.6, -27], make: () => { const g = new T.Group(); [0, 1, 2].forEach((k) => { const p = W.makePallet(3); p.position.set(k * 0.14, k * 1.05, k * 0.05); p.rotation.z = -k * 0.07; p.rotation.y = k * 0.2; g.add(p); }); return g; } },
    { name: 'Person walking under a raised load', why: 'Nobody stands or walks under raised forks.', at: [27, 1.2, -27.2], make: () => { const g = new T.Group(), f = W.makeForklift('!'); f.userData.car.position.y = 2.2; f.userData.inner.scale.y = 3.1; f.userData.inner.position.y = 2.2; const p = W.makePallet(2); p.position.set(0, 0.06, -0.62); f.userData.car.add(p); f.rotation.y = Math.PI / 2; f.position.set(2, 0, 0); const q = person({ vest: true, hat: 'helmet' }); q.position.set(0.3, 0, 0); q.rotation.y = 1.2; g.add(f, q); return g; } },
  ];

  const hud = document.createElement('div'); hud.className = 'hzhud'; hud.hidden = true; stage.appendChild(hud);
  const css = document.createElement('style');
  css.textContent = `.hzhud { position: absolute; z-index: 8; left: 50%; top: 12px; transform: translateX(-50%); display: grid; gap: 6px; background: rgba(9,14,20,0.94); color: #fff; padding: 10px 16px; border-radius: 12px; min-width: min(520px, calc(100% - 24px)); box-shadow: var(--shadow); font-size: 13px; }
    .hzTop { display: flex; align-items: center; gap: 12px; } .hzTop b { font: 700 15px var(--f-display); } .hzTop span { margin-left: auto; font: 700 20px var(--f-mono); } .hzDots { display: flex; gap: 5px; } .hzDots i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #ffffff66; display: inline-block; } .hzDots i.ok { background: #2fbf5a; border-color: #2fbf5a; } .hzhud .btn { background: rgba(255,255,255,0.14); color: #fff; border-color: transparent; } .hzhud .btn.primary { background: var(--accent-strong); color: var(--accent-ink); } .hzList { display: grid; gap: 3px; font-size: 12px; color: #c9d4dd; } .hzList b { color: #fff; }`;
  document.head.appendChild(css);

  const ringG = new T.RingGeometry(0.9, 1.1, 40);
  function ring(p, color) {
    const m = new T.Mesh(ringG, new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: T.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false }));
    m.position.set(p[0], p[1], p[2]); m.renderOrder = 12; scene.add(m); return m;
  }
  let g = null;
  const V = new T.Vector3();
  function start() {
    if (g) return;
    const d = document.querySelector('.drawer'); if (d && !d.hidden) $('drawerClose').click();
    const pick = HAZ.slice().sort(() => Math.random() - 0.5).slice(0, FIND);
    g = { list: pick.map((h) => { const m = h.make(); m.position.set(h.at[0], m.position.y, h.at[2]); if (h.at[1] < 0.2) m.position.y = 0.04; scene.add(m); return { h, m, found: false, ring: null }; }), t: LIMIT, wrong: 0, marks: [], was: S.st.running, labels: W.labels.visible, finished: false };
    S.st.running = false; W.labels.visible = false; A.showTags(false); controls.enabled = false;
    B.ui.flyTo(CAM[0], CAM[1], 1.4);
    hud.hidden = false; paint();
    renderer.domElement.addEventListener('pointerup', click);
  }
  function paint() {
    if (!g) return;
    if (g.finished) return;
    hud.innerHTML = '<div class="hzTop"><b>Spot the hazard</b><div class="hzDots">' + g.list.map((q) => '<i class="' + (q.found ? 'ok' : '') + '"></i>').join('') + '</div><span id="hzT">' + Math.ceil(g.t) + '</span></div><div>Five safety hazards are hidden in this picture. Click each one.' + (g.last ? ' <b>' + g.last + '</b>' : '') + '</div><div class="btnrow"><button class="btn" id="hzStop">Give up</button></div>';
    $('hzStop').addEventListener('click', () => finish());
  }
  function click(e) {
    if (!g || g.finished) return;
    const r = renderer.domElement.getBoundingClientRect(); let best = null, bd = 62;
    g.list.forEach((q) => {
      if (q.found) return;
      V.set(q.h.at[0], q.h.at[1], q.h.at[2]).project(camera);
      const d = Math.hypot(((V.x + 1) / 2) * r.width + r.left - e.clientX, ((1 - V.y) / 2) * r.height + r.top - e.clientY);
      if (d < bd) { bd = d; best = q; }
    });
    if (best) mark(best);
    else { g.wrong++; g.t = Math.max(0, g.t - 2); g.last = 'Nothing there: 2 seconds lost.'; if (B.sound) B.sound.bad(); paint(); }
  }
  function mark(q) {
    q.found = true; q.ring = ring([q.h.at[0], 0.1, q.h.at[2]], '#2fbf5a'); q.ring.rotation.x = -Math.PI / 2; q.ring.scale.setScalar(1.6);
    g.last = q.h.name + '.'; if (B.sound) B.sound.ok();
    if (g.list.every((o) => o.found)) finish(); else paint();
  }
  function finish() {
    if (!g || g.finished) return;
    g.finished = true;
    const found = g.list.filter((q) => q.found).length, score = Math.max(0, found * 15 + Math.round(g.t / 3) - g.wrong * 2), best = Math.max(+store.get('b100.hazBest') || 0, score);
    store.set('b100.hazBest', best); g.score = score;
    g.list.forEach((q) => { if (!q.found) { q.ring = ring([q.h.at[0], 0.1, q.h.at[2]], '#ff3b30'); q.ring.rotation.x = -Math.PI / 2; q.ring.scale.setScalar(1.6); } });
    hud.innerHTML = '<div class="hzTop"><b>You found ' + found + ' of ' + FIND + '</b><span>' + score + ' pts</span></div><div class="hzList">' + g.list.map((q) => '<div><b style="color:' + (q.found ? '#62e08a' : '#ff8a7a') + '">' + (q.found ? 'Found: ' : 'Missed: ') + q.h.name + '.</b> ' + q.h.why + '</div>').join('') + '</div><small>Best on this device: ' + best + ' pts</small><div class="btnrow"><button class="btn primary" id="hzAgain">New round</button><button class="btn" id="hzEnd">Back to the twin</button></div>';
    $('hzAgain').addEventListener('click', () => { end(); start(); });
    $('hzEnd').addEventListener('click', end);
  }
  function end() {
    if (!g) return;
    g.list.forEach((q) => { scene.remove(q.m); if (q.ring) scene.remove(q.ring); });
    S.st.running = g.was; W.labels.visible = g.labels; A.showTags(true); controls.enabled = true;
    renderer.domElement.removeEventListener('pointerup', click);
    hud.hidden = true; g = null;
    B.ui.setView('overview');
  }
  B.hooks.frame.push((dt) => {
    if (!g || g.finished) return;
    g.t -= dt;
    const e = $('hzT'); if (e) e.textContent = Math.max(0, Math.ceil(g.t));
    if (g.t <= 0) finish();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && g) end(); });
  function render(el) {
    el.innerHTML = `<h4>Spot the hazard</h4><p>The floor freezes and five hazards hide in the scene: a missing helmet, an oil spill, a raised fork. You have ${LIMIT} seconds. Every missed one is explained at the end. Built for toolbox talks and new starters.</p>
      <div class="row2"><div class="stat"><b>${HAZ.length}</b><small>hazards in the pool, ${FIND} per round</small></div><div class="stat"><b>${store.get('b100.hazBest') || '-'}</b><small>best score on this device</small></div></div>
      <div class="btnrow"><button class="btn primary" id="hzGo">Start a round</button></div>`;
    el.querySelector('#hzGo').addEventListener('click', start);
  }
  B.tools.add({ id: 'spot', label: 'Spot the hazard', render });
  B.hazard = { start, end, finish, state: () => g, mark: (i) => g && mark(g.list[i]), HAZ };
})();
