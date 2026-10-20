/* Building 100 - stock economics: value in SAR, ABC / XYZ classes, min / max levels, frozen stock */
(function () {
  const B = window.B100, W = B.world, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);

  // sample unit prices in SAR (an imported "Unit Price" column replaces these)
  const PRICE = { 'Gate Valve': 6200, 'Ball Valve': 1450, 'Check Valve': 2900, 'Pressure Relief Valve': 4800, 'Butterfly Valve': 5200, 'Weld Neck Flange': 520,
    '90 Degree Elbow': 180, 'Equal Tee': 240, 'Concentric Reducer': 150, 'Spiral Wound Gasket': 38, 'B7 Stud Bolts with Nuts': 22, 'RTJ Ring Gasket': 65,
    'Power Cable Reel': 68000, 'Electric Motor': 24000, 'Circuit Breaker': 7800, 'Explosion-Proof Light Fitting': 2100, 'Deep Groove Ball Bearing': 640,
    'Pump Mechanical Seal': 5600, 'Turbine Lube Oil Filter': 380, 'V-Belt': 95, 'Pressure Transmitter': 5400, 'RTD Temperature Sensor': 780, 'Control Valve': 36000,
    'Pressure Gauge': 210, 'Safety Helmet': 45, 'Safety Boots': 260, 'Emergency Escape Breathing Device': 1900, 'Chemical-Resistant Gloves': 18, 'Lube Oil Drum': 2400,
    'Industrial Grease': 310, 'Welding Electrodes': 14, 'Cutting Discs': 9 };
  const CAT_PRICE = { valve: 3500, flange: 260, gasket: 40, elec: 6000, mech: 900, inst: 2500, ppe: 120, cons: 60 };
  const ZPRICE = { M: 210, DR: 1900, PL: 240, CY: 650, EA: 1200, RL: 52000 };
  // supplier lead time in weeks, by category
  const LEAD = { valve: 16, flange: 8, gasket: 6, elec: 20, mech: 10, inst: 14, ppe: 4, cons: 3 };
  const CRITICAL = /relief|control valve|motor|mechanical seal|eebd|breathing|transmitter|circuit breaker/i;
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

  const price = (it) => it.price || PRICE[it.name] || Math.round(CAT_PRICE[it.cat] * (0.5 + (hash(it.mat) % 100) / 100));
  const zonePrice = (z) => ZPRICE[z.unit] || 500;

  // 13 weeks of issues per material: sample history, scaled to "Monthly Usage" when imported
  function demand(it, onHand) {
    const R = B.rng(hash(it.mat + it.name));
    const cover = 4 + Math.pow(R(), 1.3) * 90; // weeks of stock on hand
    const mean = it.usage ? it.usage / 4.33 : Math.max(0.05, onHand / cover);
    const lumpy = CRITICAL.test(it.name) || R() < 0.2, amp = 0.15 + R() * 1.3, weeks = [];
    for (let w = 0; w < 13; w++) {
      if (lumpy) weeks.push(R() < 0.18 ? (mean / 0.18) * (0.5 + R()) : 0);
      else weeks.push(Math.max(0, mean * (1 + amp * (R() - 0.5) * 2)));
    }
    const m = weeks.reduce((a, b) => a + b, 0) / 13;
    const sd = Math.sqrt(weeks.reduce((a, b) => a + (b - m) * (b - m), 0) / 13);
    return { weeks, mean: m || mean, cv: m ? sd / m : 2 };
  }

  let cache = null, cacheT = -1;
  function compute(force) {
    const now = performance.now();
    if (cache && !force && now - cacheT < 1500) return cache;
    const rows = B.ITEMS.map((it) => ({ it, qty: 0, pallets: 0, value: 0, frozen: 0, slow: 0, days: 0, maxDays: 0, locs: [] }));
    const byRow = B.RACK.rows.map((r) => ({ letter: r.letter, value: 0, pallets: 0, frozen: 0 }));
    let frozenPallets = 0, slowPallets = 0;
    B.SLOTS.forEach((s) => {
      if (s.item < 0) return;
      const r = rows[s.item]; if (!r) return;
      const v = s.qty * price(r.it);
      r.qty += s.qty; r.pallets++; r.value += v; r.days += s.days; r.maxDays = Math.max(r.maxDays, s.days); r.locs.push(s);
      byRow[s.row].value += v; byRow[s.row].pallets++;
      if (s.days >= 365) { r.frozen += v; byRow[s.row].frozen += v; frozenPallets++; } else if (s.days >= 180) { r.slow += v; slowPallets++; }
    });
    rows.forEach((r) => {
      r.days = r.pallets ? r.days / r.pallets : 0;
      r.price = price(r.it);
      const d = demand(r.it, r.qty);
      r.weekly = d.mean; r.cv = d.cv; r.weeks = d.weeks;
      r.annual = d.mean * 52 * r.price;
      const lt = LEAD[r.it.cat] || 8;
      r.min = Math.ceil(d.mean * lt * 0.35 + 1.65 * d.mean * Math.min(1.2, Math.max(0.3, d.cv)) * Math.sqrt(lt));
      r.max = Math.max(r.min + 1, Math.ceil(r.min + d.mean * 8));
      r.critical = CRITICAL.test(r.it.name);
      r.below = r.qty < r.min;
      r.over = r.qty > r.max * 3;
      r.xyz = r.cv < 0.5 ? 'X' : r.cv < 1 ? 'Y' : 'Z';
    });
    // ABC on annual consumption value: top 80% A, next 15% B, rest C
    const total = rows.reduce((n, r) => n + r.annual, 0) || 1;
    let acc = 0;
    rows.slice().sort((a, b) => b.annual - a.annual).forEach((r) => { acc += r.annual; r.abc = acc / total <= 0.8 || acc === r.annual ? 'A' : acc / total <= 0.95 ? 'B' : 'C'; });
    const zones = {};
    B.ZONE_ITEMS.forEach((z) => (zones[z.zone] = (zones[z.zone] || 0) + z.qty * zonePrice(z)));
    const rackValue = rows.reduce((n, r) => n + r.value, 0);
    zones.RACK = rackValue;
    cache = {
      rows, byRow, zones, rackValue, total: Object.values(zones).reduce((a, b) => a + b, 0),
      frozen: rows.reduce((n, r) => n + r.frozen, 0), slow: rows.reduce((n, r) => n + r.slow, 0), frozenPallets, slowPallets,
      below: rows.filter((r) => r.below && r.pallets >= 0), belowCritical: rows.filter((r) => r.below && r.critical),
    };
    cacheT = now;
    return cache;
  }
  const sar = (n) => (n >= 1e6 ? 'SAR ' + fmt(n / 1e6, 2) + 'M' : n >= 1e4 ? 'SAR ' + fmt(n / 1e3, 0) + 'K' : 'SAR ' + fmt(n, 0));

  // ---------- pallet colours by ABC class ----------
  const ABC_COL = { A: '#d64541', B: '#e2a400', C: '#3c8d4f' };
  let colourMode = '';
  const baseColour = W.colorForSlot;
  W.colorForSlot = function (s, out) {
    if (colourMode === 'abc') { const r = compute().rows[s.item]; return out.set(ABC_COL[r ? r.abc : 'C']); }
    if (colourMode && B.colourModes && B.colourModes[colourMode]) return B.colourModes[colourMode](s, out);
    return baseColour(s, out);
  };
  function setColourMode(m) {
    colourMode = m;
    W.setHeatmap(m ? false : W.heatmap);
    const cb = document.getElementById('lyHeat'); if (cb && m) cb.checked = false;
  }

  // ---------- location card: value and stock level ----------
  const show = P.showSlot;
  P.showSlot = function (s) {
    show(s);
    if (s.item < 0) return;
    const r = compute().rows[s.item];
    if (!r) return;
    const st = r.below ? '<span class="pill warn"><i></i>Below minimum: reorder</span>' : r.over ? '<span class="pill"><i></i>Overstocked</span>' : '<span class="pill"><i style="color:var(--ok)"></i>Within min / max</span>';
    document.getElementById('details').insertAdjacentHTML('beforeend', `<div class="card stockcard"><div class="kicker">Value and stock level</div>
      <div class="chips"><span class="pill"><i style="color:${ABC_COL[r.abc]}"></i>Class ${r.abc}${r.xyz}</span>${st}${r.critical ? '<span class="pill warn"><i></i>Critical spare</span>' : ''}</div>
      <dl class="kv"><dt>This pallet</dt><dd>${sar(s.qty * r.price)}</dd><dt>Unit price</dt><dd>${sar(r.price)}</dd>
      <dt>Total on hand</dt><dd>${fmt(r.qty)} in ${r.pallets} locations</dd><dt>Min / max</dt><dd>${fmt(r.min)} / ${fmt(r.max)}</dd>
      <dt>Average use</dt><dd>${fmt(r.weekly, 1)} a week</dd></dl></div>`);
  };

  // ---------- Stock value tab ----------
  function render(el) {
    const c = compute(true);
    const cell = (a, x) => { const g = c.rows.filter((r) => r.abc === a && r.xyz === x && r.pallets); return { n: g.length, v: g.reduce((s, r) => s + r.value, 0) }; };
    const frozenTop = c.rows.filter((r) => r.frozen > 0).sort((a, b) => b.frozen - a.frozen).slice(0, 8);
    el.innerHTML = `<h4>Stock value</h4><p>Value of everything in Building 100 and the open yard. Prices are sample figures until you load a file with a Unit Price column in the Data tab.</p>
      <div class="row2"><div class="stat"><b>${sar(c.total)}</b><small>total stock value</small></div><div class="stat"><b>${sar(c.rackValue)}</b><small>in the pallet racking</small></div>
      <div class="stat"><b style="color:var(--bad)">${sar(c.frozen)}</b><small>frozen: not moved for a year (${fmt(c.frozenPallets)} pallets)</small></div>
      <div class="stat"><b>${sar(c.slow)}</b><small>slow: 6 to 12 months (${fmt(c.slowPallets)} pallets)</small></div></div>
      <h4>ABC / XYZ classes</h4><p><b>A B C</b> ranks materials by yearly consumption value (A = top 80%). <b>X Y Z</b> shows how steady demand is (X = steady, Z = irregular).</p>
      <table class="abc"><thead><tr><th></th><th class="num">X steady</th><th class="num">Y variable</th><th class="num">Z irregular</th></tr></thead><tbody>
      ${['A', 'B', 'C'].map((a) => '<tr><th><i class="dot" style="background:' + ABC_COL[a] + '"></i>' + a + '</th>' + ['X', 'Y', 'Z'].map((x) => { const q = cell(a, x); return '<td class="num">' + q.n + ' items<br><small>' + sar(q.v) + '</small></td>'; }).join('') + '</tr>').join('')}</tbody></table>
      <p><b>AZ</b> items are costly and unpredictable: keep them as insurance spares and review each one. <b>CX</b> items can move to automatic reordering.</p>
      <h4>Where is the money sitting still?</h4><p>Each dot is a material: further right means longer without movement, higher means more value.</p>
      <canvas id="stScatter" width="840" height="380"></canvas>
      <h4>Biggest frozen stock</h4><table><thead><tr><th>Material</th><th class="num">Frozen value</th><th class="num">Oldest</th></tr></thead><tbody>
      ${frozenTop.map((r) => '<tr data-slot="' + r.locs.sort((a, b) => b.days - a.days)[0].i + '" style="cursor:pointer"><td>' + P.esc(r.it.name) + '</td><td class="num">' + sar(r.frozen) + '</td><td class="num">' + fmt(r.maxDays) + ' d</td></tr>').join('') || '<tr><td colspan="3">No pallet has stood still for a year.</td></tr>'}</tbody></table>
      <h4>Value by rack row</h4><canvas id="stRows" width="840" height="300"></canvas>
      <h4>Value by area</h4><table><tbody>${Object.entries(c.zones).sort((a, b) => b[1] - a[1]).map(([id, v]) => '<tr><td>' + P.esc(B.zoneById(id).name) + '</td><td class="num">' + sar(v) + '</td></tr>').join('')}</tbody></table>
      <div class="btnrow"><button class="btn" id="stAbc">${colourMode === 'abc' ? 'Back to category colours' : 'Colour pallets by ABC class'}</button><button class="btn" id="stCsv">Export ABC analysis (CSV)</button></div>`;
    scatter(el.querySelector('#stScatter'), c);
    rowBars(el.querySelector('#stRows'), c);
    el.querySelectorAll('[data-slot]').forEach((tr) => tr.addEventListener('click', () => B.ui.focusSlot(B.SLOTS[+tr.dataset.slot])));
    el.querySelector('#stAbc').addEventListener('click', () => { setColourMode(colourMode === 'abc' ? '' : 'abc'); B.tools.toast(colourMode ? 'Pallets coloured by class: red A, amber B, green C' : 'Category colours restored'); render(el); });
    el.querySelector('#stCsv').addEventListener('click', () => {
      const lines = ['Material,Description,Category,Class,On hand,Unit,Unit price SAR,Stock value SAR,Frozen value SAR,Weekly use,Min,Max,Status,Critical'];
      c.rows.forEach((r) => lines.push([r.it.mat, '"' + r.it.name.replace(/"/g, '""') + '"', B.CATS[r.it.cat].name, r.abc + r.xyz, r.qty, r.it.unit, r.price, Math.round(r.value), Math.round(r.frozen), r.weekly.toFixed(2), r.min, r.max, r.below ? 'Below min' : r.over ? 'Overstock' : 'OK', r.critical ? 'Yes' : ''].join(',')));
      B.tools.download('building100-abc-analysis.csv', lines.join('\n'));
    });
  }
  function colours() {
    const cs = getComputedStyle(document.documentElement);
    return { ink: cs.getPropertyValue('--ink').trim(), muted: cs.getPropertyValue('--muted').trim(), line: cs.getPropertyValue('--line').trim(), bad: cs.getPropertyValue('--bad').trim() };
  }
  function scatter(cv, c) {
    const ctx = cv.getContext('2d'), k = colours(), pts = c.rows.filter((r) => r.pallets);
    const maxV = Math.max(...pts.map((r) => r.value), 1), X = (d) => 70 + Math.min(1, d / 420) * 740, Y = (v) => 330 - (Math.log10(Math.max(v, 100)) - 2) / (Math.log10(maxV) - 2 || 1) * 300;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(214,69,65,0.08)'; ctx.fillRect(X(365), 20, 810 - X(365), 160);
    ctx.font = '600 18px "IBM Plex Sans", sans-serif'; ctx.fillStyle = k.bad; ctx.fillText('Costly and not moving', X(365) + 8, 42);
    ctx.strokeStyle = k.line; ctx.beginPath(); ctx.moveTo(70, 330); ctx.lineTo(810, 330); ctx.moveTo(70, 20); ctx.lineTo(70, 330); ctx.stroke();
    ctx.fillStyle = k.muted; ctx.font = '18px "IBM Plex Sans", sans-serif';
    [0, 90, 180, 365].forEach((d) => ctx.fillText(d + ' d', X(d) - 10, 356));
    ctx.fillText('average days since last movement', 300, 378);
    ctx.save(); ctx.translate(20, 250); ctx.rotate(-Math.PI / 2); ctx.fillText('stock value', 0, 0); ctx.restore();
    pts.forEach((r) => { ctx.fillStyle = ABC_COL[r.abc]; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(X(r.days), Y(r.value), 6 + Math.min(10, r.pallets / 12), 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
  }
  function rowBars(cv, c) {
    const ctx = cv.getContext('2d'), k = colours(), max = Math.max(...c.byRow.map((r) => r.value), 1), bw = 740 / c.byRow.length;
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.font = '600 18px "IBM Plex Sans", sans-serif';
    c.byRow.forEach((r, i) => {
      const x = 70 + i * bw, h = (r.value / max) * 220, hf = (r.frozen / max) * 220;
      ctx.fillStyle = k.line; ctx.fillRect(x + 6, 250 - h, bw - 12, h);
      ctx.fillStyle = k.bad; ctx.fillRect(x + 6, 250 - hf, bw - 12, hf);
      ctx.fillStyle = k.muted; ctx.fillText(r.letter, x + bw / 2 - 6, 278);
    });
    ctx.fillStyle = k.ink; ctx.fillText('Highest row: ' + sar(max), 70, 22);
    ctx.fillStyle = k.bad; ctx.fillText('red part = frozen stock', 560, 22);
  }

  const css = document.createElement('style');
  css.textContent = '.dbody table.abc td { text-align: right; } .dbody .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-inline-end: 6px; } .stockcard { margin-top: 10px; }';
  document.head.appendChild(css);
  B.tools.add({ id: 'value', label: 'Stock value', render });
  B.stock = { compute, price, sar, setColourMode, mode: () => colourMode, ABC_COL };
})();
