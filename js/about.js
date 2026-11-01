/* Building 100 - "About this model": every assumption and where each number comes from, read live from the modules */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const SRC = { sample: 'Sample figure', std: 'Published standard', ind: 'Typical industry figure', model: 'Set in the model', yours: 'Replaced by your file' };

  function sections() {
    const real = B.importInfo && B.importInfo.label, r = S.RATES[S.st.rate], h = B.stock.HOLD || {}, lead = B.stock.LEAD || {};
    return [
      ['The warehouse', [
        ['Building and racking', '138 × 80 m, 12 m high; 14 rows × 24 bays × 5 levels × 2 = ' + fmt(B.SLOTS.length) + ' pallet positions', 'model', 'Concept layout, not a survey of the real building'],
        ['Doors', '4 inbound (north), 4 outbound (south)', 'model', ''],
        ['Forklifts', S.forklifts.length + ' electric forklifts, about 2.8 m/s on the lanes, 11.7 m of lift time counted per level', 'model', ''],
      ]],
      ['Stock and money', [
        ['Materials, quantities and locations', real ? 'Loaded from ' + real : '32 sample materials placed at random', real ? 'yours' : 'sample', 'Load a stock export in Data to replace them'],
        ['Unit prices', 'e.g. gate valve SAR 6,200, control valve SAR 36,000', real ? 'yours' : 'sample', 'A "Unit Price" column replaces them'],
        ['Owners and storage charge', 'Aramco plus Contractors A, B and C; SAR ' + (B.owners ? B.owners.fee.perPalletDay : 6) + ' per pallet a day', 'sample', 'An "Owner" column replaces the owners'],
        ['Holding cost', 'Space SAR ' + h.space + ' a pallet a year, capital ' + h.capital + '%, insurance ' + h.insurance + '%, obsolescence ' + h.obsSlow + '% (slow) and ' + h.obsFrozen + '% (frozen)', 'ind', 'Editable in Stock value'],
        ['Frozen and slow stock', 'Frozen: no movement for 365 days; slow: 180 to 365 days', 'model', ''],
        ['Lead times for min / max', Object.entries(lead).map(([k, v]) => B.CATS[k].name.split(' ')[0] + ' ' + v + ' wk').join(', '), 'sample', ''],
        ['Service levels', 'A 98%, B 95%, C 90%, critical spares 99% (used by the demand forecast)', 'ind', ''],
        ['Demand history', '13 weeks per material, generated from the stock on hand', real ? 'yours' : 'sample', 'A "Monthly Usage" column scales it'],
      ]],
      ['Flow and people', [
        ['Arrivals', fmt(r.trucks, 1) + ' trucks and ' + fmt(r.orders, 1) + ' issue orders an hour (' + r.name + ' workload), lower on the evening and night shifts', 'model', 'Replay a day with your own receipts and issues'],
        ['Process times', 'Order checking 8-20 min, truck called and arriving 10-25 min, 5 min of paperwork at the door, 2 min to load or unload each pallet', 'ind', 'Typical figures, adjust to your own time study'],
        ['Daily rhythm', 'Busiest 08-11 (1.6 times the average) and 13-15 (1.3 times)', 'model', 'Replace with your own pattern using Replay a day'],
        ['Shifts', 'Day 07-15, evening 15-23, night 23-07, each with a 30-minute meal break', 'model', ''],
        ['Carriers', 'Five made-up transport companies, 12-40% of trucks late', 'sample', 'Names are fictional'],
        ['Walking speed in a drill', '1.3 m/s after 30 s to react; target to clear the building 3 minutes', 'ind', 'Common site target, check your own emergency plan'],
        ['Batteries', 'Drain ' + B.battery.RATE.work + '% an hour working, charge ' + B.battery.RATE.charge + '% an hour, recharge below ' + B.battery.LOW + '%', 'model', ''],
        ['Breakdowns', 'Every ' + B.maint.opts.mtbf + ' h per forklift in the demo (real forklifts: several hundred hours)', 'model', 'Shortened so they show up in a short session; editable in Fleet'],
        ['Pick errors', fmt(B.pickErrors.opts.rate * 100, 1) + '% of picks, 85% caught at the dispatch check', 'ind', 'Editable in Pick accuracy'],
      ]],
      ['Rules and standards', [
        ['Oxygen and fuel gas cylinders', '6.1 m apart or a 1.5 m fire wall', 'std', 'OSHA 29 CFR 1910.253'],
        ['Other hazmat segregation', 'Oxidisers 3 m from flammables; acids 5 m from hypochlorite', 'std', 'Based on the UK HSE HSG71 segregation table'],
        ['Midday work ban', 'No outdoor work under the sun 12:00-15:00 in summer', 'std', 'Saudi Ministry of Human Resources summer rule (15 June to 15 September)'],
        ['Stock record accuracy', '95% with one yearly stock-take', 'ind', 'Used as the "before" figure in Before / after'],
      ]],
    ];
  }

  function render(el) {
    el.innerHTML = `<h4>About this model</h4><p>Building 100 is a concept model to show what a digital twin of the warehouse can do. These are the assumptions behind every number, and where each one comes from. Figures read live from the model, so they match what you see.</p>
      <div class="abLegend">${Object.entries(SRC).map(([k, v]) => '<span class="abTag ' + k + '">' + v + '</span>').join('')}</div>
      ${sections().map(([title, rows]) => '<h4>' + title + '</h4><table><tbody>' + rows.map(([n, v, src, note]) => '<tr><td><b>' + n + '</b><br><span class="abTag ' + src + '">' + SRC[src] + '</span></td><td>' + P.esc(v) + (note ? '<br><small>' + P.esc(note) + '</small>' : '') + '</td></tr>').join('') + '</tbody></table>').join('')}
      <p>Everything marked "Sample figure" is made up for the demo. Replacing the stock file in the Data tab turns the stock, prices and owners into your real figures.</p>`;
  }
  const css = document.createElement('style');
  css.textContent = `.abLegend { display: flex; flex-wrap: wrap; gap: 6px; } .abTag { display: inline-block; font: 700 10.5px var(--f-mono); padding: 1px 7px; border-radius: 999px; margin-top: 2px; background: var(--surface-2); border: 1px solid var(--line); color: var(--muted); }
    .abTag.sample { background: #fff3cd; color: #7a5b00; border-color: #f0d68a; } .abTag.std { background: #dff3e6; color: #1d6b3a; border-color: #a9d8b8; } .abTag.ind { background: #e3edf9; color: #1f4f8a; border-color: #b4cbe8; } .abTag.yours { background: #2fbf5a; color: #fff; border-color: transparent; }
    .dbody td small { color: var(--muted); }`;
  document.head.appendChild(css);
  B.tools.add({ id: 'about', label: 'About this model', render });
  B.about = { sections };
})();
