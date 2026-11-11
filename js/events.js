/* Building 19 - live events: make something happen with one click, and the camera goes there to watch the twin respond */
(function () {
  const B = window.B100, S = B.sim, W = B.world, A = B.actors;
  const { stage } = B.three;
  const say = (t) => B.tools.toast(t, 6000);
  const at = (x, z, back, up) => B.ui.flyTo([x + back[0], up, z + back[1]], [x, 1.2, z], 1.4);

  const EVENTS = [
    { id: 'truck', name: 'A truck arrives', sub: 'An inbound truck comes through the gate', run() {
      const tr = S.newInbound();
      if (!tr) return say('Every receiving door is busy, so the truck waits at the gate. See Carriers for the queue.');
      B.ui.flyTo([tr.door.x + 16, 8, tr.door.z - 40], [tr.door.x, 2, tr.door.z - 8], 1.4);
      say('Truck on its way to door IN ' + tr.door.n + ' with ' + tr.count + ' pallets. Five minutes of paperwork, then the dock forklift unloads it.');
    } },
    { id: 'order', name: 'An urgent order', sub: 'The plant needs four pallets now', run() {
      S.newOrder(4);
      const o = S.pendingOrders.pop(); if (o) { o.readyAt = S.st.t; S.pendingOrders.unshift(o); }
      B.ui.setView('rack');
      say('Order ' + (o ? o.id : '') + ' jumps the paper queue. Watch the forklifts pick it and stage it at a shipping door.');
    } },
    { id: 'break', name: 'A forklift breaks down', sub: 'One forklift stops where it is', run() {
      const f = S.forklifts.find((q) => !q.down && q.path && q.path.length) || S.forklifts.find((q) => !q.down);
      if (!f || !B.maint.breakDown(f)) return say('Every forklift is already out of service.');
      at(f.x, f.z, [7, 9], 6);
      say('Forklift ' + f.n + ' is down: ' + f.down.why + '. Its job goes back in the queue and the others pick it up.');
    } },
    { id: 'dust', name: 'A dust storm', sub: 'Visibility drops across the yard', run() {
      B.weather.startDust(1); B.ui.setView('yard');
      say('Dust storm for the next hour. The yard drone is grounded and outdoor work slows down.');
    } },
    { id: 'exit', name: 'A fire exit is blocked', sub: 'Someone leaves a pallet in the way', run() {
      const b = B.watch.blockExit();
      if (!b) return say('Every exit already has a pallet in front of it.');
      at(b.exit.x, b.exit.z, [Math.abs(b.exit.x) > 60 ? -Math.sign(b.exit.x) * 12 : 5, Math.abs(b.exit.z) > 30 ? -Math.sign(b.exit.z) * 12 : 5], 6);
      say(b.ev ? 'A camera flagged exit ' + b.exit.id + ' and a ticket is waiting for the supervisor in Alerts.' : 'Exit ' + b.exit.id + ' is blocked, but no camera covers that spot.');
    } },
    { id: 'helmet', name: 'A worker without a helmet', sub: 'See how the cameras catch it', run() {
      const list = A.list.filter((a) => a.route && !B.watch.active.has(a) && !a.onBreakWalk), a = list[Math.floor(Math.random() * list.length)];
      if (!a) return say('Nobody is on the floor right now.');
      B.watch.dress(); B.watch.stage(a, 'helmet', 400);
      const cam = B.watch.seenBy(a.x, 1, a.z);
      B.watch.setCams(true); if (cam) B.watch.openCam(cam);
      at(a.x, a.z, [4, 5], 3);
      say((a.anon ? 'A worker' : a.name) + ' is on the floor without a helmet. Simulated detection: watch the camera feed mark it in red.');
    } },
    { id: 'drill', name: 'A fire drill', sub: 'Alarm sounds and everyone leaves', run() { B.evac.start(); } },
  ];

  const css = document.createElement('style');
  css.textContent = `.evmenu { position: absolute; z-index: 9; width: 290px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 6px; display: grid; gap: 2px; }
    .evmenu button { display: grid; gap: 1px; text-align: left; border: 0; background: transparent; padding: 8px 10px; border-radius: 8px; color: var(--ink); cursor: pointer; font: 600 13px var(--f-body, inherit); } .evmenu button small { font-weight: 400; color: var(--muted); } .evmenu button:hover { background: var(--surface-2); } body.cine .evmenu { display: none; }`;
  document.head.appendChild(css);
  const menu = document.createElement('div');
  menu.className = 'evmenu'; menu.hidden = true;
  menu.innerHTML = EVENTS.map((e) => '<button data-ev="' + e.id + '">' + e.name + '<small>' + e.sub + '</small></button>').join('');
  stage.appendChild(menu);
  document.getElementById('views').insertAdjacentHTML('beforeend', '<button class="vbtn" id="vEvents" aria-expanded="false" title="Make something happen and watch the twin respond">Live events</button>');
  const btn = document.getElementById('vEvents');
  function toggle(open) {
    menu.hidden = !open; btn.setAttribute('aria-expanded', open);
    if (!open) return;
    const b = btn.getBoundingClientRect(), s = stage.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(s.width - 304, b.left - s.left)) + 'px';
    menu.style.top = b.bottom - s.top + 6 + 'px';
  }
  function run(id) {
    const e = EVENTS.find((q) => q.id === id); if (!e) return;
    toggle(false);
    if (!S.st.running) document.getElementById('play').click();
    e.run();
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(menu.hidden); });
  menu.addEventListener('click', (e) => { const b = e.target.closest('[data-ev]'); if (b) run(b.dataset.ev); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) toggle(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
  B.events = { run, list: EVENTS, open: () => toggle(true) };
})();
