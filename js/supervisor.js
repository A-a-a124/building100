/* Building 19 - Be the supervisor: three minutes in charge, real events and decisions that change the live twin, then a scorecard with the effect on the numbers */
(function () {
  const B = window.B100, S = B.sim, A = B.actors;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const $ = (id) => document.getElementById(id);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const DUR = 180, EVERY = 19, DECIDE = 14;
  const wk = () => A.list.filter((a) => a.route && !B.watch.active.has(a) && !a.onBreakWalk);
  const pickW = () => { const l = wk(); return l[Math.floor(Math.random() * l.length)]; };
  const freeF = () => S.forklifts.find((f) => !f.down && !f.task) || S.forklifts.find((f) => !f.down);
  const slow = (k, secs) => { S.forklifts.forEach((f) => { if (f.heldSkill == null) f.heldSkill = f.skill; f.skill = f.heldSkill * k; }); run.holdUntil = S.st.t + secs; };

  const DECK = [
    { id: 'trucks', title: 'Three trucks at the gate', text: 'Three inbound trucks arrived together. Receiving will back up.', setup: () => { S.newInbound(); S.newInbound(); S.newInbound(); }, opts: [
      { label: 'Bring in a spare forklift', sc: { flow: 10, service: 3 }, fx: () => S.setForklifts(S.forklifts.length + 1), note: 'A sixth forklift joined receiving.' },
      { label: 'Let them queue at the gate', sc: { flow: -6, service: -2 }, fx: () => {}, note: 'Trucks wait; the carriers lose time.' }] },
    { id: 'break', title: 'Forklift hydraulic leak', setup: (e) => { const f = freeF(); if (f) { B.maint.breakDown(f, 'Hydraulic leak'); e.f = f; } }, text: 'A driver reports oil under the mast.', opts: [
      { label: 'Send it to the workshop', sc: { safety: 8, flow: -2 }, fx: (e) => { if (e.f && e.f.down) e.f.down.until = S.st.t + 900; }, note: 'Out for 15 minutes, no spill on the lane.' },
      { label: 'Keep it running to the end of the shift', sc: { safety: -14, flow: 7 }, fx: (e) => { if (e.f && e.f.down) B.maint.repair(e.f); }, note: 'More pallets moved, with a live leak on the floor.' }] },
    { id: 'helmet', title: 'Camera: worker without a helmet', setup: (e) => { e.a = pickW(); if (e.a) { B.watch.dress(); B.watch.stage(e.a, 'helmet', 500); e.text = (e.a.anon ? 'A worker' : e.a.name) + ' is on the floor without a helmet.'; } }, text: 'A worker is on the floor without a helmet.', opts: [
      { label: 'Stop the work and correct it now', sc: { safety: 10, flow: -1 }, fx: (e) => e.a && B.watch.endStage(e.a), note: 'Helmet back on. Noted for the shift talk.' },
      { label: 'Write it down for later', sc: { safety: -7 }, fx: () => {}, note: 'The breach stays on camera until the worker is stopped.' }] },
    { id: 'exit', title: 'Fire exit blocked', setup: (e) => { e.b = B.watch.blockExit(); }, text: 'A pallet was left in front of a fire exit.', opts: [
      { label: 'Clear it immediately', sc: { safety: 12, flow: -2 }, fx: (e) => e.b && B.watch.clearExit(e.b), note: 'Exit clear within minutes.' },
      { label: 'Clear it after the next truck', sc: { safety: -15, flow: 2 }, fx: () => {}, note: 'The exit stays blocked for now.' }] },
    { id: 'near', title: 'Near miss at a crossing', text: 'A forklift and a worker came within a metre at the north lane.', setup: () => { S.st.nearMiss++; }, opts: [
      { label: 'Toolbox talk, slow the fleet for 10 minutes', sc: { safety: 12, flow: -6 }, fx: () => slow(0.65, 600), note: 'Drivers slowed down; fewer close calls.' },
      { label: 'Remind the driver by radio', sc: { safety: 2 }, fx: () => {}, note: 'Quick, but the pattern stays.' },
      { label: 'Carry on', sc: { safety: -10, flow: 3 }, fx: () => {}, note: 'Nothing changes.' }] },
    { id: 'rush', title: 'Urgent order from the plant', text: 'The plant needs 4 pallets for a shutdown today.', setup: () => { S.newOrder(4); }, opts: [
      { label: 'Put it first in the queue', sc: { service: 12, flow: -3 }, fx: () => { const o = S.pendingOrders.pop(); if (o) { o.readyAt = S.st.t; S.pendingOrders.unshift(o); } }, note: 'The order skips the paper queue.' },
      { label: 'Normal queue', sc: { service: -8 }, fx: () => {}, note: 'The plant waits its turn.' }] },
    { id: 'dust', title: 'Dust storm warning', text: 'Visibility is falling in the yard. The storm arrives in minutes.', setup: () => { B.weather.startDust(0.5); run.dust = true; }, opts: [
      { label: 'Bring outdoor staff in, ground the drone', sc: { safety: 10, service: -2 }, fx: () => {}, note: 'Yard work paused until it clears.' },
      { label: 'Keep working outside', sc: { safety: -12, service: 3 }, fx: () => {}, note: 'Work continues at low visibility.' }] },
    { id: 'batt', title: 'Two forklifts at low battery', text: 'Both are under 20% in the middle of the peak.', setup: (e) => { e.fs = S.forklifts.filter((f) => !f.down).slice(0, 2); e.fs.forEach((f) => (f.battery = 19)); }, opts: [
      { label: 'Charge them in turn', sc: { flow: 5, safety: 2 }, fx: (e) => { if (e.fs[1]) e.fs[1].battery = 34; }, note: 'One charges now, the other after, so the lane stays served.' },
      { label: 'Both to the chargers now', sc: { flow: -5, safety: 2 }, fx: () => {}, note: 'Two forklifts out at the peak.' }] },
    { id: 'haz', title: 'Hazmat storage breach', text: 'The twin flagged incompatible materials stored too close.', setup: (e) => { e.v = B.hazmat.violations()[0]; }, opts: [
      { label: 'Move the material now', sc: { safety: 12, flow: -2 }, fx: (e) => { if (e.v) { const g = [e.v.a, e.v.b].find((q) => !q.moved); if (g) try { B.hazmat.fix(g.id); } catch (x) {} } }, note: 'Separation restored.' },
      { label: 'Book it for tomorrow', sc: { safety: -9 }, fx: () => {}, note: 'The breach stays until then.' }] },
  ];

  const run = { on: false };
  const card = document.createElement('div'); card.className = 'svcard'; card.hidden = true; B.three.stage.appendChild(card);
  const css = document.createElement('style');
  css.textContent = `.svcard { position: absolute; z-index: 8; right: 14px; top: 14px; width: min(400px, calc(100% - 28px)); background: var(--surface); border: 1px solid var(--line); border-top: 5px solid #e2513a; border-radius: 12px; box-shadow: var(--shadow); padding: 12px 14px; display: grid; gap: 8px; font-size: 13px; }
    .svHead { display: flex; justify-content: space-between; align-items: center; font: 700 12px var(--f-mono); color: var(--muted); } .svHead b { font: 700 20px var(--f-mono); color: var(--ink); } .svcard h3 { margin: 0; font: 700 17px var(--f-display); } .svcard p { margin: 0; } .svOpts { display: grid; gap: 6px; } .svOpts button { text-align: left; padding: 9px 11px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); font-weight: 600; font-size: 13px; cursor: pointer; } .svOpts button:hover { border-color: var(--accent-strong); background: var(--surface); }
    .svT { height: 5px; background: var(--surface-2); border-radius: 3px; overflow: hidden; } .svT i { display: block; height: 100%; background: #e2513a; width: 100%; } .svScores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center; font-size: 11px; color: var(--muted); } .svScores b { display: block; font: 700 17px var(--f-mono); color: var(--ink); } .svNote { color: var(--muted); font-style: italic; min-height: 18px; }
    .svcard table { width: 100%; border-collapse: collapse; font-size: 13px; } .svcard td, .svcard th { padding: 4px 4px; border-bottom: 1px solid var(--line); text-align: left; } .svcard td.n { text-align: right; font-family: var(--f-mono); } .svGrade { font: 800 34px var(--f-display); text-align: center; }`;
  document.head.appendChild(css);

  const snap = () => ({ rec: S.st.received, ship: S.st.shipped, near: S.st.nearMiss || 0, open: S.kpis().open, viol: B.watch.events.length, tickets: B.watch.open.length, orders: S.st.ordersDone });
  function start() {
    if (run.on) return;
    const d = document.querySelector('.drawer'); if (d && !d.hidden) $('drawerClose').click();
    Object.assign(run, { on: true, t: 0, next: 3, wait: null, deck: DECK.slice().sort(() => Math.random() - 0.5), sc: { safety: 0, flow: 0, service: 0 }, was: { speed: S.st.speed, n: S.targetForklifts, running: S.st.running }, from: snap(), note: '', decisions: 0, missed: 0, dust: false, holdUntil: 0 });
    S.st.speed = 20; S.st.running = true;
    card.hidden = false; paint();
    B.ui.setView('overview');
  }
  function raise(ev) {
    const e = Object.assign({}, ev); if (e.setup) e.setup(e);
    run.wait = e; run.waitT = DECIDE;
    if (B.sound) B.sound.alert();
    paint();
  }
  function decide(i) {
    const e = run.wait; if (!e) return;
    const o = e.opts[i]; o.fx(e);
    Object.entries(o.sc).forEach(([k, v]) => (run.sc[k] += v));
    run.note = o.note; run.wait = null; run.decisions++;
    if (B.sound) (Object.values(o.sc).reduce((a, b) => a + b, 0) >= 0 ? B.sound.ok() : B.sound.bad());
    paint();
  }
  function paint() {
    if (run.done) return;
    const e = run.wait, left = Math.max(0, DUR - run.t);
    card.innerHTML = '<div class="svHead"><span>BE THE SUPERVISOR</span><b>' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0') + '</b></div>' +
      '<div class="svScores"><div><b>' + run.sc.safety + '</b>Safety</div><div><b>' + run.sc.flow + '</b>Flow</div><div><b>' + run.sc.service + '</b>Service</div></div>' +
      (e ? '<h3>' + e.title + '</h3><p>' + (e.text || '') + '</p><div class="svT"><i id="svTi"></i></div><div class="svOpts">' + e.opts.map((o, i) => '<button data-o="' + i + '">' + o.label + '</button>').join('') + '</div>'
        : '<p class="svNote">' + (run.note || 'The floor is running. The next call will come to you.') + '</p>') +
      '<div class="btnrow"><button class="chip" id="svStop">End challenge</button></div>';
    card.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => decide(+b.dataset.o)));
    $('svStop').addEventListener('click', () => finish(true));
  }
  function finish(early) {
    if (!run.on) return;
    run.on = false;
    const to = snap(), f = run.from, sc = run.sc;
    S.st.speed = run.was.speed;
    S.forklifts.forEach((q) => { if (q.heldSkill != null) { q.skill = q.heldSkill; q.heldSkill = null; } });
    S.setForklifts(run.was.n);
    if (run.dust) B.weather.endDust();
    const total = Math.max(0, Math.min(100, Math.round(50 + (sc.safety * 1.2 + sc.flow + sc.service) / 1.3 - run.missed * 3)));
    const grade = total >= 85 ? 'Excellent' : total >= 70 ? 'Good' : total >= 50 ? 'Fair' : 'Needs work';
    const best = Math.max(+store.get('b100.supBest') || 0, total); store.set('b100.supBest', best);
    const line = (n, a, b, good) => '<tr><td>' + n + '</td><td class="n">' + fmt(a) + '</td><td class="n">' + fmt(b) + '</td></tr>';
    card.innerHTML = '<div class="svHead"><span>YOUR SHIFT' + (early ? ' (ended early)' : '') + '</span><span>Best ' + best + '</span></div><div class="svGrade">' + total + ' · ' + grade + '</div>' +
      '<div class="svScores"><div><b>' + sc.safety + '</b>Safety</div><div><b>' + sc.flow + '</b>Flow</div><div><b>' + sc.service + '</b>Service</div></div>' +
      '<table><tr><th>In these 3 minutes</th><th style="text-align:right">At start</th><th style="text-align:right">At end</th></tr>' + line('Pallets put away', f.rec, to.rec) + line('Pallets shipped', f.ship, to.ship) + line('Orders completed', f.orders, to.orders) + line('Open tasks', f.open, to.open) + line('Near misses', f.near, to.near) + line('Camera detections', f.viol, to.viol) + line('Open safety tickets', f.tickets, to.tickets) + '</table>' +
      '<p>' + run.decisions + ' decisions made, ' + run.missed + ' left unanswered. Every choice changed the live twin. Scores are a training aid.</p><div class="btnrow"><button class="btn primary" id="svAgain">Try again</button><button class="btn" id="svClose">Close</button></div>';
    $('svAgain').addEventListener('click', start);
    $('svClose').addEventListener('click', () => (card.hidden = true));
    run.score = total;
  }
  B.hooks.frame.push((dt) => {
    if (!run.on) return;
    run.t += dt;
    if (run.holdUntil && S.st.t > run.holdUntil) { S.forklifts.forEach((q) => { if (q.heldSkill != null) { q.skill = q.heldSkill; q.heldSkill = null; } }); run.holdUntil = 0; }
    if (run.t >= DUR) return finish(false);
    if (run.wait) {
      run.waitT -= dt;
      const i = $('svTi'); if (i) i.style.width = (run.waitT / DECIDE) * 100 + '%';
      if (run.waitT <= 0) { run.missed++; run.sc.safety -= 4; run.note = 'No decision was made in time.'; run.wait = null; run.next = run.t + 4; paint(); }
    } else if (run.t >= run.next && run.deck.length) { run.next = run.t + EVERY; raise(run.deck.shift()); }
    if (!run.wait) { const h = card.querySelector('.svHead b'); const left = Math.max(0, DUR - run.t); if (h) h.textContent = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'); }
    else { const h = card.querySelector('.svHead b'); const left = Math.max(0, DUR - run.t); if (h) h.textContent = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'); }
  });
  function render(el) {
    const best = store.get('b100.supBest');
    el.innerHTML = `<h4>Be the supervisor</h4><p>Three minutes in charge of the floor. Trucks bunch up, forklifts fail, cameras flag people, a dust storm comes in. Each decision changes the live twin, and you get a scorecard with the effect on the numbers.</p>
      <div class="row2"><div class="stat"><b>3 min</b><small>${DECK.length} possible events</small></div><div class="stat"><b>${best || '-'}</b><small>best score on this device</small></div></div>
      <div class="btnrow"><button class="btn primary" id="svGo">Start the shift</button></div>`;
    el.querySelector('#svGo').addEventListener('click', start);
  }
  B.tools.add({ id: 'supervisor', label: 'Be the supervisor', render });
  B.supervisor = { start, finish, decide, state: () => run, DECK };
})();
