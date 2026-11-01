/* Building 100 - time machine: the twin records itself, so you can scrub back to any moment of the last hours and see what led to it */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE;
  const STEP = 5, MAX = 2880; // a sample every 5 simulated seconds, up to 4 hours
  const samples = [], events = [], slotLog = [];
  let lastS = -1e9, mode = null;

  const addLog = S.addLog;
  S.addLog = (m, k) => { if (/^Near miss|broke down|Fire alarm|Pick error/.test(m)) events.push({ t: S.st.t, m, kind: /^Near miss/.test(m) ? 'near' : 'other' }); if (events.length > 300) events.shift(); addLog(m, k); };
  // pallet changes, so the racks can be shown as they were
  const update = W.updateSlot;
  const prev = B.SLOTS.map((s) => s.item);
  W.updateSlot = function (s, n) { if (!mode && prev[s.i] !== s.item) { slotLog.push({ t: S.st.t, i: s.i, from: prev[s.i], to: s.item }); prev[s.i] = s.item; if (slotLog.length > 6000) slotLog.shift(); } update(s, n); };

  function capture() {
    samples.push({
      t: S.st.t, k: S.kpis(),
      fl: S.forklifts.map((f) => ({ f, x: f.x, z: f.z, h: f.head, y: f.carY })),
      tr: S.trucks.map((q) => ({ q, z: q.z })),
      ac: B.actors.list.map((a) => ({ a, x: a.x, z: a.z, y: a.y, h: a.head })),
    });
    if (samples.length > MAX) samples.shift();
  }
  B.hooks.frame.push(() => { if (!mode && S.st.t - lastS >= STEP) { lastS = S.st.t; capture(); } });

  const bar = document.createElement('div');
  bar.className = 'tmbar'; bar.hidden = true;
  bar.innerHTML = '<div class="tmTop"><b>Time machine</b><span id="tmClock"></span><span id="tmKpi"></span><div class="btnrow"><button class="btn" id="tmPlay">Play</button><button class="btn primary" id="tmLive">Back to live</button></div></div><div class="tmTrack"><input type="range" id="tmS" min="0" max="1000" value="1000"><div id="tmMarks"></div></div><small id="tmMsg"></small>';
  B.three.stage.appendChild(bar);
  const css = document.createElement('style');
  css.textContent = `.tmbar { position: absolute; z-index: 6; left: 12px; right: 12px; bottom: 12px; background: rgba(10,18,26,0.9); color: #fff; border-radius: 12px; padding: 10px 14px; display: grid; gap: 4px; box-shadow: var(--shadow); }
    .tmTop { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; } .tmTop b { font: 700 14px var(--f-display); color: #7fe0ff; } .tmTop span { font: 600 13px var(--f-mono); } .tmTop .btnrow { margin-left: auto; } .tmbar .btn:not(.primary) { background: rgba(255,255,255,0.14); color: #fff; border-color: transparent; }
    .tmTrack { position: relative; padding-top: 10px; } .tmTrack input { width: 100%; } #tmMarks { position: absolute; left: 0; right: 0; top: 0; height: 10px; } #tmMarks i { position: absolute; top: 0; width: 3px; height: 10px; background: #ff5a3c; cursor: pointer; border-radius: 1px; } #tmMarks i.o { background: #f2b31b; } .tmbar small { color: #c9d1d8; min-height: 16px; } body.cine .tmbar { display: none; }`;
  document.head.appendChild(css);
  const $ = (id) => document.getElementById(id);

  function apply(idx) {
    const s = samples[Math.max(0, Math.min(samples.length - 1, idx))]; if (!s) return;
    s.fl.forEach(({ f, x, z, h, y }) => { f.mesh.position.set(x, 0, z); f.mesh.rotation.y = h; f.mesh.userData.car.position.y = y; });
    // trucks: show those present then, hide the others
    const here = new Set(s.tr.map((o) => o.q));
    mode.allTrucks.forEach((q) => { const on = here.has(q); if (on && !q.mesh.parent) W.scene.add(q.mesh); q.mesh.visible = on; });
    s.tr.forEach(({ q, z }) => { q.mesh.position.z = z; });
    s.ac.forEach(({ a, x, z, y, h }) => { a.mesh.position.set(x, a.kind === 'drone' ? y : 0, z); a.mesh.rotation.y = h; });
    // racks as they were at that time
    const want = new Map();
    for (let i = slotLog.length - 1; i >= 0 && slotLog[i].t > s.t; i--) want.set(slotLog[i].i, slotLog[i].from);
    const showN = new Set([...want.keys(), ...mode.shown]);
    showN.forEach((i) => { const sl = B.SLOTS[i], v = want.has(i) ? want.get(i) : mode.live[i]; sl.item = v; update(sl, true); });
    mode.shown = new Set(want.keys());
    W.flagPallets();
    $('tmClock').textContent = S.clock(s.t) + ' · ' + fmt((S.st.t - s.t) / 60) + ' min ago';
    $('tmKpi').textContent = 'Open tasks ' + s.k.open + ' · Forklifts busy ' + Math.round(s.k.util * 100) + '% · Rack ' + (s.k.occ * 100).toFixed(1) + '%';
    const near = events.filter((e) => Math.abs(e.t - s.t) < 60).pop();
    $('tmMsg').textContent = near ? near.m : '';
    mode.idx = idx;
  }
  const fmt = (n) => B.tools.fmt(n, 0);
  function enter() {
    if (mode || samples.length < 3) { if (!mode) B.tools.toast('The twin needs a moment to record. Try again shortly.'); return; }
    const d = document.querySelector('.drawer'); if (d && !d.hidden) $('drawerClose').click();
    mode = { was: S.st.running, live: B.SLOTS.map((s) => s.item), shown: new Set(), allTrucks: [...new Set(samples.flatMap((s) => s.tr.map((o) => o.q)))], idx: samples.length - 1, playing: false, acc: 0 };
    S.st.running = false; B.audit.mute = true;
    bar.hidden = false;
    const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
    $('tmMarks').innerHTML = events.filter((e) => e.t >= t0 && e.t <= t1).map((e) => '<i class="' + (e.kind === 'near' ? '' : 'o') + '" data-t="' + e.t + '" title="' + e.m.replace(/"/g, '') + '" style="left:' + ((e.t - t0) / (t1 - t0 || 1)) * 100 + '%"></i>').join('');
    $('tmS').value = 1000; apply(samples.length - 1);
  }
  function exit() {
    if (!mode) return;
    B.SLOTS.forEach((s, i) => { if (s.item !== mode.live[i] || mode.shown.has(i)) { s.item = mode.live[i]; update(s, true); } });
    W.flagPallets();
    mode.allTrucks.forEach((q) => { if (!S.trucks.includes(q)) { if (q.mesh.parent) W.scene.remove(q.mesh); } else { q.mesh.visible = true; q.mesh.position.z = q.z; } });
    B.actors.list.forEach((a) => a.mesh.position.set(a.x, a.kind === 'drone' ? a.y : 0, a.z));
    B.audit.mute = false; S.st.running = mode.was; mode = null; bar.hidden = true;
  }
  $('tmS').addEventListener('input', (e) => { if (mode) { mode.playing = false; $('tmPlay').textContent = 'Play'; apply(Math.round((+e.target.value / 1000) * (samples.length - 1))); } });
  $('tmLive').addEventListener('click', exit);
  $('tmPlay').addEventListener('click', (e) => { if (!mode) return; mode.playing = !mode.playing; e.target.textContent = mode.playing ? 'Pause' : 'Play'; });
  $('tmMarks').addEventListener('click', (e) => { const t = +e.target.dataset.t; if (!t || !mode) return; let i = samples.findIndex((s) => s.t >= t - 45); if (i < 0) i = 0; $('tmS').value = (i / (samples.length - 1)) * 1000; mode.playing = true; $('tmPlay').textContent = 'Pause'; apply(i); });
  B.hooks.frame.push((dt) => {
    if (!mode) return;
    if (mode.playing) { mode.acc += dt * 8; while (mode.acc >= 1) { mode.acc -= 1; mode.idx++; } if (mode.idx >= samples.length - 1) { mode.playing = false; $('tmPlay').textContent = 'Play'; mode.idx = samples.length - 1; } $('tmS').value = (mode.idx / (samples.length - 1)) * 1000; apply(mode.idx); }
  });
  document.getElementById('views').insertAdjacentHTML('beforeend', '<button class="vbtn" id="vTime" title="Go back and replay any moment">Time machine</button>');
  $('vTime').addEventListener('click', () => (mode ? exit() : enter()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mode) exit(); });
  B.timeline = { enter, exit, apply, samples, events, active: () => !!mode };
})();
