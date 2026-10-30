/* Building 100 - cycle count planner: weekly count schedule by ABC class, split between drone D1 and the team */
(function () {
  const B = window.B100, W = B.world, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const PERIOD = { A: 4, B: 13, C: 26 }; // weeks between counts of the same location
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const DRONE_S = 15, TEAM_S = 50, SHELF_BINS = 1300; // seconds per location
  const week = () => Math.floor((Date.now() / 864e5 + 4) / 7); // weeks start on Sunday
  const h = (i) => (Math.imul(i + 1, 2654435761) >>> 0);
  const stats = { counted: 0, matched: 0 };
  try { Object.assign(stats, JSON.parse(store.get('b100.count') || '{}')); } catch (e) {}

  function plan() {
    const st = B.stock.compute(), w = week();
    const due = B.SLOTS.filter((s) => { if (s.item < 0) return false; const r = st.rows[s.item]; const p = PERIOD[r ? r.abc : 'C']; return h(s.i) % p === w % p; });
    due.sort((a, b) => a.row - b.row || a.level - b.level || a.bay - b.bay);
    const per = Math.ceil(due.length / 5), shelf = Math.round(SHELF_BINS / 13 / 5);
    const days = DAYS.map((name, k) => {
      const list = due.slice(k * per, (k + 1) * per);
      const drone = list.filter((s) => s.level >= 3), team = list.filter((s) => s.level < 3);
      return { name, list, drone: drone.length, team: team.length + shelf, shelf, yard: k === 4, droneMin: (drone.length * DRONE_S) / 60, teamH: ((team.length + shelf) * TEAM_S) / 3600 };
    });
    const byClass = { A: 0, B: 0, C: 0 };
    due.forEach((s) => byClass[st.rows[s.item].abc]++);
    return { due, days, byClass };
  }
  const doneKey = () => 'b100.count.' + new Date().toISOString().slice(0, 10);
  function today() {
    const d = new Date().getDay();
    if (d > 4) return null; // Friday and Saturday
    const p = plan().days[d];
    return { name: p.name, total: p.list.length + p.shelf, drone: p.drone, team: p.team, list: p.list, done: store.get(doneKey()) === '1' };
  }

  // pallets of today's count stand out in orange
  let todaySet = new Set();
  B.colourModes = B.colourModes || {};
  B.colourModes.count = (s, out) => out.set(todaySet.has(s.i) ? '#ff7a00' : '#9aa3ab');

  // drone D1 flies the high levels on today's list
  function sendDrone() {
    const t = today(), d = B.actors.byId('d1');
    if (!t || !d) return;
    const R = B.RACK, groups = [];
    t.list.filter((s) => s.level >= 3).forEach((s) => { const k = s.row + '|' + s.level; if (!groups.includes(k)) groups.push(k); });
    const xa = R.x0 - 1.5, xb = R.x0 + R.bays * R.bayW + 1.5, cruise = 10.6;
    const pl = [{ x: d.padX, y: cruise, z: d.padZ, sp: 1.6, label: 'Taking off for today\'s cycle count' }];
    groups.slice(0, 4).forEach((k, n) => {
      const [ri, l] = k.split('|').map(Number), row = R.rows[ri], y = (l - 1) * R.levelH + 0.9, from = n % 2 ? xb : xa, to = n % 2 ? xa : xb;
      pl.push({ x: from, y: cruise, z: row.access, label: 'Flying to row ' + row.letter }, { x: from, y, z: row.access, sp: 1.4, label: 'Dropping into the aisle' });
      pl.push({ x: to, y, z: row.access, sp: 1.3, scan: true, row: ri, level: l, label: 'Cycle count: row ' + row.letter + ', level ' + l,
        after: () => { B.SLOTS.forEach((s) => { if (s.row === ri && s.level === l) s._counted = false; }); B.sim.addLog('Drone D1 counted row ' + row.letter + ', level ' + l + ' for today\'s plan', 'info'); } });
      pl.push({ x: to, y: cruise, z: row.access, sp: 1.6, label: 'Climbing above the racks' });
    });
    pl.push({ x: d.padX, y: cruise, z: d.padZ, label: 'Returning to the pad' }, { x: d.padX, y: d.padY, z: d.padZ, sp: 1.2, label: 'Landing' }, { wait: 8, label: 'Charging on the pad' });
    d.plan = pl;
    B.ui.focusActor('d1', true);
    B.tools.toast('Drone D1 is flying ' + Math.min(4, groups.length) + ' aisle levels from today\'s list');
  }

  // record today's count: most locations match, a few show a difference that is corrected
  function complete() {
    const t = today();
    if (!t || t.done) return;
    const R = B.rng(week() * 7 + new Date().getDay()), diffs = [];
    B.audit.by = 'Cycle count'; B.audit.ref = t.name + ' plan';
    t.list.forEach((s) => {
      if (R() < 0.022 && s.item >= 0) { const d = (R() < 0.5 ? -1 : 1) * (1 + Math.floor(R() * 2)); const before = s.qty; s.qty = Math.max(1, s.qty + d); diffs.push({ s, before }); W.updateSlot(s); }
    });
    setTimeout(() => { B.audit.by = ''; B.audit.ref = ''; }, 400);
    stats.counted += t.total; stats.matched += t.total - diffs.length;
    store.set('b100.count', JSON.stringify(stats));
    store.set(doneKey(), '1');
    B.audit.record({ action: 'Cycle count closed', code: t.total + ' locations', mat: '', name: diffs.length + ' differences corrected', qty: '', by: 'Count team and drone D1', ref: t.name });
    B.tools.toast('Count recorded: ' + t.total + ' locations, ' + diffs.length + ' differences corrected');
    return diffs;
  }
  const accuracy = () => (stats.counted ? stats.matched / stats.counted : null);

  function render(el) {
    const p = plan(), t = today(), acc = accuracy();
    todaySet = new Set(t ? t.list.map((s) => s.i) : []);
    const total = p.due.length + SHELF_BINS / 13;
    el.innerHTML = `<h4>Cycle count plan · this week</h4><p>Instead of one big yearly stock-take, a few locations are counted every working day. Class A locations are counted every 4 weeks, B every 13 weeks and C twice a year. Drone D1 counts levels 3 to 5; the team counts levels 1 and 2 and the small parts bins.</p>
      <div class="row2"><div class="stat"><b>${fmt(total)}</b><small>locations to count this week</small></div><div class="stat"><b>${acc == null ? '-' : fmt(acc * 100, 1) + '%'}</b><small>inventory record accuracy</small></div>
      <div class="stat"><b>${p.byClass.A} / ${p.byClass.B} / ${p.byClass.C}</b><small>A / B / C pallet locations</small></div><div class="stat"><b>${fmt(p.days.reduce((n, d) => n + d.droneMin, 0), 0)} min</b><small>drone flight time this week</small></div></div>
      <table><thead><tr><th>Day</th><th class="num">Drone D1</th><th class="num">Team</th><th class="num">Team time</th></tr></thead><tbody>
      ${p.days.map((d, k) => '<tr' + (t && t.name === d.name ? ' style="font-weight:700"' : '') + '><td>' + d.name + (t && t.name === d.name ? ' (today)' : '') + (d.yard ? '<br><small>plus drone D2 yard survey</small>' : '') + '</td><td class="num">' + d.drone + '<br><small>' + fmt(d.droneMin, 0) + ' min</small></td><td class="num">' + d.team + '<br><small>incl. ' + d.shelf + ' bins</small></td><td class="num">' + fmt(d.teamH, 1) + ' h</td></tr>').join('')}</tbody></table>
      ${t ? `<h4>Today: ${t.total} locations ${t.done ? '· done' : ''}</h4><div class="btnrow"><button class="btn" id="ccShow">${B.stock.mode() === 'count' ? 'Back to normal colours' : 'Show today\'s locations in orange'}</button><button class="btn" id="ccDrone">Send drone D1 to count them</button>
        ${t.done ? '' : '<button class="btn primary" id="ccDone">Record today\'s count as done</button>'}</div>` : '<p>No counts on Friday and Saturday.</p>'}
      <div class="btnrow"><button class="btn" id="ccCsv">Export this week's count sheet (CSV)</button></div>`;
    const q = (id) => el.querySelector('#' + id);
    if (q('ccShow')) q('ccShow').addEventListener('click', () => { B.stock.setColourMode(B.stock.mode() === 'count' ? '' : 'count'); if (B.stock.mode() === 'count') B.ui.setView('rack'); render(el); });
    if (q('ccDrone')) q('ccDrone').addEventListener('click', sendDrone);
    if (q('ccDone')) q('ccDone').addEventListener('click', () => { complete(); render(el); });
    q('ccCsv').addEventListener('click', () => {
      const lines = ['Day,Location,Material no,Material,System qty,Counted by,Counted qty'];
      p.days.forEach((d) => d.list.forEach((s) => { const it = B.ITEMS[s.item]; lines.push([d.name, s.code, it.mat, '"' + it.name + '"', s.qty, s.level >= 3 ? 'Drone D1' : 'Team', ''].join(',')); }));
      B.tools.download('building100-cycle-count-week.csv', lines.join('\n'));
    });
  }
  B.tools.add({ id: 'count', label: 'Cycle count', render });
  B.cycle = { plan, today, complete, accuracy, sendDrone };
})();
