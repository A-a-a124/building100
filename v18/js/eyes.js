/* Building 19 - through their eyes: ride along with any worker or forklift driver, with their day in numbers and what delays them */
(function () {
  const B = window.B100, S = B.sim, T = THREE, A = B.actors, P = B.panel;
  const { renderer, camera, controls, stage } = B.three;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const $ = (id) => document.getElementById(id);

  // ---------- each person's and driver's day, from the simulation ----------
  const stats = new Map();
  const stat = (o) => { if (!stats.has(o)) stats.set(o, { dist: 0, moving: 0, handling: 0, waiting: 0, crossing: 0, talking: 0, resting: 0, idle: 0, lx: o.x, lz: o.z }); return stats.get(o); };
  const CAT_P = [[/crossing/i, 'crossing'], [/Talking|Checking in/, 'talking'], [/break|rest area|Returning to work/i, 'resting'], [/Picking|Setting|Making coffee|computer/, 'handling']];
  const CAT_F = { toPick: 'moving', toDrop: 'moving', home: 'moving', pick: 'handling', drop: 'handling', idle: 'idle', charging: 'resting', inspect: 'handling', down: 'waiting' };
  let lastT = S.st.t;
  B.hooks.frame.push(() => {
    const dt = S.st.t - lastT; lastT = S.st.t;
    if (dt <= 0 || !S.st.running) return;
    A.list.forEach((a) => {
      if (a.kind !== 'person') return;
      const q = stat(a), d = Math.hypot(a.x - q.lx, a.z - q.lz); q.dist += d < 8 ? d : 0; q.lx = a.x; q.lz = a.z;
      const c = CAT_P.find(([r]) => r.test(a.status || ''));
      q[c ? c[1] : d > 0.001 ? 'moving' : 'waiting'] += dt;
    });
    S.forklifts.forEach((f) => {
      const q = stat(f);
      if (f.yieldWhy) q.waiting += dt; else if (f.down) q.waiting += dt; else q[CAT_F[f.phase] || 'idle'] += dt;
      q.dist = f.dist || 0;
    });
  });
  const LABELS = { moving: 'Moving', handling: 'Handling and paperwork', waiting: 'Waiting or giving way', crossing: 'Waiting at crossings', talking: 'Talking with the supervisor', resting: 'Rest and charging', idle: 'No task' };

  // ---------- the ride-along ----------
  const hud = document.createElement('div'); hud.className = 'eyehud'; hud.hidden = true; stage.appendChild(hud);
  const css = document.createElement('style');
  css.textContent = `.eyehud { position: absolute; z-index: 8; left: 14px; bottom: 14px; width: min(340px, calc(100% - 28px)); background: rgb(14,20,28); color: #e8eef3; border-radius: 12px; padding: 10px 14px; display: grid; gap: 6px; font-size: 13px; box-shadow: var(--shadow); } .eyehud h4 { margin: 0; font: 700 16px var(--f-display); color: #fff; } .eyehud small { color: #9fb1bf; } .eyeG { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; } .eyeG div b { display: block; font: 700 16px var(--f-mono); color: #fff; } .eyeG div { font-size: 11px; color: #9fb1bf; } .eyeBar { display: grid; grid-template-columns: minmax(0, 1fr) 38px; gap: 6px; font-size: 11px; align-items: center; } .eyeBar i { display: block; height: 4px; background: rgba(255,255,255,0.12); border-radius: 2px; overflow: hidden; margin-top: 2px; } .eyeBar u { display: block; height: 100%; background: #58d0ff; } .eyeBar span:last-child { text-align: right; font-family: var(--f-mono); } .eyehud .btn { background: rgba(255,255,255,0.14); color: #fff; border-color: transparent; }
  .eyeList { display: grid; gap: 6px; } .eyeList button { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; padding: 8px 10px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); border-radius: 8px; text-align: left; font-size: 13px; font-weight: 600; cursor: pointer; } .eyeList button small { font-weight: 400; color: var(--muted); font-family: var(--f-mono); } .eyeList button:hover { border-color: var(--accent-strong); }`;
  document.head.appendChild(css);

  let cur = null, yaw = 0, pitch = 0, drag = false, lastX = 0, lastY = 0, t = 0, was = null;
  const eye = new T.Vector3(), fw = new T.Vector3(), tgt = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const isF = (o) => !!o.mesh && o.n != null;
  const nameOf = (o) => (isF(o) ? 'Forklift ' + o.n + ' driver' : o.anon ? 'Warehouse worker' : o.name);
  function enter(o) {
    if (cur) leave(true);
    if (B.drive && B.drive.active) return;
    const d = document.querySelector('.drawer'); if (d && !d.hidden) $('drawerClose').click();
    was = { fov: camera.fov, near: camera.near, maxPolar: controls.maxPolarAngle, min: controls.minDistance };
    cur = o; yaw = 0; pitch = -0.04;
    controls.enabled = false; controls.minDistance = 0.1; B.ui.followObj(null); B.ui.stopFollow();
    camera.fov = 66; camera.near = 0.12; camera.updateProjectionMatrix();
    if (isF(o)) { if (o.mesh.userData.op) o.mesh.userData.op.visible = false; } else o.mesh.visible = false;
    place(1); hud.hidden = false; paint();
  }
  function leave(keep) {
    if (!cur) return;
    if (isF(cur)) { if (cur.mesh.userData.op) cur.mesh.userData.op.visible = true; } else cur.mesh.visible = true;
    cur = null; hud.hidden = true;
    camera.fov = was.fov; camera.near = was.near; camera.updateProjectionMatrix();
    controls.enabled = true; controls.minDistance = was.min;
    if (!keep) B.ui.setView('overview');
  }
  function place(k) {
    const o = cur;
    if (isF(o)) { eye.set(0, 2.1, 0.32).applyMatrix4(o.mesh.matrixWorld); const h = o.mesh.rotation.y + Math.PI; fw.set(Math.sin(h), 0, Math.cos(h)); }
    else { const s = o.mesh.userData.s || 1; const h = o.mesh.rotation.y; fw.set(Math.sin(h), 0, Math.cos(h)); eye.set(o.mesh.position.x, Math.max(0.9, o.mesh.position.y + 1.62 * s), o.mesh.position.z).addScaledVector(fw, 0.12); }
    fw.applyAxisAngle(up, yaw);
    const cp = Math.cos(pitch);
    tgt.set(eye.x + fw.x * 3 * cp, eye.y + Math.sin(pitch) * 3, eye.z + fw.z * 3 * cp);
    camera.position.lerp(eye, k);
    controls.target.lerp(tgt, k);
    camera.lookAt(controls.target);
  }
  function paint() {
    const o = cur; if (!o) return;
    const q = stat(o), tot = Math.max(1, q.moving + q.handling + q.waiting + q.crossing + q.talking + q.resting + q.idle);
    const rows = Object.keys(LABELS).filter((k) => q[k] > 0).sort((a, b) => q[b] - q[a]).slice(0, 5);
    const delay = ['waiting', 'crossing', 'talking', 'idle'].filter((k) => q[k] > 0).sort((a, b) => q[b] - q[a])[0];
    const stNow = isF(o) ? S.describeForklift(o.n).status : o.status;
    hud.innerHTML = '<h4>' + P.esc(nameOf(o)) + '</h4><small>' + P.esc(stNow || '') + '</small><div class="eyeG"><div><b>' + fmt(q.dist / 1000, 2) + ' km</b>' + (isF(o) ? 'driven today' : 'walked today') + '</div><div><b>' + (isF(o) ? Math.round(S.describeForklift(o.n).util * 100) + '%' : fmt(o.trips || 0)) + '</b>' + (isF(o) ? 'utilisation' : 'cartons moved') + '</div></div>' +
      rows.map((k) => { const pc = (q[k] / tot) * 100; return '<div class="eyeBar"><div>' + LABELS[k] + '<i><u style="width:' + pc + '%"></u></i></div><span>' + fmt(pc, 0) + '%</span></div>'; }).join('') +
      (delay ? '<small>Biggest delay so far: ' + LABELS[delay].toLowerCase() + ', ' + fmt(q[delay] / 60, 0) + ' min.</small>' : '') + '<div class="btnrow"><button class="btn" id="eyeNext">Next person</button><button class="btn" id="eyeX">Exit</button></div><small>Drag to look around. Esc to exit.</small>';
    $('eyeX').addEventListener('click', () => leave());
    $('eyeNext').addEventListener('click', next);
  }
  const everyone = () => A.list.filter((a) => a.kind === 'person').concat(S.forklifts);
  function next() { const l = everyone(), i = l.indexOf(cur); enter(l[(i + 1) % l.length]); }
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { if (cur) { drag = true; lastX = e.clientX; lastY = e.clientY; } });
  addEventListener('pointerup', () => (drag = false));
  addEventListener('pointermove', (e) => { if (cur && drag) { yaw -= (e.clientX - lastX) * 0.004; pitch = Math.max(-1, Math.min(0.9, pitch - (e.clientY - lastY) * 0.003)); lastX = e.clientX; lastY = e.clientY; } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cur) leave(); });
  B.hooks.frame.push((dt) => { if (!cur) return; place(Math.min(1, dt * 7)); if ((t += dt) > 1) { t = 0; if (!hud.matches(':hover')) paint(); } });

  // buttons on the people and forklift cards
  const addBtn = (id) => { const c = document.querySelector('#details .card'); if (c) { c.insertAdjacentHTML('beforeend', '<button class="btn" id="eyeCard" style="margin-top:6px">See through their eyes</button>'); $('eyeCard').addEventListener('click', id); } };
  const showA = P.showActor;
  P.showActor = function (a) { showA(a); if (a.kind === 'person') addBtn(() => enter(a)); };
  const showF = P.showForklift;
  P.showForklift = function (n) { showF(n); const f = S.forklifts.find((q) => q.n === n); if (f) addBtn(() => enter(f)); };

  function render(root) {
    root.innerHTML = '<h4>Through their eyes</h4><p>Ride along with a worker or a forklift driver: see the floor from where they stand, how far they went today and what holds them up.</p><div class="eyeList">' +
      everyone().map((o, i) => { const q = stat(o); return '<button data-i="' + i + '"><span>' + P.esc(nameOf(o)) + '</span><small>' + fmt(q.dist / 1000, 2) + ' km</small></button>'; }).join('') + '</div>';
    root.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => enter(everyone()[+b.dataset.i])));
  }
  B.tools.add({ id: 'eyes', label: 'Through their eyes', render });
  B.eyes = { enter, leave, active: () => !!cur, stats: stat, cur: () => cur };
})();
