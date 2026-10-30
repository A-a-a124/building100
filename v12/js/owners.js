/* Building 100 - stock owners: the warehouse stores for Aramco and for other companies; space, stock and storage charges per owner, plus the sample-data badge */
(function () {
  const B = window.B100, W = B.world, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const OWNERS = [
    { id: 'Aramco', color: '#1f6fb2' },
    { id: 'Contractor A', color: '#e07b24' },
    { id: 'Contractor B', color: '#8a5cc8' },
    { id: 'Contractor C', color: '#2f9e5b' },
  ];
  // space allotted to each company as blocks of bays (row letters, first and last bay)
  const BLOCKS = [['Contractor A', 'IJ', 1, 12], ['Contractor B', 'KL', 13, 24], ['Contractor C', 'MN', 1, 8]];
  const fee = { perPalletDay: 6 }; // storage charge to other companies, SAR per pallet a day
  const blockOf = (s) => { for (const [o, rows, a, b] of BLOCKS) if (rows.includes(s.letter) && s.bay >= a && s.bay <= b) return o; return 'Aramco'; };
  const ownerOf = (s) => s.owner || blockOf(s);
  const colour = (o) => (OWNERS.find((q) => q.id === o) || { color: '#8c949c' }).color;
  B.owners = { ownerOf, OWNERS, fee };

  // pallets coloured by owner; "only" greys out everyone else
  let only = '';
  B.colourModes = B.colourModes || {};
  B.colourModes.owner = (s, out) => { const o = ownerOf(s); return out.set(only && o !== only ? '#c3c8cd' : colour(o)); };

  function summary() {
    const st = B.stock.compute(), rows = {};
    const names = new Set(OWNERS.map((q) => q.id)); B.SLOTS.forEach((s) => s.owner && names.add(s.owner));
    names.forEach((o) => (rows[o] = { id: o, slots: 0, used: 0, value: 0, frozen: 0 }));
    B.SLOTS.forEach((s) => {
      const r = rows[ownerOf(s)]; r.slots++;
      if (s.item < 0) return;
      r.used++; r.value += s.qty * (st.rows[s.item] ? st.rows[s.item].price : 0); if (s.days >= 365) r.frozen++;
    });
    return Object.values(rows).filter((r) => r.slots).sort((a, b) => b.slots - a.slots);
  }

  // location card: who the stock belongs to
  const show = P.showSlot;
  P.showSlot = function (s) {
    show(s);
    const kv = document.querySelector('#details .card .chips');
    if (kv) kv.insertAdjacentHTML('afterbegin', '<span class="pill"><i style="color:' + colour(ownerOf(s)) + '"></i>Owner: ' + P.esc(ownerOf(s)) + '</span>');
  };

  function render(el) {
    const rows = summary(), mode = B.stock.mode() === 'owner';
    el.innerHTML = `<h4>Stock owners</h4><p>Building 100 stores for Aramco and for other companies. Each company has its own block of rack space; here is how full each block is, what it holds and the monthly storage charge for the outside companies.</p>
      <table><thead><tr><th>Owner</th><th class="num">Positions</th><th class="num">Used</th><th class="num">Stock value</th><th class="num">Charge / month</th></tr></thead><tbody>
      ${rows.map((r) => '<tr data-o="' + P.esc(r.id) + '" style="cursor:pointer' + (only === r.id ? ';font-weight:700' : '') + '"><td><i class="dot" style="background:' + colour(r.id) + '"></i>' + P.esc(r.id) + (r.frozen ? '<br><small>' + r.frozen + ' frozen pallets</small>' : '') + '</td><td class="num">' + fmt(r.slots) + '</td><td class="num ' + (r.used / r.slots > 0.92 ? 'bad' : '') + '">' + fmt((r.used / r.slots) * 100, 0) + '%</td><td class="num">' + B.stock.sar(r.value) + '</td><td class="num">' + (r.id === 'Aramco' ? '-' : B.stock.sar(r.used * fee.perPalletDay * 30)) + '</td></tr>').join('')}</tbody></table>
      <label class="f">Storage charge, SAR per pallet a day<input type="number" id="owFee" value="${fee.perPalletDay}" min="0" step="0.5"></label>
      <div class="btnrow"><button class="btn ${mode ? '' : 'primary'}" id="owCol">${mode ? 'Back to category colours' : 'Colour pallets by owner'}</button>${only ? '<button class="btn" id="owAll">Show all owners</button>' : ''}</div>
      <p>Click an owner to show only their pallets. To use real owners, add an "Owner" column to the stock file in the Data tab.</p>
      <div class="btnrow"><button class="btn" id="owCsv">Export charges (CSV)</button></div>`;
    el.querySelectorAll('[data-o]').forEach((tr) => tr.addEventListener('click', () => { only = only === tr.dataset.o ? '' : tr.dataset.o; B.stock.setColourMode('owner'); B.ui.setView('rack'); render(el); }));
    el.querySelector('#owCol').addEventListener('click', () => { only = ''; B.stock.setColourMode(mode ? '' : 'owner'); render(el); });
    const all = el.querySelector('#owAll'); if (all) all.addEventListener('click', () => { only = ''; B.stock.setColourMode('owner'); render(el); });
    el.querySelector('#owFee').addEventListener('change', (e) => { fee.perPalletDay = Math.max(0, +e.target.value || 0); render(el); });
    el.querySelector('#owCsv').addEventListener('click', () => B.tools.download('building100-owner-charges.csv', ['Owner,Positions,Used,Utilisation %,Stock value SAR,Frozen pallets,Charge per month SAR']
      .concat(rows.map((r) => ['"' + r.id + '"', r.slots, r.used, Math.round((r.used / r.slots) * 100), Math.round(r.value), r.frozen, r.id === 'Aramco' ? 0 : r.used * fee.perPalletDay * 30].join(','))).join('\n')));
  }
  B.tools.add({ id: 'owners', label: 'Owners', render });

  // ---------- sample-data badge in the header ----------
  const h1 = document.querySelector('.brand h1');
  const badge = document.createElement('span');
  badge.className = 'databadge';
  h1.after(badge);
  const css = document.createElement('style');
  css.textContent = `.databadge { display: inline-block; margin-top: 3px; padding: 2px 9px; border-radius: 999px; font: 700 11px var(--f-mono); letter-spacing: 0.04em; background: #e2a400; color: #1a1300; }
    .databadge.real { background: var(--ok); color: #fff; } body.cine .databadge { display: none; }`;
  document.head.appendChild(css);
  function paint() {
    const real = B.importInfo && B.importInfo.label;
    badge.classList.toggle('real', !!real);
    badge.textContent = real ? 'YOUR DATA · ' + real : 'SAMPLE DATA · figures are illustrative';
    badge.title = real ? 'Stock loaded from ' + real + ' on ' + B.importInfo.when : 'Materials, quantities, prices and owners are made-up examples. Load a real stock file in Data & analysis > Data.';
  }
  paint();
  let t = 0;
  B.hooks.frame.push((dt) => { if ((t += dt) > 2) { t = 0; paint(); } });
})();
