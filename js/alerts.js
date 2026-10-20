/* Building 100 - smart alerts and the supervisor's daily task list */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const CAPTURE = /[?&]capture/.test(location.search);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const today = () => new Date().toISOString().slice(0, 10);
  const nearHist = [];
  let alerts = [];
  const seen = new Set();

  function build() {
    const out = [], st = B.stock.compute();
    // rows close to full
    B.RACK.rows.forEach((row, ri) => {
      const slots = B.SLOTS.filter((s) => s.row === ri), occ = slots.filter((s) => s.item >= 0 || s.reserved).length / slots.length;
      if (occ >= 0.95) out.push({ key: 'row' + row.letter, level: occ >= 0.98 ? 'bad' : 'warn', text: 'Row ' + row.letter + ' is ' + fmt(occ * 100, 0) + '% full', sub: 'New pallets of this category will be placed in other rows, with longer trips.', act: 'Show row', go: () => B.ui.focusSlot(slots.find((s) => s.item < 0) || slots[0]) });
    });
    const occ = B.occupiedCount() / B.SLOTS.length;
    if (occ >= 0.9) out.push({ key: 'racking', level: 'warn', text: 'Racking is ' + fmt(occ * 100, 0) + '% full', sub: 'Above 90% the put-away of new receipts slows down.', act: 'Forecast', go: () => B.tools.open('forecast') });
    st.belowCritical.forEach((r) => out.push({ key: 'crit' + r.it.mat, level: 'bad', text: 'Critical spare below minimum: ' + r.it.name, sub: fmt(r.qty) + ' on hand, minimum ' + fmt(r.min) + '. Lead time is long: order now.', act: r.locs.length ? 'Show stock' : '', go: () => r.locs[0] && B.ui.focusSlot(r.locs[0]) }));
    const other = st.below.filter((r) => !r.critical);
    if (other.length) out.push({ key: 'below', level: 'warn', text: other.length + ' materials below their minimum level', sub: 'See the reorder list below for suggested quantities.', act: 'Reorder list', go: () => { const e = document.getElementById('reorder'); if (e) e.scrollIntoView({ behavior: 'smooth' }); } });
    if (st.frozenPallets) out.push({ key: 'frozen', level: 'warn', text: fmt(st.frozenPallets) + ' pallets have not moved for over a year', sub: B.stock.sar(st.frozen) + ' of stock is frozen in the racks.', act: 'Stock value', go: () => B.tools.open('value') });
    B.hazmat.violations().forEach((v) => out.push({ key: 'haz' + v.a.id + v.b.id, level: 'bad', text: 'Hazmat: ' + v.a.name + ' too close to ' + v.b.name, sub: v.d.toFixed(1) + ' m apart, the rule needs ' + v.need + ' m.', act: 'Fix it', go: () => B.tools.open('hazmat') }));
    if (S.pendingOrders.length >= 4) out.push({ key: 'backlog', level: 'warn', text: S.pendingOrders.length + ' issue orders waiting for a free dock door', sub: 'Shipping is the bottleneck right now.', act: 'Show shipping', go: () => B.ui.focusZone('DSP') });
    const hourAgo = nearHist.find((h) => h.t >= S.st.t - 3600), recent = hourAgo ? S.st.nearMiss - hourAgo.n : 0;
    if (recent >= 3) out.push({ key: 'near', level: 'warn', text: recent + ' near misses in the last hour', sub: 'Forklifts and people are crossing too closely.', act: 'Safety', go: () => B.tools.open('safety') });
    const hold = B.ZONE_ITEMS.filter((z) => z.zone === 'QC');
    out.push({ key: 'qc', level: 'info', text: hold.length + ' deliveries on hold in Quality Inspection', sub: hold.map((z) => z.name).join('; '), act: 'Show QC', go: () => B.ui.focusZone('QC') });
    if (B.cycle) { const c = B.cycle.today(); if (c && !c.done) out.push({ key: 'count', level: 'info', text: 'Cycle count due today: ' + c.total + ' locations', sub: c.drone + ' by drone D1, ' + c.team + ' by the team.', act: 'Count plan', go: () => B.tools.open('count') }); }
    const rank = { bad: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
  }

  // ---------- daily task list ----------
  function tasks() {
    const st = B.stock.compute(), haz = B.hazmat.violations().length, other = st.below.filter((r) => !r.critical).length;
    const c = B.cycle ? B.cycle.today() : null;
    const full = alerts.filter((a) => a.key.startsWith('row')).map((a) => a.text.split(' ')[1]);
    return [
      ['walk', 'Start-of-shift safety walk: aisles, rack damage, fire exits and extinguishers'],
      ['fl', 'Check that every forklift has a signed pre-use checklist (' + S.forklifts.length + ' forklifts)'],
      st.belowCritical.length && ['crit', 'Raise urgent purchase requests for ' + st.belowCritical.length + ' critical spares below minimum'],
      other && ['po', 'Review ' + other + ' materials below minimum and raise purchase requests'],
      haz && ['haz', 'Fix ' + haz + ' hazmat segregation breaches in the cage'],
      ['qc', 'Decide on the deliveries on hold in Quality Inspection'],
      c && ['count', 'Complete today\'s cycle count: ' + c.total + ' locations'],
      st.frozenPallets && ['frz', 'Select 10 frozen pallets for the disposal review board'],
      full.length && ['full', 'Free space in row ' + full.join(', ') + ' before tomorrow\'s receipts'],
      ['close', 'Close the day: all trucks dispatched, dock doors locked, chargers connected'],
    ].filter(Boolean);
  }
  const doneKey = () => 'b100.tasks.' + today();
  const getDone = () => { try { return JSON.parse(store.get(doneKey()) || '{}'); } catch (e) { return {}; } };

  // ---------- header button with a badge ----------
  const btn = document.createElement('button');
  btn.className = 'btn'; btn.id = 'alertBtn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg><span>Alerts</span><b class="badge" id="alertBadge" hidden></b>';
  document.getElementById('toolsBtn').before(btn);
  btn.addEventListener('click', () => (B.tools.isOpen('alerts') ? document.getElementById('drawerClose').click() : B.tools.open('alerts')));
  const css = document.createElement('style');
  css.textContent = `#alertBtn { position: relative; } .badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--bad); color: #fff; font: 700 11px/18px var(--f-mono); text-align: center; }
    .alert { display: grid; grid-template-columns: 6px 1fr auto; gap: 10px; align-items: center; padding: 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }
    .alert i { align-self: stretch; border-radius: 3px; } .alert.bad i { background: var(--bad); } .alert.warn i { background: #e2a400; } .alert.info i { background: var(--accent); }
    .alert b { display: block; font-size: 13px; } .alert small { color: var(--muted); } .tasks label { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; padding: 4px 0; }
    .tasks label.done span { text-decoration: line-through; color: var(--muted); }`;
  document.head.appendChild(css);

  function render(el) {
    alerts = build();
    const done = getDone(), list = tasks(), st = B.stock.compute();
    const nDone = list.filter(([id]) => done[id]).length;
    el.innerHTML = `<h4>Alerts</h4><p>Checked every few seconds against the live stock, the simulation and the safety rules.</p>
      <div style="display:grid;gap:8px">${alerts.map((a, i) => '<div class="alert ' + a.level + '"><i></i><div><b>' + P.esc(a.text) + '</b><small>' + P.esc(a.sub) + '</small></div>' + (a.act ? '<button class="chip" data-a="' + i + '">' + a.act + '</button>' : '<span></span>') + '</div>').join('')}</div>
      <h4>Today's task list · ${nDone} of ${list.length} done</h4><p>Built each morning from the alerts above, for the shift supervisor. Ticks are saved in this browser for today.</p>
      <div class="tasks">${list.map(([id, t]) => '<label class="' + (done[id] ? 'done' : '') + '"><input type="checkbox" data-t="' + id + '"' + (done[id] ? ' checked' : '') + '><span>' + P.esc(t) + '</span></label>').join('')}</div>
      <h4 id="reorder">Reorder list</h4><p>Materials below their minimum. Suggested order brings stock back up to the maximum.</p>
      <table><thead><tr><th>Material</th><th class="num">On hand</th><th class="num">Min</th><th class="num">Order</th></tr></thead><tbody>
      ${st.below.sort((a, b) => b.critical - a.critical).map((r) => '<tr><td>' + (r.critical ? '<b style="color:var(--bad)">!</b> ' : '') + P.esc(r.it.name) + '</td><td class="num">' + fmt(r.qty) + '</td><td class="num">' + fmt(r.min) + '</td><td class="num">' + fmt(r.max - r.qty) + '</td></tr>').join('') || '<tr><td colspan="4">Nothing to reorder.</td></tr>'}</tbody></table>
      <div class="btnrow"><button class="btn" id="poCsv">Export purchase request list (CSV)</button></div>`;
    el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => alerts[+b.dataset.a].go()));
    el.querySelectorAll('[data-t]').forEach((c) => c.addEventListener('change', () => { const d = getDone(); d[c.dataset.t] = c.checked; store.set(doneKey(), JSON.stringify(d)); render(el); }));
    el.querySelector('#poCsv').addEventListener('click', () => B.tools.download('building100-purchase-requests.csv', ['Material no,Description,On hand,Unit,Min,Max,Order quantity,Unit price SAR,Value SAR,Critical']
      .concat(st.below.map((r) => [r.it.mat, '"' + r.it.name + '"', r.qty, r.it.unit, r.min, r.max, r.max - r.qty, r.price, (r.max - r.qty) * r.price, r.critical ? 'Yes' : ''].join(','))).join('\n')));
  }

  let t = 0;
  function check() {
    alerts = build();
    const n = alerts.filter((a) => a.level !== 'info').length, badge = document.getElementById('alertBadge');
    badge.hidden = !n; badge.textContent = n;
    alerts.filter((a) => a.level === 'bad' && !seen.has(a.key)).forEach((a, i) => { seen.add(a.key); if (!CAPTURE && i === 0 && t > 0) B.tools.toast('Alert: ' + a.text, 5000); });
  }
  B.hooks.frame.push((dt) => {
    if ((t += dt) < 3 && t > 0) return;
    t = 0.0001;
    if (!nearHist.length || S.st.t - nearHist[nearHist.length - 1].t > 300) { nearHist.push({ t: S.st.t, n: S.st.nearMiss }); if (nearHist.length > 40) nearHist.shift(); }
    check();
  });
  B.tools.add({ id: 'alerts', label: 'Alerts', render });
  setTimeout(check, 0);
  B.alerts = { list: () => (alerts = build()), tasks };
})();
