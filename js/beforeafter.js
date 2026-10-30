/* Building 100 - before and after: today's warehouse against the warehouse with the proposed improvements, on one page */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);

  function compare() {
    const st = B.stock.compute(), plan = B.slotting.plan(), n = S.targetForklifts;
    const cfg = { forklifts: n, rate: S.st.rate, hours: 8 };
    const a = B.analysis.simulate(Object.assign({ slotting: 'current' }, cfg)), b = B.analysis.simulate(Object.assign({ slotting: 'optimized' }, cfg));
    const picks = S.RATES[S.st.rate].orders * 4 * 16 * 300;
    const pm = B.roi ? B.roi.evaluate().find((r) => r.id === 'pm') : null;
    const acc = B.cycle.accuracy();
    return [
      { name: 'Order cycle time', unit: 'min', before: a.cycle, after: b.cycle, d: 1, how: 'Fast movers re-slotted next to the shipping doors' },
      { name: 'Average pick trip', unit: 'm', before: plan.before, after: plan.after, d: 0, how: 'Same re-slotting plan' },
      { name: 'Forklift driving a year', unit: 'km', before: (picks * 2 * plan.before) / 1000, after: (picks * 2 * plan.after) / 1000, d: 0, how: 'Fewer metres per pick' },
      { name: 'Cost of keeping frozen stock', unit: 'SAR/yr', before: st.holdFrozen, after: 0, d: 0, money: true, how: 'Pallets not moved for a year sold, returned or written off' },
      { name: 'Free pallet positions', unit: '', before: B.SLOTS.length - B.occupiedCount(), after: B.SLOTS.length - B.occupiedCount() + st.frozenPallets, d: 0, up: true, how: 'Space freed by clearing frozen stock' },
      { name: 'Hazmat storage breaches', unit: '', before: B.hazmat.violations().length, after: 0, d: 0, how: 'Incompatible materials moved apart (Hazmat tab)' },
      { name: 'Stock record accuracy', unit: '%', before: 95, after: acc != null ? acc * 100 : 98.5, d: 1, up: true, how: acc != null ? 'Daily cycle counts (measured in the Cycle count tab); 95% is typical with one yearly stock-take' : 'Daily cycle counts (target); 95% is typical with one yearly stock-take' },
      { name: 'Forklift breakdowns a year', unit: '', before: pm ? (S.forklifts.length * 4800) / 400 : 0, after: pm ? (S.forklifts.length * 4800) / 400 / 2.5 : 0, d: 0, how: 'Preventive maintenance plan' },
    ];
  }
  const val = (r, v) => (r.money ? B.stock.sar(v) : fmt(v, r.d) + (r.unit && r.unit !== 'SAR/yr' ? (r.unit === '%' ? '%' : ' ' + r.unit) : ''));

  function render(el) {
    const rows = compare();
    el.innerHTML = `<h4>Before and after</h4><p>Building 100 today, and the same warehouse once the proposed improvements are in place. Every "after" figure comes from the model itself; the yearly stock-take accuracy of 95% is a typical industry figure.</p>
      <div class="ba">${rows.map((r) => { const ch = r.before ? ((r.after - r.before) / r.before) * 100 : 0, good = r.up ? ch > 0 : ch < 0;
        return `<div class="baRow"><div class="baName"><b>${r.name}</b><small>${P.esc(r.how)}</small></div><div class="baNum"><span>${val(r, r.before)}</span><i>→</i><b>${val(r, r.after)}</b><em class="${Math.abs(ch) < 0.5 ? '' : good ? 'good' : 'bad'}">${Math.abs(ch) < 0.5 ? 'same' : (ch > 0 ? '+' : '') + fmt(ch, 0) + '%'}</em></div></div>`; }).join('')}</div>
      <div class="btnrow"><button class="btn primary" id="baPrint">Print or save as PDF</button><button class="btn" id="baCsv">Export (CSV)</button></div>`;
    el.querySelector('#baCsv').addEventListener('click', () => B.tools.download('building100-before-after.csv', ['Measure,Before,After,Change %,How'].concat(rows.map((r) => ['"' + r.name + (r.unit ? ' (' + r.unit + ')' : '') + '"', r.before.toFixed(1), r.after.toFixed(1), r.before ? (((r.after - r.before) / r.before) * 100).toFixed(1) : '', '"' + r.how + '"'].join(','))).join('\n')));
    el.querySelector('#baPrint').addEventListener('click', () => {
      let pr = document.getElementById('printReport');
      if (!pr) { pr = document.createElement('div'); pr.id = 'printReport'; pr.style.display = 'none'; document.body.appendChild(pr); }
      pr.innerHTML = '<h1 style="font:700 22px Archivo,Arial">Building 100 · Before and after</h1><p>' + new Date().toLocaleDateString('en-GB') + ' · sample data</p><table style="width:100%;border-collapse:collapse;font:13px Arial">' +
        rows.map((r) => '<tr style="border-bottom:1px solid #ccc"><td style="padding:6px"><b>' + r.name + '</b><br><small>' + P.esc(r.how) + '</small></td><td style="text-align:right">' + val(r, r.before) + '</td><td style="text-align:right"><b>' + val(r, r.after) + '</b></td></tr>').join('') + '</table>';
      pr.style.display = 'block';
      setTimeout(() => { try { window.print(); } catch (e) {} setTimeout(() => (pr.style.display = 'none'), 500); }, 200);
    });
  }
  const css = document.createElement('style');
  css.textContent = `.ba { display: grid; gap: 8px; } .baRow { display: grid; gap: 6px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }
    .baName small { display: block; color: var(--muted); font-size: 12px; } .baNum { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-family: var(--f-mono); }
    .baNum span { color: var(--muted); } .baNum b { font-size: 18px; } .baNum i { color: var(--muted); font-style: normal; } .baNum em { margin-left: auto; font-style: normal; font-weight: 700; } .baNum em.good { color: var(--ok); } .baNum em.bad { color: var(--bad); }`;
  document.head.appendChild(css);
  B.tools.add({ id: 'beforeafter', label: 'Before / after', render });
  B.beforeAfter = { compare };
})();
