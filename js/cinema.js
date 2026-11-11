/* Building 19 - cinema: a director's camera that plays shot after shot (crane, chase, dolly, drone) with captions that quote the live numbers */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, A = B.actors;
  const { camera, controls, stage } = B.three;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const RACK = B.RACK;
  const $ = (id) => document.getElementById(id);
  const ease = (k) => k * k * (3 - 2 * k);
  const P = new T.Vector3(), L = new T.Vector3(), look = new T.Vector3(), a3 = new T.Vector3(), b3 = new T.Vector3();
  // a straight move from one camera position to another, looking at one point
  const move = (p0, p1, l0, l1) => (k) => { P.fromArray(p0).lerp(a3.fromArray(p1), ease(k)); L.fromArray(l0).lerp(b3.fromArray(l1 || l0), ease(k)); return true; };
  const moving = (f) => f.task && f.path && f.path.length && !f.down;
  const people = () => A.list.filter((a) => a.kind === 'person').length;

  const SHOTS = [
    { title: 'Building 19', dur: 11, start: () => move([-300, 170, 360], [-96, 50, 128], [10, 4, 0]),
      line: () => fmt(S.occ) + ' pallets in ' + fmt(B.SLOTS.length) + ' positions · ' + S.forklifts.length + ' forklifts · ' + people() + ' people on the floor' },
    { title: 'Receiving', dur: 9, start: () => move([-80, 4.5, -66], [-30, 7, -62], [-48, 3, -40]),
      line: () => { const n = S.trucks.filter((t) => t.dir === 'in').length, g = (S.gate || []).length; return n + ' of 4 receiving doors have a truck' + (g ? ' · ' + g + ' waiting at the gate' : '') + ' · ' + fmt(S.st.received) + ' pallets put away'; } },
    { title: () => 'Forklift ' + cur.f.n, dur: 12, soft: true,
      start() { cur.f = S.forklifts.find(moving) || S.forklifts.find((f) => !f.down) || S.forklifts[0]; return () => { const m = cur.f.mesh, h = m.rotation.y, fx = -Math.sin(h), fz = -Math.cos(h); P.set(m.position.x - fx * 7.5 + fz * 1.6, 3.5, m.position.z - fz * 7.5 - fx * 1.6); L.set(m.position.x + fx * 3, 1.5, m.position.z + fz * 3); return true; }; },
      line: () => { const d = S.describeForklift(cur.f.n); return d.status + (d.detail ? ' · ' + d.detail : '') + ' · ' + fmt((cur.f.dist || 0) / 1000, 1) + ' km today'; } },
    { title: 'Inside the aisles', dur: 10,
      start() { const row = RACK.rows[5], x0 = RACK.x0, x1 = RACK.x0 + RACK.bays * RACK.bayW; cur.row = 5; return move([x0 - 7, 2.1, row.access], [x0 + (x1 - x0) * 0.62, 2.7, row.access], [x0 + 12, 3.4, row.access], [x1 + 6, 3, row.access]); },
      line: () => { const n = B.SLOTS.filter((s) => s.row === cur.row && s.item >= 0).length, tot = RACK.bays * RACK.levels * 2; return 'Row ' + RACK.rows[cur.row].letter + ' is ' + fmt((n / tot) * 100, 0) + '% full · every pallet has a material number, a quantity and an age'; } },
    { title: 'People and forklifts share the floor', dur: 9, soft: true,
      start() { const l = A.list.filter((a) => a.route && !a.brk); cur.a = l[Math.floor(Math.random() * l.length)] || A.list[0]; return () => { const m = cur.a.mesh; P.set(m.position.x + 4.4, 2, m.position.z + 3.6); L.set(m.position.x, 1.15, m.position.z); return true; }; },
      line: () => (cur.a.anon ? 'Warehouse worker' : cur.a.name) + ' · ' + cur.a.status + ' · forklifts stopped or gave way ' + fmt(S.st.yields || 0) + ' times today' },
    { title: () => cur.d.name, dur: 9, soft: true,
      start() { cur.d = A.list.filter((a) => a.kind === 'drone').find((d) => d.y > d.padY + 1.5); if (!cur.d) return null; return () => { P.set(cur.d.x - 2.6, cur.d.y + 1, cur.d.z + 3); L.set(cur.d.x, cur.d.y - 0.2, cur.d.z); return true; }; },
      line: () => cur.d.status + ' · ' + fmt(Math.floor(cur.d.scans)) + (cur.d.indoor ? ' pallets counted this shift' : ' items surveyed this shift') },
    { title: 'From afternoon to night', dur: 13, start: () => { const m = move([-175, 44, 196], [-128, 30, 150], [10, 8, 0]); return (k) => { B.env.setLight(15.5 + k * 7.6); return m(k); }; }, end: () => B.env.setLight(null),
      line: () => 'The sun, the sky and the lamps follow the clock · the same twin shows any hour of any shift' },
    { title: 'Shipping', dur: 9, start: () => move([44, 5.5, 60], [-4, 8, 64], [6, 2.5, 40]),
      line: () => { const k = S.kpis(); return fmt(S.st.shipped) + ' pallets shipped · ' + S.orders.length + ' orders being picked' + (k.cycle ? ' · average order takes ' + fmt(k.cycle, 0) + ' min' : ''); } },
    { title: 'The whole floor, live', dur: 10, start: () => (k) => { const a = -0.9 + k * 0.7; P.set(Math.sin(a) * 74, 96, Math.cos(a) * 74 + 4); L.set(2, 0, 2); return true; },
      line: () => { const k = S.kpis(); return 'Rack ' + fmt(k.occ * 100, 1) + '% full · forklifts busy ' + fmt(k.util * 100, 0) + '% · ' + k.open + ' open tasks · ' + (S.st.nearMiss || 0) + ' near misses'; } },
  ];

  const ui = document.createElement('div');
  ui.className = 'cinemaUI'; ui.hidden = true;
  ui.innerHTML = '<div class="cnBar cnTop"></div><div class="cnBar cnBot"><div class="cnCap"><b id="cnTitle"></b><span id="cnLine"></span></div><div class="cnBtns"><button id="cnNext">Next shot</button><button id="cnExit">Exit</button></div></div><div class="cnFade" id="cnFade"></div>';
  document.body.appendChild(ui);
  const css = document.createElement('style');
  css.textContent = `.cinemaUI { position: fixed; inset: 0; z-index: 60; pointer-events: none; } .cnBar { position: absolute; left: 0; right: 0; height: 10.5vh; background: #000; transition: transform 0.9s ease; } .cnTop { top: 0; transform: translateY(-100%); } .cnBot { bottom: 0; transform: translateY(100%); display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 4vw; }
    .cinemaUI.in .cnTop, .cinemaUI.in .cnBot { transform: none; } .cnCap { display: grid; gap: 3px; color: #fff; min-width: 0; transition: opacity 0.4s; } .cnCap b { font: 700 clamp(15px, 2.1vh, 22px) var(--f-display, sans-serif); letter-spacing: 0.02em; } .cnCap span { font: 500 clamp(12px, 1.6vh, 15px) var(--f-body, sans-serif); color: #c9d1d8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cnBtns { display: flex; gap: 8px; pointer-events: auto; opacity: 0; transition: opacity 0.4s; } .cinemaUI.hot .cnBtns { opacity: 1; } .cnBtns button { background: rgba(255,255,255,0.14); color: #fff; border: 0; border-radius: 8px; padding: 8px 14px; font: 600 13px var(--f-body, sans-serif); cursor: pointer; white-space: nowrap; } .cnBtns button:hover { background: rgba(255,255,255,0.26); }
    .cnFade { position: absolute; inset: 0; background: #000; opacity: 0; transition: opacity 0.35s; } .cnFade.on { opacity: 1; } body.cinema .vig, body.cinema .toast { display: none !important; }`;
  document.head.appendChild(css);

  const cur = {};
  let on = false, i = -1, t = 0, upd = null, was = null, capT = 0, cutting = false, hotT = 0, first = true;
  const title = (s) => (typeof s.title === 'function' ? s.title() : s.title);
  function begin(k) {
    if (i >= 0 && SHOTS[i].end) SHOTS[i].end();
    for (let tries = 0; tries < SHOTS.length; tries++) { i = (k + tries + SHOTS.length) % SHOTS.length; upd = SHOTS[i].start(); if (upd) break; }
    t = 0; first = true; capT = 9;
  }
  function cut(k) {
    if (cutting || !on) return;
    cutting = true; $('cnFade').classList.add('on'); document.querySelector('.cnCap').style.opacity = 0;
    setTimeout(() => { if (!on) return; begin(k); setTimeout(() => { $('cnFade').classList.remove('on'); document.querySelector('.cnCap').style.opacity = 1; cutting = false; }, 120); }, 380);
  }
  function start() {
    if (on) return;
    const d = document.querySelector('.drawer'); if (d && !d.hidden) $('drawerClose').click();
    if (B.walk && B.walk.active || (B.drive && B.drive.active) || (B.eyes && B.eyes.active())) return B.tools.toast('Leave the current mode first, then start Cinema.');
    on = true; was = { speed: S.st.speed, running: S.st.running, pos: camera.position.clone(), tgt: controls.target.clone(), labels: W.labels.visible, fov: camera.fov };
    S.st.running = true; S.st.speed = Math.min(was.speed, 2); // close to real time, so machines move at a believable pace
    B.ui.followObj(null); controls.enabled = false; W.labels.visible = false; A.showTags(false);
    camera.fov = 36; camera.updateProjectionMatrix();
    document.body.classList.add('cine', 'cinema');
    ui.hidden = false; requestAnimationFrame(() => ui.classList.add('in'));
    look.copy(controls.target); i = -1; begin(0);
  }
  function stop() {
    if (!on) return;
    on = false; cutting = false;
    if (i >= 0 && SHOTS[i].end) SHOTS[i].end();
    B.env.setLight(null);
    S.st.speed = was.speed; S.st.running = was.running; W.labels.visible = was.labels; A.showTags(true);
    camera.fov = was.fov; camera.updateProjectionMatrix();
    camera.position.copy(was.pos); controls.target.copy(was.tgt); controls.enabled = true;
    document.body.classList.remove('cine', 'cinema');
    ui.classList.remove('in', 'hot'); $('cnFade').classList.remove('on'); ui.hidden = true;
  }
  B.hooks.frame.push((dt) => {
    if (!on) return;
    const s = SHOTS[i];
    if (!cutting) t += dt;
    upd(Math.min(1, t / s.dur), dt);
    // moves along a path are exact; shots that follow something glide after it, with a slight hand-held drift
    const k = first || !s.soft ? 1 : 1 - Math.exp(-dt * 3.2);
    if (s.soft) { const w = performance.now() / 1000; L.x += Math.sin(w * 0.9) * 0.05; L.y += Math.sin(w * 1.3) * 0.035; }
    camera.position.lerp(P, k); look.lerp(L, first ? 1 : s.soft ? 1 - Math.exp(-dt * 5) : 1);
    camera.lookAt(look); controls.target.copy(look); first = false;
    if ((capT += dt) > 1 && !cutting) { capT = 0; $('cnTitle').textContent = title(s); $('cnLine').textContent = s.line(); }
    if (t >= s.dur - 0.38 && !cutting) cut(i + 1);
    if (hotT > 0 && (hotT -= dt) <= 0) ui.classList.remove('hot');
  });
  addEventListener('pointermove', () => { if (on) { hotT = 2.5; ui.classList.add('hot'); } });
  $('cnNext').addEventListener('click', () => cut(i + 1));
  $('cnExit').addEventListener('click', stop);
  document.addEventListener('keydown', (e) => { if (!on) return; if (e.key === 'Escape') stop(); else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); cut(i + 1); } });
  $('views').insertAdjacentHTML('beforeend', '<button class="vbtn" id="vCinema" title="Sit back: the camera plays the warehouse shot by shot">Cinema</button>');
  $('vCinema').addEventListener('click', start);
  B.cinema = { start, stop, next: () => cut(i + 1), active: () => on, shot: () => i, shots: SHOTS, jump: (k) => begin(k) };
})();
