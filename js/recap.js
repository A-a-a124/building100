/* Building 19 - what happened: the supervisor picks a window (last 10 minutes, last hour, last shift) and gets the numbers, the safety picture and a written summary */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const esc = P.esc;
  const KEEP = 12 * 3600; // a little more than a shift, so "last 8 hours" is always covered

  // ---------- what the twin remembers: counters once a simulated minute, and every logged event with its time ----------
  const samples = [], log = [];
  const counters = () => ({ t: S.st.t, rec: S.st.received, ship: S.st.shipped, trucks: S.st.trucksIn, orders: S.st.ordersDone, cycle: S.st.cycleSum, near: S.st.nearMiss || 0, yields: S.st.yields || 0, gate: (S.gate || []).length });
  const KINDS = [
    [/^Inbound truck at door IN (\d+) with (\d+)/, 'truck'],
    [/^Order (\S+) shipped, cycle time (\d+)/, 'shipped'],
    [/^Near miss/, 'near'],
    [/broke down/, 'breakdown'],
    [/repaired and back|back from maintenance/, 'repair'],
    [/^Dust storm:/, 'dust'],
    [/^Dust storm over/, 'dustEnd'],
    [/^Fire alarm/, 'drill'],
    [/^Drill complete/, 'drillEnd'],
    [/^Pick error/, 'pickerr'],
  ];
  const onLog = S.onLog;
  S.onLog = () => {
    const e = S.log[0];
    if (e && !(B.timeline && B.timeline.active())) {
      const k = KINDS.find(([r]) => r.test(e.msg));
      if (k) { log.push({ t: S.st.t, kind: k[1], msg: e.msg }); while (log.length && log[0].t < S.st.t - KEEP) log.shift(); }
    }
    if (onLog) onLog();
  };
  let nextSample = -1e9;
  B.hooks.frame.push(() => {
    if (B.timeline && B.timeline.active()) return;
    // the clock was set back (a replay, a new day): forget what now lies in the future
    if (samples.length && samples[samples.length - 1].t > S.st.t + 1) { while (samples.length && samples[samples.length - 1].t > S.st.t) samples.pop(); while (log.length && log[log.length - 1].t > S.st.t) log.pop(); nextSample = S.st.t; }
    if (S.st.t >= nextSample) { nextSample = S.st.t + 60; samples.push(counters()); while (samples.length > 2 && samples[0].t < S.st.t - KEEP) samples.shift(); }
  });

  // ---------- one window, summarised ----------
  function summary(win) {
    const now = counters(), from = now.t - win;
    const base = samples.find((s) => s.t >= from) || samples[0] || now, span = now.t - base.t;
    const d = (k) => (now[k] >= base[k] ? now[k] - base[k] : now[k]); // counters reset by "reset stats" count from zero again
    const ev = log.filter((e) => e.t >= base.t);
    const det = (B.watch ? B.watch.events : []).filter((e) => e.t >= base.t);
    const byWho = {}, byType = {};
    det.forEach((e) => { byWho[e.who] = (byWho[e.who] || 0) + e.points; byType[e.type] = (byType[e.type] || 0) + 1; });
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
    const serious = det.filter((e) => e.points >= 5);
    const orders = d('orders');
    return {
      win, span, from: base.t, to: now.t, short: span < win - 90,
      trucks: d('trucks'), rec: d('rec'), ship: d('ship'), orders, cycle: orders ? d('cycle') / orders / 60 : null,
      near: d('near'), yields: d('yields'),
      det, serious, points: det.reduce((n, e) => n + e.points, 0), topWho: top(byWho), topType: top(byType),
      breakdowns: ev.filter((e) => e.kind === 'breakdown').length, dust: ev.filter((e) => e.kind === 'dust').length, drills: ev.filter((e) => e.kind === 'drill').length,
      pickErr: ev.filter((e) => e.kind === 'pickerr').length, gateMax: Math.max(0, ...samples.filter((s) => s.t >= base.t).map((s) => s.gate)),
      events: ev,
    };
  }
  // what needs the supervisor right now, whatever window was picked
  function openNow() {
    const out = [];
    const tickets = B.watch ? B.watch.open.length : 0, down = S.forklifts.filter((f) => f.down), haz = B.hazmat ? B.hazmat.violations().length : 0, exits = B.watch ? B.watch.blocked.length : 0, gate = (S.gate || []).length;
    if (tickets) out.push([tickets + ' safety ticket' + (tickets > 1 ? 's' : '') + ' waiting to be closed', () => B.tools.open('watch')]);
    if (exits) out.push([exits + ' fire exit' + (exits > 1 ? 's' : '') + ' blocked', () => B.tools.open('watch')]);
    if (haz) out.push([haz + ' hazmat storage breach' + (haz > 1 ? 'es' : ''), () => B.tools.open('hazmat')]);
    down.forEach((f) => out.push(['Forklift ' + f.n + ' out of service: ' + f.down.why, () => B.ui.followObj(f)]));
    if (gate) out.push([gate + ' truck' + (gate > 1 ? 's' : '') + ' waiting at the gate', () => B.tools.open('carriers')]);
    if (B.weather && B.weather.state.dust) out.push(['Dust storm in progress', () => B.ui.setView('yard')]);
    return out;
  }
  const RULE = (t) => (B.watch && B.watch.TYPES[t] ? B.watch.TYPES[t].name.toLowerCase() : t);
  const n = (k, one, many) => fmt(k) + ' ' + (k === 1 ? one : many || one + 's');
  const winName = (w) => (w < 3600 ? fmt(w / 60) + ' minutes' : w === 3600 ? 'hour' : fmt(w / 3600, w % 3600 ? 1 : 0) + ' hours');
  function sentence(r) {
    const head = 'Last ' + winName(r.win) + ' (' + S.clock(r.from) + ' to ' + S.clock(r.to) + (r.short ? ', since the twin started recording' : '') + '): ';
    const flow = n(r.trucks, 'truck') + ' arrived and ' + n(r.rec, 'pallet') + ' were put away; ' + n(r.ship, 'pallet') + ' shipped and ' + n(r.orders, 'order') + ' completed' + (r.cycle ? ', taking ' + fmt(r.cycle, 0) + ' min each on average' : '') + '.';
    const safe = r.det.length || r.near
      ? ' Safety: ' + n(r.det.length, 'camera detection') + (r.topWho ? ' (most: ' + r.topWho[0] + '; commonest rule: ' + RULE(r.topType[0]) + ')' : '') + ', ' + n(r.near, 'near miss', 'near misses') + (r.serious.length ? ', ' + n(r.serious.length, 'serious event') : '') + '.'
      : ' Safety: nothing flagged.';
    const other = [r.breakdowns && n(r.breakdowns, 'forklift breakdown'), r.dust && n(r.dust, 'dust storm'), r.drills && n(r.drills, 'fire drill'), r.pickErr && n(r.pickErr, 'pick error'), r.gateMax && 'up to ' + n(r.gateMax, 'truck') + ' queued at the gate'].filter(Boolean);
    const now = openNow();
    return head + flow + safe + (other.length ? ' Also: ' + other.join(', ') + '.' : '') + (now.length ? ' Open now: ' + now.map((q) => q[0]).join('; ') + '.' : ' Nothing open right now.');
  }

  // ---------- the tab ----------
  const WINS = [[600, '10 min'], [1800, '30 min'], [3600, '1 hour'], [4 * 3600, '4 hours'], [8 * 3600, '8 hours']];
  let win = 3600, root = null, tick = 0;
  const ICON = { truck: 'Truck', shipped: 'Shipped', near: 'Near miss', breakdown: 'Breakdown', repair: 'Repaired', dust: 'Weather', dustEnd: 'Weather', drill: 'Drill', drillEnd: 'Drill', pickerr: 'Pick error' };
  function results() {
    if (!root) return;
    const box = root.querySelector('#rcOut'); if (!box) return;
    const r = summary(win), now = openNow();
    const items = r.events.filter((e) => e.kind !== 'repair' && e.kind !== 'dustEnd').map((e) => ({ t: e.t, tag: ICON[e.kind], text: e.msg }))
      .concat(r.det.filter((e) => e.points >= 4).map((e) => ({ t: e.t, tag: 'Camera', text: e.who + ': ' + B.watch.TYPES[e.type].name + ' (' + e.zone + ')', e })))
      .sort((a, b) => b.t - a.t).slice(0, 18);
    box.innerHTML = `<p class="rcSent">${esc(sentence(r))}</p>
      <div class="row2"><div class="stat"><b>${fmt(r.trucks)}</b><small>trucks arrived</small></div><div class="stat"><b>${fmt(r.rec)}</b><small>pallets put away</small></div>
      <div class="stat"><b>${fmt(r.ship)}</b><small>pallets shipped, ${n(r.orders, 'order')} completed</small></div><div class="stat"><b>${r.cycle ? fmt(r.cycle, 0) + ' min' : '-'}</b><small>average order cycle</small></div>
      <div class="stat"><b>${fmt(r.det.length)}</b><small>camera detections, ${fmt(r.points)} points</small></div><div class="stat"><b>${fmt(r.near + r.serious.length)}</b><small>serious events: ${n(r.near, 'near miss', 'near misses')}, ${fmt(r.serious.length)} high-risk</small></div>
      <div class="stat"><b>${fmt(r.breakdowns)}</b><small>forklift breakdowns</small></div><div class="stat"><b>${fmt(r.gateMax)}</b><small>most trucks queued at the gate</small></div></div>
      <h4>Needs attention now</h4>
      ${now.length ? now.map((q, i) => '<div class="wev"><div><b>' + esc(q[0]) + '</b></div><button class="chip" data-now="' + i + '">Show</button></div>').join('') : '<p>Nothing open.</p>'}
      <h4>What happened</h4>
      ${items.length ? items.map((q, i) => '<div class="wev"><div><b>' + S.clock(q.t) + ' · ' + q.tag + '</b><small>' + esc(q.text) + '</small></div>' + (q.e ? '<button class="chip" data-ev="' + i + '">Evidence</button>' : '') + '</div>').join('') : '<p>Nothing to report in this window yet.</p>'}
      <p>Camera detections are simulated. Times are simulation time.</p>`;
    box.querySelectorAll('[data-now]').forEach((b) => b.addEventListener('click', () => now[+b.dataset.now][1]()));
    box.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => B.watch.evidence(items[+b.dataset.ev].e)));
    root.querySelectorAll('[data-win]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.win === win));
  }
  function render(el) {
    root = el;
    el.innerHTML = `<h4>What happened</h4><p>Pick a window and the twin sums it up: trucks, pallets, orders, safety, breakdowns, and what is still open.</p>
      <div class="wseg rcWins">${WINS.map(([s, l]) => '<button data-win="' + s + '" aria-pressed="' + (s === win) + '">' + l + '</button>').join('')}</div>
      <label class="f">Or type your own: last <span class="rcRow"><input type="number" id="rcN" min="1" max="12" step="1" value="${win >= 3600 ? win / 3600 : win / 60}"><select id="rcU"><option value="60"${win < 3600 ? ' selected' : ''}>minutes</option><option value="3600"${win >= 3600 ? ' selected' : ''}>hours</option></select></span></label>
      <div class="btnrow"><button class="btn primary" id="rcCopy">Copy summary</button><button class="btn" id="rcAsk">Read it to me in Ask the twin</button></div>
      <div id="rcOut"></div>`;
    el.querySelectorAll('[data-win]').forEach((b) => b.addEventListener('click', () => { win = +b.dataset.win; const nIn = el.querySelector('#rcN'), u = el.querySelector('#rcU'); u.value = win >= 3600 ? '3600' : '60'; nIn.value = win / +u.value; results(); }));
    const custom = () => { const v = +el.querySelector('#rcN').value, u = +el.querySelector('#rcU').value; if (v > 0) { win = Math.min(KEEP, Math.max(60, v * u)); results(); } };
    el.querySelector('#rcN').addEventListener('input', custom);
    el.querySelector('#rcU').addEventListener('change', custom);
    el.querySelector('#rcCopy').addEventListener('click', async () => { const t = sentence(summary(win)); try { await navigator.clipboard.writeText(t); B.tools.toast('Summary copied, ready to paste into a message or the shift log'); } catch (e) { window.prompt('Copy this summary:', t); } });
    el.querySelector('#rcAsk').addEventListener('click', () => { const q = document.getElementById('askQ'), f = document.getElementById('askF'); if (q && f) { q.value = 'What happened in the last ' + winName(win) + '?'; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); } });
    results();
  }
  const css = document.createElement('style');
  css.textContent = `.rcSent { color: var(--ink) !important; font-size: 14px !important; line-height: 1.5; background: var(--surface-2); border: 1px solid var(--line); border-left: 4px solid var(--accent-strong); border-radius: 10px; padding: 10px 12px; }
    .rcWins { grid-template-columns: repeat(5, 1fr) !important; } .rcRow { display: flex; gap: 6px; } .rcRow input { width: 90px !important; } .rcRow select { width: auto !important; }`;
  document.head.appendChild(css);
  B.tools.add({ id: 'recap', label: 'What happened', render });
  // keep the numbers live while the tab is open, without touching the controls being used
  B.hooks.frame.push((dt) => { if ((tick += dt) > 2) { tick = 0; if (B.tools.isOpen('recap') && root && !root.contains(document.activeElement)) results(); } });
  B.recap = { summary, sentence, openNow, setWindow: (s) => { win = s; }, open: (s) => { if (s) win = s; B.tools.open('recap'); }, samples, log };
})();
