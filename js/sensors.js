/* Building 100 - sensor layer: RFID gates, door, rack, climate and forklift sensors send simulated readings that stream up to the twin */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, P = B.panel;
  const { renderer, camera, scene, stage } = B.three;
  const R = B.rng(909);
  const group = new T.Group(); group.visible = false; scene.add(group);
  const glow = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  const sprite = (color, s) => { const m = new T.Sprite(new T.SpriteMaterial({ map: glow, color, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false })); m.scale.setScalar(s); m.renderOrder = 9; return m; };
  const COLORS = { rfid: '#33a3ff', door: '#2fbf5a', rack: '#f2b31b', climate: '#ff6a3c', forklift: '#c77dff', weather: '#7fe0ff' };
  const TYPES = { rfid: 'RFID gate', door: 'Door sensor', rack: 'Rack fill sensor', climate: 'Climate and gas sensor', forklift: 'Forklift tracker', weather: 'Weather station' };
  const list = [];
  function add(type, id, x, y, z, read, follow) {
    const dev = W.box(0.3, 0.2, 0.2, '#20252a'); dev.position.set(x, y, z);
    const dot = sprite(COLORS[type], 1.1); dot.position.set(x, y + 0.1, z);
    group.add(dev, dot);
    const q = { type, id, x, y, z, read, follow, dev, dot, pulse: 0, hist: [], last: '' };
    list.push(q); return q;
  }
  const bay = (d) => (W.doorsIn.includes(d) ? 'IN ' : 'OUT ') + d.n;
  W.doorsIn.concat(W.doorsOut).forEach((d) => {
    add('rfid', 'RFID-' + bay(d).replace(' ', ''), d.x - 2.2, 3.6, d.z + d.dir * 0.5, () => { const tr = S.trucks.find((t) => t.door === d); return { v: tr ? tr.done || 0 : 0, text: tr ? (tr.done || 0) + ' pallets read on this truck' : 'No truck: gate idle' }; });
    add('door', 'DOOR-' + bay(d).replace(' ', ''), d.x + 2.2, 3.6, d.z + d.dir * 0.5, () => { const q = B.docks.doors.find((o) => o.d === d), open = q ? q.open : 0; return { v: open * 100, text: open > 0.5 ? 'Door open, truck at the dock' : 'Door closed' }; });
  });
  B.RACK.rows.forEach((row, i) => add('rack', 'RACK-' + row.letter, B.RACK.x0 - 1, 9.3, row.z, () => { const sl = B.SLOTS.filter((s) => s.row === i), n = sl.filter((s) => s.item >= 0).length; return { v: (n / sl.length) * 100, text: 'Row ' + row.letter + ': ' + Math.round((n / sl.length) * 100) + '% full, ' + n + ' pallets' }; }));
  const zc = (id) => { const z = B.zoneById(id); return [(z.x[0] + z.x[1]) / 2, (z.z[0] + z.z[1]) / 2]; };
  const indoor = () => (B.weather ? 22 + (B.weather.state.temp - 22) * 0.25 : 26);
  [['HAZ', 'Hazmat cage'], ['SHELF', 'Small parts store'], ['OFF', 'Warehouse office']].forEach(([zid, name]) => { const [x, z] = zc(zid); let d = R() * 2; add('climate', 'ENV-' + zid, x, 3.4, z, () => { d += (R() - 0.5) * 0.15; const t = indoor() + d; return { v: t, text: name + ': ' + t.toFixed(1) + '°C' + (zid === 'HAZ' ? ', gas 0 ppm' : ', humidity ' + Math.round(38 + d * 3) + '%') }; }); });
  { const [x, z] = zc('YARD'); add('weather', 'WX-YARD', x, 6, z, () => { const w = B.weather.state; return { v: w.wind, text: Math.round(w.temp) + '°C, wind ' + Math.round(w.wind) + ' km/h, visibility ' + (w.dust ? Math.round(w.vis * 1000) + ' m' : 'over 10 km') }; }); }
  function syncForklifts() {
    S.forklifts.forEach((f) => { if (!list.some((q) => q.follow === f)) add('forklift', 'FL-' + f.n, f.x, 2.9, f.z, () => { const d = S.describeForklift(f.n); return { v: f.battery || 0, text: 'Forklift ' + f.n + ': ' + Math.round(f.battery || 0) + '% battery, ' + (f.path && f.path.length ? 'moving' : 'stopped') + ', ' + ((f.dist || 0) / 1000).toFixed(1) + ' km today' + (f.down ? ', fault: ' + f.down.why : '') }; }, f); });
  }

  // the twin: a glowing hub above the building that every reading flows into
  const HUB = new T.Vector3(0, 34, 0);
  const hub = sprite('#58d0ff', 16), hubCore = sprite('#ffffff', 6); hub.position.copy(HUB); hubCore.position.copy(HUB); group.add(hub, hubCore);
  const hubLabel = W.makeLabel('DIGITAL TWIN', { size: 2, bg: 'rgba(8,30,48,0.9)', fg: '#7fe0ff', weight: 700 }); hubLabel.position.set(0, 41, 0); group.add(hubLabel);
  const packets = Array.from({ length: 36 }, () => { const s = sprite('#ffffff', 0.9); s.visible = false; group.add(s); return { s, k: 2, from: new T.Vector3(), sp: 1 }; });

  // live feed list and the sensor card
  const feed = document.createElement('div'); feed.className = 'snfeed'; feed.hidden = true;
  feed.innerHTML = '<b>Live sensor feed</b><small>Simulated readings. <span id="snRate"></span></small><div id="snList"></div>';
  stage.appendChild(feed);
  const card = document.createElement('div'); card.className = 'sncard'; card.hidden = true; stage.appendChild(card);
  const css = document.createElement('style');
  css.textContent = `.snfeed { position: absolute; z-index: 3; left: 12px; top: 112px; width: 310px; background: rgba(10,18,26,0.82); color: #dfe8ef; border-radius: 12px; padding: 10px 12px; display: grid; gap: 4px; font-size: 12px; backdrop-filter: blur(4px); }
    .snfeed b { font: 700 13px var(--f-display); color: #7fe0ff; } .snfeed small { color: #9fb1bf; } #snList div { font: 500 11px var(--f-mono); padding: 2px 0; border-top: 1px solid rgba(255,255,255,0.08); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } #snList i { font-style: normal; display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
    .sncard { position: absolute; z-index: 5; width: 260px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 10px 12px; display: grid; gap: 4px; font-size: 13px; } .sncard small { color: var(--muted); } .sncard canvas { width: 100%; height: 50px; } body.cine .snfeed, body.cine .sncard { display: none; }`;
  document.head.appendChild(css);

  let total = 0, cardS = null;
  const stamps = [];
  function emit(q) {
    const r = q.read(); q.last = r.text; q.hist.push(r.v); if (q.hist.length > 40) q.hist.shift();
    q.pulse = 1; total++; stamps.push(performance.now());
    while (stamps.length && performance.now() - stamps[0] > 60000) stamps.shift();
    if (group.visible) {
      const p = packets.find((o) => o.k >= 1);
      if (p) { p.k = 0; p.from.set(q.x, q.y, q.z); p.s.material.color.set(COLORS[q.type]); p.s.visible = true; p.sp = 0.7 + R() * 0.4; }
      const l = document.getElementById('snList');
      if (l) { l.insertAdjacentHTML('afterbegin', '<div><i style="background:' + COLORS[q.type] + '"></i>' + P.esc(q.id + ' · ' + r.text) + '</div>'); while (l.children.length > 7) l.lastChild.remove(); }
      if (cardS === q) paintCard();
    }
  }
  function paintCard() {
    const q = cardS; if (!q) return;
    card.innerHTML = '<b>' + TYPES[q.type] + ' · ' + q.id + '</b><span>' + P.esc(q.last || '...') + '</span><canvas width="480" height="100"></canvas><small>Last ' + q.hist.length + ' readings (simulated feed). A real site would connect the same point to the device.</small>';
    const c = card.querySelector('canvas'), g = c.getContext('2d'), h = q.hist, max = Math.max(...h, 1), min = Math.min(...h, 0);
    g.strokeStyle = COLORS[q.type]; g.lineWidth = 4; g.beginPath(); h.forEach((v, i) => { const x = (i / Math.max(1, h.length - 1)) * 480, y = 92 - ((v - min) / (max - min || 1)) * 84; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  }
  // click a sensor: nearest one on screen
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!group.visible) return;
    const r = renderer.domElement.getBoundingClientRect(), v = new T.Vector3(); let best = null, bd = 28;
    list.forEach((q) => { v.set(q.x, q.y, q.z).project(camera); if (v.z > 1) return; const d = Math.hypot(((v.x + 1) / 2) * r.width + r.left - e.clientX, ((1 - v.y) / 2) * r.height + r.top - e.clientY); if (d < bd) { bd = d; best = q; } });
    cardS = best; card.hidden = !best;
    if (best) { card.style.left = Math.min(r.width - 280, Math.max(8, e.clientX - r.left + 12)) + 'px'; card.style.top = Math.min(r.height - 170, Math.max(8, e.clientY - r.top - 40)) + 'px'; paintCard(); }
  });

  let t = 0;
  B.hooks.frame.push((dt) => {
    syncForklifts();
    t += dt;
    if (t > 0.3) { t = 0; emit(list[Math.floor(R() * list.length)]); }
    if (!group.visible) return;
    const now = performance.now() / 1000;
    list.forEach((q) => {
      if (q.follow) { q.x = q.follow.x; q.z = q.follow.z; q.dev.position.set(q.x, q.y, q.z); q.dot.position.set(q.x, q.y + 0.1, q.z); }
      q.pulse = Math.max(0, q.pulse - dt * 1.5);
      q.dot.scale.setScalar(1 + q.pulse * 2.6);
    });
    packets.forEach((p) => { if (p.k >= 1) { p.s.visible = false; return; } p.k += dt * p.sp; const e = p.k * p.k; p.s.position.lerpVectors(p.from, HUB, e); p.s.position.y += Math.sin(p.k * Math.PI) * 6; });
    hub.scale.setScalar(15 + Math.sin(now * 2) * 1.5);
    const e = document.getElementById('snRate'); if (e) e.textContent = stamps.length + ' readings in the last minute · ' + list.length + ' sensors';
  });

  function setOn(on) { group.visible = on; feed.hidden = !on; if (!on) { card.hidden = true; cardS = null; } const b = document.getElementById('vSensors'); if (b) b.setAttribute('aria-pressed', on); }
  document.getElementById('views').insertAdjacentHTML('beforeend', '<button class="vbtn" id="vSensors" aria-pressed="false" title="Show the sensors feeding the twin">Sensors</button>');
  document.getElementById('vSensors').addEventListener('click', () => { const on = !group.visible; setOn(on); if (on) { syncForklifts(); B.ui.flyTo([-110, 95, 130], [0, 8, 0], 1.6); } });
  B.sensors = { setOn, on: () => group.visible, list, count: () => list.length, perMinute: () => stamps.length, total: () => total };
})();
