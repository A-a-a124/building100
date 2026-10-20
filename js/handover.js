/* Building 100 - shift handover: at every shift change, a summary for the incoming shift of what was done and what is still open */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d), esc = (t) => P.esc(String(t));
  const CAPTURE = /[?&]capture/.test(location.search);
  const shiftOf = () => B.env.shiftName().split(' · ')[0];
  const history = [];

  function snap() {
    return { name: shiftOf(), t: S.st.t, received: S.st.received, shipped: S.st.shipped, orders: S.st.ordersDone, cycleSum: S.st.cycleSum, near: S.st.nearMiss, yields: S.st.yields || 0,
      breakdowns: B.maint ? B.maint.stats.breakdowns : 0, moves: B.audit ? B.audit.list.length : 0 };
  }
  let start = snap();

  function build(endName) {
    const now = snap(), d = (k) => Math.max(0, now[k] - start[k]);
    const orders = d('orders'), cyc = orders ? d('cycleSum') / orders / 60 : null;
    const down = S.forklifts.filter((f) => f.down);
    const alerts = B.alerts.list().filter((a) => a.level !== 'info');
    const c = B.cycle.today(), w = B.weather ? B.weather.state : null;
    return {
      from: start.name, to: endName || 'next shift', start: S.clock(start.t), end: S.clock(S.st.t), at: new Date(),
      done: { received: d('received'), shipped: d('shipped'), orders, cycle: cyc, moves: d('moves') },
      safety: { near: d('near'), yields: d('yields'), breakdowns: d('breakdowns') },
      open: { tasks: S.tasks.length, pending: S.pendingOrders.length, trucks: S.trucks.length, down: down.map((f) => 'Forklift ' + f.n + ': ' + (f.down.pm ? 'preventive maintenance' : f.down.why) + ', back in about ' + Math.max(1, Math.round((f.down.until - S.st.t) / 60)) + ' min'),
        alerts: alerts.slice(0, 6).map((a) => ({ level: a.level, text: a.text })), count: c ? (c.done ? 'Today\'s cycle count is done' : 'Today\'s cycle count is still open: ' + c.total + ' locations') : '',
        weather: w ? Math.round(w.temp) + '°C, ' + (w.dust ? 'dust storm, yard drone grounded' : B.weather.heatBan() ? 'midday heat, outdoor work paused' : 'clear') : '' },
      note: '',
    };
  }
  function html(h) {
    const li = (t) => '<li>' + esc(t) + '</li>';
    return `<div class="hoGrid"><div class="stat"><b>${fmt(h.done.received)}</b><small>pallets put away</small></div><div class="stat"><b>${fmt(h.done.shipped)}</b><small>pallets shipped</small></div>
      <div class="stat"><b>${fmt(h.done.orders)}</b><small>orders completed</small></div><div class="stat"><b>${h.done.cycle == null ? '-' : fmt(h.done.cycle, 1) + ' min'}</b><small>average order cycle</small></div></div>
      <h5>Still open for the ${esc(h.to.toLowerCase())}</h5><ul>${[h.open.tasks + ' pallet moves in progress or waiting', h.open.pending + ' issue orders waiting for a dock door', h.open.trucks + ' trucks at the doors'].concat(h.open.down, h.open.count ? [h.open.count] : []).map(li).join('')}</ul>
      <h5>Open alerts</h5><ul>${h.open.alerts.map((a) => '<li class="' + a.level + '">' + esc(a.text) + '</li>').join('') || '<li>None</li>'}</ul>
      <h5>Safety this shift</h5><ul>${li(h.safety.near + ' near misses, ' + h.safety.yields + ' times a forklift stopped or gave way')}${li(h.safety.breakdowns + ' forklift breakdowns')}${h.open.weather ? li('Weather now: ' + h.open.weather) : ''}</ul>
      ${h.note ? '<h5>Notes from the outgoing shift</h5><p>' + esc(h.note) + '</p>' : ''}`;
  }

  // ---------- pop-up at the shift change ----------
  const card = document.createElement('div');
  card.className = 'hocard'; card.hidden = true; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Shift handover');
  B.three.stage.appendChild(card);
  const css = document.createElement('style');
  css.textContent = `.hocard { position: absolute; z-index: 7; top: 60px; left: 50%; transform: translateX(-50%); width: min(460px, calc(100% - 32px)); max-height: calc(100% - 90px); overflow-y: auto;
      background: var(--surface); border: 1px solid var(--line); border-top: 4px solid var(--accent-strong); border-radius: 12px; box-shadow: var(--shadow); padding: 14px 16px; display: grid; gap: 8px; font-size: 13px; }
    .hocard h4 { margin: 0; font: 700 16px var(--f-display); } .hocard small.sub { color: var(--muted); } .hocard h5, .dbody h5 { margin: 6px 0 0; font: 700 13px var(--f-display); }
    .hocard ul, .dbody .ho ul { margin: 0; padding-inline-start: 18px; display: grid; gap: 2px; } .hocard li.bad, .dbody li.bad { color: var(--bad); }
    .hoGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; } .hoGrid .stat b { font-size: 16px; } .hocard textarea, .dbody textarea { width: 100%; box-sizing: border-box; min-height: 54px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); font: inherit; }
    body.cine .hocard { display: none; } @media (max-width: 560px) { .hoGrid { grid-template-columns: 1fr 1fr; } }`;
  document.head.appendChild(css);
  let current = null;
  function show(h) {
    current = h;
    card.innerHTML = `<h4>Shift handover · ${esc(h.from)} to ${esc(h.to)}</h4><small class="sub">${h.start} to ${h.end}</small>${html(h)}
      <label class="f">Note for the incoming shift<textarea id="hoNote" placeholder="e.g. Door OUT 2 sticks, call maintenance">${esc(h.note)}</textarea></label>
      <div class="btnrow"><button class="btn primary" id="hoOk">Got it</button><button class="btn" id="hoAll">All handovers</button></div>`;
    card.hidden = false;
    card.querySelector('#hoNote').addEventListener('input', (e) => (h.note = e.target.value));
    card.querySelector('#hoOk').addEventListener('click', () => (card.hidden = true));
    card.querySelector('#hoAll').addEventListener('click', () => { card.hidden = true; B.tools.open('handover'); });
  }
  function handover(endName) {
    const h = build(endName);
    history.unshift(h); if (history.length > 12) history.pop();
    S.addLog('Shift handover: ' + h.from + ' to ' + h.to, 'info');
    start = snap();
    if (!CAPTURE) show(h);
    return h;
  }
  let last = shiftOf();
  B.hooks.frame.push(() => { const s = shiftOf(); if (s !== last) { const prev = last; last = s; start.name = prev; handover(s); } });

  function render(el) {
    const live = build(null);
    el.innerHTML = `<h4>Shift handover</h4><p>At every shift change a summary pops up for the incoming shift: what was done, what is still open and what to watch. Here is the current shift so far, and the earlier handovers.</p>
      <div class="card ho"><b>${esc(live.from)} so far · ${live.start} to ${live.end}</b>${html(live)}</div>
      <div class="btnrow"><button class="btn primary" id="hoNow">Show the handover now</button><button class="btn" id="hoCsv">Export handovers (CSV)</button></div>
      ${history.map((h) => `<div class="card ho"><b>${esc(h.from)} to ${esc(h.to)} · ${h.start} to ${h.end}</b>${html(h)}</div>`).join('')}`;
    el.querySelector('#hoNow').addEventListener('click', () => { const h = build('next shift'); show(h); });
    el.querySelector('#hoCsv').addEventListener('click', () => B.tools.download('building100-handovers.csv', ['From,To,Start,End,Put away,Shipped,Orders,Avg cycle min,Near misses,Breakdowns,Open tasks,Waiting orders,Note']
      .concat(history.map((h) => [h.from, h.to, h.start, h.end, h.done.received, h.done.shipped, h.done.orders, h.done.cycle == null ? '' : h.done.cycle.toFixed(1), h.safety.near, h.safety.breakdowns, h.open.tasks, h.open.pending, '"' + h.note.replace(/"/g, '""') + '"'].join(','))).join('\n')));
  }
  B.tools.add({ id: 'handover', label: 'Handover', render });
  B.handover = { build, handover, history: () => history, show };
})();
