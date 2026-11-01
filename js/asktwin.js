/* Building 100 - ask the twin: type a question in plain English, get a live answer and fly to the place (fixed rules, no outside AI) */
(function () {
  const B = window.B100, S = B.sim, W = B.world, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const sar = (n) => B.stock.sar(n);
  const stocked = () => B.SLOTS.filter((s) => s.item >= 0);
  // find a material mentioned in the question
  function material(q) {
    const words = q.toLowerCase().replace(/[^a-z0-9 -]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['the', 'where', 'what', 'which', 'oldest', 'how', 'many', 'much', 'pallets', 'pallet', 'stock', 'value', 'find', 'show', 'our', 'are', 'for', 'have', 'there', 'worth', 'newest', 'most'].includes(w));
    let best = null, bs = 0;
    B.ITEMS.forEach((it) => { const n = it.name.toLowerCase(); let sc = 0; words.forEach((w) => { const stem = w.replace(/s$/, ''); if (n.includes(stem)) sc += stem.length; }); if (sc > bs) { bs = sc; best = it; } });
    return best;
  }
  const rowsFill = () => B.RACK.rows.map((r, i) => ({ r, i, f: B.SLOTS.filter((s) => s.row === i && s.item >= 0).length / (B.RACK.bays * B.RACK.levels * 2) })).sort((a, b) => b.f - a.f);
  const RULES = [
    [/oldest|longest|not moved|stuck/i, (q) => { const it = material(q), pool = stocked().filter((s) => !it || s.item === it.i).sort((a, b) => b.days - a.days), s = pool[0]; return s ? { text: 'The oldest ' + (it ? it.name.toLowerCase() : 'pallet') + ' is at ' + s.code + ': no movement for ' + fmt(s.days) + ' days.', go: () => B.ui.focusSlot(s) } : null; }],
    [/how many|how much|quantity|do we have/i, (q) => { const it = material(q); if (!it) { const n = stocked().length; return { text: fmt(n) + ' pallets are in the racks, ' + fmt((n / B.SLOTS.length) * 100, 1) + '% of the positions.' }; } const l = B.SLOTS.filter((s) => s.item === it.i); return { text: fmt(l.reduce((a, s) => a + s.qty, 0)) + ' ' + it.name + ' on hand in ' + l.length + ' locations, worth ' + sar(l.reduce((a, s) => a + s.qty * B.stock.price(it), 0)) + '.', go: () => l[0] && B.ui.focusSlot(l[0]) }; }],
    [/where|find|locate|show/i, (q) => { const it = material(q); if (it) { const l = B.SLOTS.filter((s) => s.item === it.i).sort((a, b) => a.level - b.level); return l.length ? { text: it.name + ' is in ' + l.length + ' locations. The easiest to reach is ' + l[0].code + ' (level ' + l[0].level + ').', go: () => B.ui.focusSlot(l[0]) } : { text: it.name + ' is out of stock in the racks.' }; } return null; }],
    [/fullest|most full|which row/i, () => { const r = rowsFill()[0]; return { text: 'Row ' + r.r.letter + ' is the fullest at ' + fmt(r.f * 100, 0) + '%.', go: () => B.ui.focusSlot(B.SLOTS.find((s) => s.row === r.i && s.bay === 12)) }; }],
    [/emptiest|most space|free space|room/i, () => { const r = rowsFill().pop(); return { text: 'Row ' + r.r.letter + ' has the most room, at ' + fmt(r.f * 100, 0) + '% full.', go: () => B.ui.focusSlot(B.SLOTS.find((s) => s.row === r.i && s.bay === 12)) }; }],
    [/door|dock|gate|queue/i, () => { const a = W.doorsIn.concat(W.doorsOut).filter((d) => S.trucks.some((t) => t.door === d)), g = (S.gate || []).length; return { text: a.length + ' of 8 doors have a truck now' + (a.length ? ': ' + a.map((d) => (W.doorsIn.includes(d) ? 'IN ' : 'OUT ') + d.n).join(', ') : '') + '. ' + g + ' trucks are waiting at the gate.', go: () => B.ui.setView('rcv') }; }],
    [/late|carrier|transport|truck/i, () => { const c = B.carriers.recs.filter((r) => r.docked != null); if (!c.length) return { text: 'No truck has reached a door yet.' }; const by = {}; c.forEach((r) => { by[r.carrier] = by[r.carrier] || { n: 0, late: 0 }; by[r.carrier].n++; if (r.gate - r.appt > 300) by[r.carrier].late++; }); const w = Object.entries(by).sort((a, b) => b[1].late / b[1].n - a[1].late / a[1].n)[0]; return { text: w[0] + ' is the least punctual so far: ' + w[1].late + ' of ' + w[1].n + ' trucks late.', go: () => B.tools.open('carriers') }; }],
    [/forklift|battery|fleet/i, () => { const f = S.forklifts, low = f.slice().sort((a, b) => (a.battery || 0) - (b.battery || 0))[0], d = f.filter((q) => q.down).length, busy = f.filter((q) => q.task).length; return { text: busy + ' of ' + f.length + ' forklifts have a job, ' + d + ' broken down. Lowest battery: forklift ' + low.n + ' at ' + Math.round(low.battery || 0) + '%.', go: () => B.tools.open('fleet') }; }],
    [/frozen|dead stock|slow/i, () => { const st = B.stock.compute(); return { text: fmt(st.frozenPallets) + ' pallets frozen for over a year, worth ' + sar(st.frozen) + ', costing ' + sar(st.holdFrozen) + ' a year to keep.', go: () => B.tools.open('value') }; }],
    [/value|worth|money|riyal|sar/i, () => { const st = B.stock.compute(); return { text: 'Total stock is worth ' + sar(st.total) + ', of which ' + sar(st.rackValue) + ' is in the racking.', go: () => B.tools.open('value') }; }],
    [/owner|contractor|aramco|company/i, () => ({ text: 'Stock is held for ' + B.owners.OWNERS.map((o) => o.id).join(', ') + '. The Owners tab shows space and charges for each.', go: () => B.tools.open('owners') })],
    [/near miss|danger|safe|accident|risk/i, () => ({ text: fmt(S.st.nearMiss || 0) + ' near misses so far. Forklifts gave way ' + fmt(S.st.yields || 0) + ' times. Hazmat breaches: ' + B.hazmat.violations().length + '.', go: () => B.tools.open('safety') })],
    [/hazmat|chemical|fire|cylinder/i, () => { const v = B.hazmat.violations(); return { text: v.length ? v.length + ' hazmat breaches, for example ' + v[0].a.name + ' only ' + v[0].d.toFixed(1) + ' m from ' + v[0].b.name + '.' : 'The hazmat cage passes every rule.', go: () => B.tools.open('hazmat') }; }],
    [/next|tomorrow|later|will|predict|forecast|future/i, () => { const e = B.predict.events(B.predict.forecast())[0]; return { text: 'Looking 8 hours ahead: ' + e.text + '.', go: () => B.tools.open('predict') }; }],
    [/best|improve|recommend|should we|invest/i, () => { const r = B.roi.evaluate().filter((q) => q.payback < Infinity && q.id !== 'custom').sort((a, b) => a.payback - b.payback)[0]; return { text: 'Best move now: ' + r.name.toLowerCase() + ', with a 3-year net of ' + sar(r.three) + '.', go: () => B.tools.open('roi') }; }],
    [/weather|dust|hot|temperature/i, () => { const w = B.weather.state; return { text: Math.round(w.temp) + '°C, wind ' + Math.round(w.wind) + ' km/h' + (w.dust ? ', dust storm: yard drone grounded.' : '.'), go: () => B.tools.open('weather') }; }],
    [/cycle|how long|order time/i, () => { const k = S.kpis(); return { text: k.cycle ? 'Orders take about ' + fmt(k.cycle, 0) + ' minutes from order to truck.' : 'No order has shipped yet in this session.', go: () => B.why.show('cycle') }; }],
  ];
  function answer(q) {
    for (const [re, fn] of RULES) { if (re.test(q)) { const a = fn(q); if (a) return a; } }
    const it = material(q);
    if (it) return RULES[2][1]('where ' + q);
    return { text: 'I can answer about locations, stock, doors, trucks, forklifts, safety, value and the next 8 hours. Try one of the examples.' };
  }

  // the box sits at the top of the left panel
  const EX = ['Where is the oldest valve?', 'Which door is busy?', 'Which row is fullest?', 'What happens next?', 'How many pressure gauges do we have?', 'What should we improve?'];
  const sec = document.createElement('div');
  sec.className = 'sec asksec';
  sec.innerHTML = '<h2>Ask the twin</h2><form id="askF" class="search"><input id="askQ" placeholder="Ask a question in English" autocomplete="off" aria-label="Ask the twin a question"></form><div class="chips" id="askEx"></div><div class="askA" id="askA" hidden></div>';
  const panel = document.getElementById('panel'); panel.insertBefore(sec, panel.firstChild);
  const css = document.createElement('style');
  css.textContent = `.askA { margin-top: 8px; padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--line); border-left: 4px solid var(--accent-strong); border-radius: 10px; font-size: 13.5px; line-height: 1.4; } .asksec .search input { width: 100%; }`;
  document.head.appendChild(css);
  const $ = (id) => document.getElementById(id);
  $('askEx').innerHTML = EX.slice(0, 3).map((e) => '<button class="chip" type="button">' + e + '</button>').join('');
  let shown = 0;
  function ask(q) {
    const a = answer(q), box = $('askA');
    box.hidden = false; box.textContent = '';
    // the answer types itself out, then the camera goes there
    let i = 0; const id = ++shown;
    const step = () => { if (id !== shown) return; i += 3; box.textContent = a.text.slice(0, i); if (i < a.text.length) setTimeout(step, 12); };
    step();
    if (a.go) setTimeout(() => { if (id === shown) a.go(); }, 350);
    return a;
  }
  $('askF').addEventListener('submit', (e) => { e.preventDefault(); const q = $('askQ').value.trim(); if (q) ask(q); });
  $('askEx').addEventListener('click', (e) => { if (e.target.matches('button')) { $('askQ').value = e.target.textContent; ask(e.target.textContent); } });
  B.ask = { answer, ask };
})();
