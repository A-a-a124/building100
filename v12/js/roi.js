/* Building 100 - return on investment: cost, yearly saving and payback for each improvement, from the model's own numbers */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d), sar = (n) => B.stock.sar(Math.abs(n));
  const A = { labour: 85, forkliftHour: 140, orderMinute: 20, days: 300 }; // shared assumptions (SAR)
  const picksYear = () => S.RATES[S.st.rate].orders * 4 * 16 * A.days;

  // each idea: editable inputs, and a benefit worked out from the simulation, stock and plans
  const IDEAS = [
    { id: 'slot', name: 'Re-slot fast movers near the shipping doors', inputs: { perMove: ['Cost per pallet move (SAR)', 35] },
      calc(v) {
        const pl = B.slotting.plan(), moves = pl.moves.length, saved = Math.max(0, pl.before - pl.after);
        const km = (picksYear() * 2 * saved) / 1000, hours = (km * 1000) / 2.8 / 3600;
        return { once: moves * v.perMove, run: 0, gain: hours * A.forkliftHour, why: fmt(moves) + ' pallet moves; ' + fmt(km, 0) + ' km less driving a year (' + fmt(hours, 0) + ' forklift hours)' };
      } },
    { id: 'frozen', name: 'Clear the frozen stock', inputs: { perPallet: ['Handling cost per pallet (SAR)', 180], recover: ['Value recovered by sale or return (%)', 8] },
      calc(v) {
        const st = B.stock.compute();
        return { once: st.frozenPallets * v.perPallet - (st.frozen * v.recover) / 100, run: 0, gain: st.holdFrozen, why: fmt(st.frozenPallets) + ' pallets; saves their holding cost and frees the positions' };
      } },
    { id: 'pm', name: 'Preventive maintenance plan for the forklifts', inputs: { perFl: ['Service contract per forklift a year (SAR)', 6000], mtbf: ['Real hours between breakdowns', 400], repair: ['Cost of one breakdown repair (SAR)', 3500] },
      calc(v) {
        const n = S.forklifts.length, perYear = (n * 4800) / v.mtbf, avoided = perYear * (1 - 1 / 2.5);
        return { once: 0, run: n * v.perFl, gain: avoided * (v.repair + 1.25 * A.forkliftHour), why: fmt(avoided, 1) + ' breakdowns avoided a year out of ' + fmt(perYear, 1) };
      } },
    { id: 'forklift', name: 'One more forklift', inputs: { price: ['Forklift price (SAR)', 230000], running: ['Operator and upkeep a year (SAR)', 140000] },
      calc(v) {
        const n = S.forklifts.length, cfg = { rate: S.st.rate, slotting: 'current', hours: 8 };
        const a = B.analysis.simulate(Object.assign({ forklifts: n }, cfg)), b = B.analysis.simulate(Object.assign({ forklifts: n + 1 }, cfg));
        const orders = S.RATES[S.st.rate].orders * 16 * A.days, mins = Math.max(0, a.cycle - b.cycle);
        return { once: v.price, run: v.running, gain: mins * orders * A.orderMinute, why: 'Order cycle ' + fmt(a.cycle, 1) + ' to ' + fmt(b.cycle, 1) + ' min for ' + fmt(orders) + ' orders a year' };
      } },
    { id: 'drone', name: 'Second indoor drone for cycle counts', inputs: { price: ['Drone, dock and software (SAR)', 180000], running: ['Support and licences a year (SAR)', 15000] },
      calc(v) {
        const p = B.cycle.plan(), teamLocs = p.days.reduce((n, d) => n + d.team - d.shelf, 0), hours = ((teamLocs * 50) / 3600) * 52;
        return { once: v.price, run: v.running, gain: hours * A.labour + 2 * A.labour * 52, why: 'Takes over ' + fmt(teamLocs) + ' low-level counts a week (' + fmt(hours, 0) + ' team hours a year) and the weekly lift checks' };
      } },
    { id: 'custom', name: 'Your own idea', inputs: { once: ['One-off cost (SAR)', 50000], run: ['Running cost a year (SAR)', 0], gain: ['Saving a year (SAR)', 30000] },
      calc(v) { return { once: v.once, run: v.run, gain: v.gain, why: 'Your figures' }; } },
  ];
  const vals = {};
  IDEAS.forEach((q) => { vals[q.id] = {}; Object.entries(q.inputs).forEach(([k, d]) => (vals[q.id][k] = d[1])); });

  function evaluate() {
    return IDEAS.map((q) => {
      const r = q.calc(vals[q.id]), net = r.gain - r.run;
      const payback = net > 0 ? Math.max(0, (r.once / net) * 12) : Infinity;
      return Object.assign({ id: q.id, name: q.name, net, payback, three: net * 3 - r.once, roi: r.once > 0 ? ((net * 3 - r.once) / r.once) * 100 : null }, r);
    });
  }
  const pay = (m, once) => (m === Infinity ? 'never' : once <= 0 ? 'right away' : m > 120 ? 'over 10 years' : m < 1 ? 'under a month' : fmt(m, m < 10 ? 1 : 0) + ' months');

  function render(el) {
    const res = evaluate(), ranked = res.slice().sort((a, b) => a.payback - b.payback);
    el.innerHTML = `<h4>Return on investment</h4><p>Each idea is costed from the model itself: the slotting plan, the frozen stock, the fleet, the queue model and the count plan. Change any figure and the payback updates.</p>
      <canvas id="roiChart" width="840" height="${60 + ranked.length * 46}"></canvas>
      <table><thead><tr><th>Improvement</th><th class="num">Pays back in</th><th class="num">3-year net</th></tr></thead><tbody>
      ${ranked.map((r) => '<tr><td>' + P.esc(r.name) + '</td><td class="num ' + (r.payback <= 24 ? 'good' : r.payback === Infinity ? 'bad' : '') + '">' + pay(r.payback, r.once) + '</td><td class="num ' + (r.three >= 0 ? 'good' : 'bad') + '">' + (r.three < 0 ? '-' : '') + sar(r.three) + '</td></tr>').join('')}</tbody></table>
      <div class="row2"><label class="f">Labour, SAR an hour<input type="number" data-a="labour" value="${A.labour}"></label><label class="f">Forklift with driver, SAR an hour<input type="number" data-a="forkliftHour" value="${A.forkliftHour}"></label>
      <label class="f">Cost of an order waiting, SAR a minute<input type="number" data-a="orderMinute" value="${A.orderMinute}"></label><label class="f">Working days a year<input type="number" data-a="days" value="${A.days}"></label></div>
      ${res.map((r) => { const q = IDEAS.find((x) => x.id === r.id); return `<div class="card roi"><b>${P.esc(r.name)}</b><small>${P.esc(r.why)}</small>
        <div class="row2">${Object.entries(q.inputs).map(([k, d]) => '<label class="f">' + d[0] + '<input type="number" data-q="' + q.id + '" data-k="' + k + '" value="' + vals[q.id][k] + '"></label>').join('')}</div>
        <div class="roiNums"><span>One-off <b>${r.once < 0 ? '+' : ''}${sar(r.once)}</b></span><span>Saving <b>${sar(r.gain)}/yr</b></span><span>Running <b>${sar(r.run)}/yr</b></span><span>Payback <b>${pay(r.payback, r.once)}</b></span></div></div>`; }).join('')}
      <div class="btnrow"><button class="btn" id="roiCsv">Export (CSV)</button></div>`;
    chart(el.querySelector('#roiChart'), ranked);
    el.querySelectorAll('[data-q]').forEach((i) => i.addEventListener('change', () => { vals[i.dataset.q][i.dataset.k] = +i.value || 0; render(el); }));
    el.querySelectorAll('[data-a]').forEach((i) => i.addEventListener('change', () => { A[i.dataset.a] = +i.value || 0; render(el); }));
    el.querySelector('#roiCsv').addEventListener('click', () => B.tools.download('building100-roi.csv', ['Improvement,One-off SAR,Running SAR per year,Saving SAR per year,Payback months,3-year net SAR,Basis']
      .concat(ranked.map((r) => ['"' + r.name + '"', Math.round(r.once), Math.round(r.run), Math.round(r.gain), r.payback === Infinity ? 'never' : r.payback.toFixed(1), Math.round(r.three), '"' + r.why + '"'].join(','))).join('\n')));
  }
  function chart(c, ranked) {
    const ctx = c.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const acc = cs.getPropertyValue('--accent-strong').trim(), muted = cs.getPropertyValue('--muted').trim(), bad = cs.getPropertyValue('--bad').trim(), ink = cs.getPropertyValue('--ink').trim();
    const cap = 36, X = (m) => 330 + (Math.min(m, cap) / cap) * 480;
    ctx.clearRect(0, 0, c.width, c.height); ctx.font = '600 17px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = muted; ctx.fillText('months to pay back', 330, 24);
    [0, 12, 24, 36].forEach((m) => { ctx.fillRect(X(m), 34, 1, ranked.length * 46); ctx.fillText(m + (m === 36 ? '+' : ''), X(m) - 8, 50 + ranked.length * 46); });
    ranked.forEach((r, i) => {
      const y = 40 + i * 46;
      ctx.fillStyle = ink; ctx.fillText(r.name.length > 30 ? r.name.slice(0, 29) + '…' : r.name, 6, y + 24);
      ctx.fillStyle = r.payback === Infinity ? bad : acc; ctx.fillRect(X(0), y + 6, Math.max(4, X(r.payback) - X(0)), 26);
      ctx.fillStyle = ink; ctx.fillText(pay(r.payback, r.once), Math.min(X(r.payback) + 8, 740), y + 25);
    });
  }
  const css = document.createElement('style');
  css.textContent = '.dbody .roi { display: grid; gap: 8px; } .dbody .roi small { color: var(--muted); } .roiNums { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--muted); } .roiNums b { color: var(--ink); font-family: var(--f-mono); }';
  document.head.appendChild(css);
  B.tools.add({ id: 'roi', label: 'ROI', render });
  B.roi = { evaluate, assumptions: A };
})();
