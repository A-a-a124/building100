/* Building 100 - presentation mode: a three-minute guided show for management, with captions that quote the live numbers */
(function () {
  const B = window.B100, S = B.sim, W = B.world;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const sar = (n) => B.stock.sar(n);
  const heat = (on) => { const c = document.getElementById('lyCong'); if (c && c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } };

  // ---------- "your data goes in": a demo SAP export loads live, then the sample stock comes back ----------
  let demoSaved = null, before = null, after = null;
  function demoRows() {
    const R = B.rng(2027), rows = [['Material', 'Description', 'Quantity', 'Unit', 'Storage Bin', 'Last Movement', 'Material Group', 'Unit Price', 'Owner']];
    const names = [['GATE VALVE 8IN ANSI 600', 'VALVES', 9800], ['BALL VALVE 3IN ANSI 300', 'VALVES', 2100], ['CENTRIFUGAL PUMP SEAL KIT', 'MECH SPARES', 7400], ['BEARING 6318-2RS', 'MECH SPARES', 880],
      ['PRESSURE TRANSMITTER 0-250 BAR', 'INSTRUMENTS', 6100], ['FLOW METER ULTRASONIC 6IN', 'INSTRUMENTS', 42000], ['CABLE 4X185MM2 1KV', 'ELECTRICAL', 54000], ['SWITCHGEAR BREAKER 1250A', 'ELECTRICAL', 31000],
      ['WELD NECK FLANGE 12IN 600#', 'FLANGES', 1450], ['SPIRAL WOUND GASKET 8IN', 'GASKETS', 75], ['STUD BOLT B7 1IN X 8IN', 'GASKETS', 31], ['SAFETY HARNESS FULL BODY', 'PPE', 640], ['HYDRAULIC OIL VG68 208L', 'CONSUMABLES', 2900]];
    const owners = ['Aramco', 'Aramco', 'Aramco', 'Aramco', 'Contractor A', 'Contractor B'];
    const now = Date.now();
    B.SLOTS.forEach((s) => {
      if (R() > 0.86) return;
      const [d, g, p] = names[Math.floor(R() * names.length)];
      const age = Math.floor(Math.pow(R(), 1.5) * 700);
      rows.push(['1001' + String(Math.floor(R() * 1e6)).padStart(6, '0'), d, String(p > 10000 ? 1 + Math.floor(R() * 3) : p > 1000 ? 2 + Math.floor(R() * 10) : 20 + Math.floor(R() * 180)), 'EA', s.code, new Date(now - age * 864e5).toISOString().slice(0, 10), g, String(p), owners[Math.floor(R() * owners.length)]]);
    });
    return rows;
  }
  function loadDemo() {
    demoSaved = { items: B.ITEMS.map((it) => Object.assign({}, it)), slots: B.SLOTS.map((s) => [s.item, s.qty, s.days, s.owner]), info: B.importInfo };
    before = B.stock.compute(true);
    B.importer.apply(demoRows(), 'SAP stock export (demo)');
    after = B.stock.compute(true);
    const hm = document.getElementById('lyHeat'); if (hm && !hm.checked) { hm.checked = true; hm.dispatchEvent(new Event('change')); }
  }
  function restore() {
    const hm = document.getElementById('lyHeat'); if (hm && hm.checked) { hm.checked = false; hm.dispatchEvent(new Event('change')); }
    if (!demoSaved) return;
    B.ITEMS.length = 0; demoSaved.items.forEach((it) => B.ITEMS.push(it));
    Object.keys(B.itemsByCat).forEach((k) => (B.itemsByCat[k].length = 0)); B.ITEMS.forEach((it) => (B.itemsByCat[it.cat] = B.itemsByCat[it.cat] || []).push(it.i));
    B.SLOTS.forEach((s, i) => { [s.item, s.qty, s.days, s.owner] = demoSaved.slots[i]; s.reserved = false; W.updateSlot(s, true); });
    W.flagPallets(); S.occ = B.occupiedCount(); B.importInfo = demoSaved.info; if (B.slotting) B.slotting.clear(); B.panel.renderZones();
    demoSaved = null;
  }

  // each scene: where the camera goes, a title, and a line built from the model at that moment
  const SCENES = [
    { view: 'overview', title: 'Building 100 · a live digital twin', line: () => 'The whole materials warehouse in 3D: ' + fmt(B.SLOTS.length) + ' pallet positions, ' + S.forklifts.length + ' forklifts, 2 drones and the open yard, running a live simulation.' },
    { view: 'rcv', title: 'Trucks arrive on booked slots', line: () => { const c = B.carriers.recs.filter((r) => r.docked != null), on = c.filter((r) => r.gate - r.appt <= 300).length; return c.length ? on + ' of ' + c.length + ' trucks so far arrived on time. Late carriers and gate waiting are tracked per company.' : 'Every truck has a carrier and a booked slot; late arrivals and waiting at the gate are tracked per company.'; } },
    { view: 'rack', title: 'Every pallet is known', line: () => { const st = B.stock.compute(); return 'Stock worth ' + sar(st.total) + '. ' + fmt(st.frozenPallets) + ' pallets have not moved for a year and cost ' + sar(st.holdFrozen) + ' a year to keep.'; } },
    { view: 'rack', title: 'Your data goes in, the twin updates', enter: loadDemo, leave: restore, line: () => 'A stock export from SAP just loaded: ' + fmt(B.importInfo.rows) + ' lines placed by bin code. Stock value ' + sar(before.total) + ' → ' + sar(after.total) + ', frozen pallets ' + fmt(before.frozenPallets) + ' → ' + fmt(after.frozenPallets) + '. Red pallets are the oldest stock.' },
    { view: 'aisle', title: 'Drones count the high shelves', line: () => 'About ' + fmt(B.cycle.plan().due.length) + ' locations are counted every week instead of one yearly stock-take. Drone D1 flies the top levels.' },
    { view: 'team', title: 'People and forklifts share the floor', line: () => 'Forklifts stopped or gave way ' + fmt(S.st.yields || 0) + ' times. Every near miss is logged with its place, so the risky spots show up.' },
    { view: 'top', title: 'Where the floor is busy', line: () => 'The congestion heatmap shows where forklifts and people spend their time: the base for safer walkways and better slotting.', enter: () => heat(true), leave: () => heat(false) },
    { view: 'haz', title: 'Hazmat rules checked automatically', line: () => { const v = B.hazmat.violations().length; return v ? v + ' storage rule breaches found in the cage, each with a one-click fix.' : 'The cage passes every segregation rule.'; } },
    { view: 'yard', title: 'The yard, the weather and the drones', line: () => 'Dust storms ground the yard drone and slow the trucks; the summer midday work ban is built in.' },
    { view: 'dsp', title: 'Orders leave on time', line: () => { const k = S.kpis(); return k.cycle ? 'Average order cycle ' + fmt(k.cycle, 0) + ' minutes from order to truck, with ' + Math.round(k.util * 100) + '% forklift utilisation.' : 'Issue orders are picked, staged and loaded through four doors on the south side.'; } },
    { view: 'overview', title: 'What the improvements are worth', line: () => { const ba = B.beforeAfter.compare(), r = B.roi.evaluate().filter((q) => q.payback < Infinity && q.id !== 'custom').sort((a, b) => a.payback - b.payback)[0]; return 'Order cycle ' + fmt(ba[0].before, 1) + ' → ' + fmt(ba[0].after, 1) + ' min. Best investment: ' + (r ? r.name.toLowerCase() + ', 3-year net ' + sar(r.three) : 'see the ROI tab') + '.'; } },
    { cam: [[-260, 150, 300], [20, 0, 0]], title: 'From idea to a working model', line: () => 'Building 100 digital twin · Designed by Abdullah Aladhyani' },
  ];
  const DUR = 15;
  let i = -1, t = 0, paused = false, saved = null;

  const cap = document.createElement('div');
  cap.className = 'pcap'; cap.hidden = true;
  cap.innerHTML = '<div class="pbar"><i id="pFill"></i></div><small id="pStep"></small><h2 id="pTitle"></h2><p id="pLine"></p><div class="pbtns"><button class="btn" id="pPrev">Back</button><button class="btn" id="pPause">Pause</button><button class="btn primary" id="pNext">Next</button><button class="btn" id="pExit">Exit</button></div>';
  document.body.appendChild(cap);
  const css = document.createElement('style');
  css.textContent = `.pcap { position: fixed; z-index: 40; left: 32px; bottom: 32px; width: min(620px, calc(100% - 64px)); background: rgba(12,17,23,0.86); color: #fff; border-radius: 16px; padding: 16px 20px 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.35); backdrop-filter: blur(6px); }
    .pcap h2 { margin: 4px 0 6px; font: 800 26px/1.15 var(--f-display); } .pcap p { margin: 0 0 12px; font-size: 16px; line-height: 1.45; color: #dfe5ea; } .pcap small { color: #f2b31b; font: 700 12px var(--f-mono); letter-spacing: 0.06em; }
    .pbar { height: 3px; background: rgba(255,255,255,0.15); border-radius: 2px; overflow: hidden; margin-bottom: 10px; } .pbar i { display: block; height: 100%; width: 0; background: #f2b31b; }
    .pbtns { display: flex; gap: 8px; } .pbtns .btn:not(.primary) { background: rgba(255,255,255,0.12); color: #fff; border-color: transparent; }
    body.present .databadge, body.present .wxchip, body.present .mmap, body.present .hocard, body.present .toast { display: none !important; }`;
  document.head.appendChild(css);
  const $ = (id) => document.getElementById(id);

  function go(k) {
    if (i >= 0 && SCENES[i].leave) SCENES[i].leave();
    i = Math.max(0, Math.min(SCENES.length - 1, k)); t = 0;
    const s = SCENES[i];
    if (s.enter) s.enter();
    if (s.view) B.ui.setView(s.view); else B.ui.flyTo(s.cam[0], s.cam[1], 2.5);
    $('pStep').textContent = 'BUILDING 100 · ' + (i + 1) + ' / ' + SCENES.length;
    $('pTitle').textContent = s.title;
    $('pLine').textContent = s.line();
    $('pNext').textContent = i === SCENES.length - 1 ? 'Finish' : 'Next';
  }
  function start() {
    saved = { speed: S.st.speed, running: S.st.running };
    const sp = document.querySelector('#speed [data-v="20"]'); if (sp) sp.click(); else S.st.speed = 20;
    S.st.running = true;
    const d = document.querySelector('.drawer'); if (d && !d.hidden) $('drawerClose').click();
    document.body.classList.add('cine', 'present');
    cap.hidden = false; paused = false; $('pPause').textContent = 'Pause';
    go(0);
  }
  function stop() {
    if (i >= 0 && SCENES[i].leave) SCENES[i].leave();
    i = -1; cap.hidden = true;
    document.body.classList.remove('cine', 'present');
    if (saved) { const sp = document.querySelector('#speed [data-v="' + saved.speed + '"]'); if (sp) sp.click(); else S.st.speed = saved.speed; S.st.running = saved.running; }
    B.ui.setView('overview');
  }
  $('pNext').addEventListener('click', () => (i === SCENES.length - 1 ? stop() : go(i + 1)));
  $('pPrev').addEventListener('click', () => go(i - 1));
  $('pExit').addEventListener('click', stop);
  $('pPause').addEventListener('click', (e) => { paused = !paused; e.target.textContent = paused ? 'Play' : 'Pause'; });
  document.addEventListener('keydown', (e) => {
    if (i < 0) return;
    if (e.key === 'Escape') stop(); else if (e.key === 'ArrowRight') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); else if (e.key === ' ') { e.preventDefault(); $('pPause').click(); }
  });
  B.hooks.frame.push((dt) => {
    if (i < 0) return;
    if (!paused) t += dt;
    $('pFill').style.width = Math.min(100, (t / DUR) * 100) + '%';
    if (t > DUR) (i === SCENES.length - 1 ? stop() : go(i + 1));
  });

  // header button
  const btn = document.createElement('button');
  btn.className = 'btn'; btn.id = 'presentBtn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M12 16v4M8 20h8"/></svg><span>Present</span>';
  document.getElementById('tourBtn').after(btn);
  btn.addEventListener('click', start);
  B.present = { start, stop, scenes: SCENES };
})();
