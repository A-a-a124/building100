/* Building 100 - monthly management report: key figures, stock, safety and recommendations, printed or saved as PDF */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d), esc = (t) => P.esc(String(t));
  const t0 = S.st.t, wall0 = Date.now();

  function figures() {
    const k = S.kpis(), st = B.stock.compute(true), plan = B.slotting.plan();
    const hrs = Math.max(0.25, (S.st.t - t0) / 3600), month = 16 * 26; // two shifts, 26 working days
    const reorder = st.below.reduce((n, r) => n + Math.max(0, r.max - r.qty) * r.price, 0);
    return {
      k, st, plan, hrs,
      shipMonth: (k.shipped / hrs) * month, recvMonth: (k.received / hrs) * month,
      reorder, haz: B.hazmat.violations(), alerts: B.alerts.list(), acc: B.cycle.accuracy(), drill: B.evac.last(),
      weekCount: B.cycle.plan().due.length, cut: plan.before ? (1 - plan.after / plan.before) * 100 : 0,
    };
  }
  function recommendations(f) {
    const out = [], st = f.st, cap = B.SLOTS.length;
    if (st.frozenPallets) out.push(['Clear frozen stock', 'Review the ' + fmt(st.frozenPallets) + ' pallets that have not moved for a year (' + B.stock.sar(st.frozen) + ', costing ' + B.stock.sar(st.holdFrozen) + ' a year to keep). Disposing of or returning half of them frees ' + fmt(st.frozenPallets / 2) + ' pallet positions (' + fmt((st.frozenPallets / 2 / cap) * 100, 1) + '% of the racking).']);
    if (st.below.length) out.push(['Reorder below-minimum stock', 'Raise purchase requests for ' + st.below.length + ' materials below minimum, ' + st.belowCritical.length + ' of them critical spares. Estimated value ' + B.stock.sar(f.reorder) + '.']);
    if (f.cut > 3) out.push(['Re-slot fast movers', 'Moving the most-picked materials next to the shipping doors cuts the average pick trip from ' + fmt(f.plan.before, 0) + ' m to ' + fmt(f.plan.after, 0) + ' m (' + fmt(f.cut, 0) + '% less driving).']);
    if (f.haz.length) out.push(['Fix hazmat segregation', f.haz.length + ' storage rule breaches in the cage, for example ' + f.haz[0].a.name + ' only ' + f.haz[0].d.toFixed(1) + ' m from ' + f.haz[0].b.name + ' (needs ' + f.haz[0].need + ' m).']);
    if (S.st.nearMiss) out.push(['Keep people and forklifts apart', fmt(S.st.nearMiss) + ' near misses were recorded. Mark pedestrian walkways in the busiest areas and keep "forklifts stop for people" switched on.']);
    if (!f.drill) out.push(['Run an evacuation drill', 'No drill has been recorded this month. The model expects the building to clear in ' + fmt(Math.max(...B.evac.expected().map((q) => q.t)) / 60, 1) + ' minutes.']);
    else if (f.drill.t > 180) out.push(['Shorten evacuation time', 'The last drill took ' + fmt(f.drill.t / 60, 1) + ' minutes, over the 3 minute target. Add an exit or keep aisles to the exits clear.']);
    if (f.acc == null) out.push(['Start daily cycle counts', 'Counting about ' + fmt(f.weekCount / 5) + ' locations a day (drone D1 for the high levels) replaces the yearly stock-take.']);
    if (f.k.occ > 0.85) out.push(['Plan for space', 'Racking is ' + fmt(f.k.occ * 100, 0) + '% full. Check the Forecast tab for the date it reaches 95%.']);
    return out;
  }
  function snapshot() {
    try { const { renderer, scene, camera } = B.three; renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', 0.85); } catch (e) { return ''; }
  }

  function build() {
    const f = figures(), st = f.st, now = new Date();
    const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const tile = (v, l) => '<div class="rt"><b>' + v + '</b><span>' + l + '</span></div>';
    const abc = ['A', 'B', 'C'].map((a) => { const g = st.rows.filter((r) => r.abc === a && r.pallets); return '<tr><td>Class ' + a + '</td><td class="n">' + g.length + '</td><td class="n">' + B.stock.sar(g.reduce((n, r) => n + r.value, 0)) + '</td><td class="n">' + B.stock.sar(g.reduce((n, r) => n + r.frozen, 0)) + '</td></tr>'; }).join('');
    const frozen = st.rows.filter((r) => r.frozen).sort((a, b) => b.frozen - a.frozen).slice(0, 6).map((r) => '<tr><td>' + esc(r.it.name) + '</td><td class="n">' + B.stock.sar(r.frozen) + '</td><td class="n">' + r.maxDays + ' days</td></tr>').join('');
    const rec = recommendations(f).map(([h, t], i) => '<li><b>' + (i + 1) + '. ' + esc(h) + '.</b> ' + esc(t) + '</li>').join('');
    const al = f.alerts.filter((a) => a.level !== 'info').slice(0, 8).map((a) => '<li class="' + a.level + '">' + esc(a.text) + '</li>').join('') || '<li>No open alerts.</li>';
    const img = snapshot();
    return `<style>
      #printReport { font: 12px/1.45 "IBM Plex Sans", Arial, sans-serif; color: #111; }
      #printReport h1 { font: 700 22px Archivo, Arial, sans-serif; margin: 0; } #printReport h2 { font: 700 14px Archivo, Arial, sans-serif; margin: 16px 0 6px; border-bottom: 2px solid #f2b31b; padding-bottom: 3px; }
      #printReport .sub { color: #555; margin: 2px 0 10px; } #printReport .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      #printReport .rt { border: 1px solid #ccc; border-radius: 6px; padding: 8px; } #printReport .rt b { display: block; font: 700 16px "IBM Plex Mono", monospace; } #printReport .rt span { color: #555; font-size: 11px; }
      #printReport table { width: 100%; border-collapse: collapse; } #printReport td, #printReport th { border-bottom: 1px solid #ddd; padding: 4px; text-align: left; } #printReport .n { text-align: right; font-family: "IBM Plex Mono", monospace; }
      #printReport img { width: 100%; border-radius: 6px; margin-top: 8px; } #printReport ul { padding-left: 18px; margin: 0; } #printReport li { margin: 3px 0; } #printReport li.bad { color: #b3261e; }
      #printReport .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } #printReport .foot { color: #777; margin-top: 14px; font-size: 10px; }
      @page { size: A4; margin: 14mm; }
    </style>
    <h1>Building 100 &middot; Monthly management report</h1><p class="sub">${monthName} &middot; Materials warehouse digital twin &middot; generated ${now.toLocaleString('en-GB')}</p>
    <div class="grid">${tile(B.stock.sar(st.total), 'total stock value')}${tile(fmt(f.k.occ * 100, 1) + '%', 'racking occupancy')}${tile(fmt(f.shipMonth), 'pallets issued per month')}${tile(fmt(f.recvMonth), 'pallets received per month')}
      ${tile(f.k.cycle ? fmt(f.k.cycle, 1) + ' min' : '-', 'order cycle time')}${tile(fmt(f.k.util * 100, 0) + '%', 'forklift utilisation')}${tile(fmt(S.st.nearMiss), 'near misses')}${tile(f.acc == null ? '-' : fmt(f.acc * 100, 1) + '%', 'inventory record accuracy')}</div>
    ${img ? '<img src="' + img + '" alt="3D view of Building 100">' : ''}
    <h2>Recommendations</h2><ul>${rec || '<li>No action needed this month.</li>'}</ul>
    <div class="two"><div><h2>Stock by class</h2><table><thead><tr><th>Class</th><th class="n">Materials</th><th class="n">Value</th><th class="n">Frozen</th></tr></thead><tbody>${abc}</tbody></table></div>
      <div><h2>Biggest frozen stock</h2><table><tbody>${frozen || '<tr><td>None</td></tr>'}</tbody></table></div></div>
    <div class="two"><div><h2>Open alerts</h2><ul>${al}</ul></div>
      <div><h2>Safety</h2><ul><li>${fmt(S.st.nearMiss)} near misses, ${fmt(S.st.yields)} times a forklift stopped or gave way.</li><li>Hazmat rule breaches: ${f.haz.length}.</li>
      <li>Forklift breakdowns: ${B.maint ? B.maint.stats.breakdowns : 0}, ${fmt(B.maint ? B.maint.stats.downH : 0, 1)} forklift hours lost.</li>
      <li>${f.drill ? 'Last evacuation drill: building clear in ' + fmt(f.drill.t / 60, 1) + ' min (' + esc(f.drill.fire) + ').' : 'No evacuation drill this month.'}</li></ul></div></div>
    <p class="foot">Monthly flows are projected from ${fmt(f.hrs, 1)} simulated hours (two shifts, 26 working days). Stock values use the loaded prices, or sample prices when none were loaded.</p>`;
  }
  function print() {
    let r = document.getElementById('printReport');
    if (!r) { r = document.createElement('div'); r.id = 'printReport'; r.style.display = 'none'; document.body.appendChild(r); }
    r.innerHTML = build();
    r.style.display = 'block';
    setTimeout(() => { try { window.print(); } catch (e) { B.tools.toast('Printing is blocked in this viewer. Open the public site to save the PDF.'); } setTimeout(() => (r.style.display = 'none'), 500); }, 300);
  }
  function render(el) {
    const f = figures(), rec = recommendations(f);
    el.innerHTML = `<h4>Monthly management report</h4><p>One click builds a two-page report for management with the key figures, a 3D snapshot of the current view, stock by class, safety and numbered recommendations. Choose "Save as PDF" in the print window.</p>
      <div class="row2"><div class="stat"><b>${B.stock.sar(f.st.total)}</b><small>stock value</small></div><div class="stat"><b>${rec.length}</b><small>recommendations</small></div></div>
      <ol style="margin:0;padding-inline-start:18px;display:grid;gap:6px;font-size:13px">${rec.map(([h, t]) => '<li><b>' + esc(h) + '.</b> ' + esc(t) + '</li>').join('')}</ol>
      <div class="btnrow"><button class="btn primary" id="rpPrint">Create the PDF report</button></div>`;
    el.querySelector('#rpPrint').addEventListener('click', print);
  }
  B.tools.add({ id: 'report', label: 'Monthly report', render });
  B.report = { build, print, figures, recommendations };
})();
