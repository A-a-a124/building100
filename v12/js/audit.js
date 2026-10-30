/* Building 100 - change log: who moved what, where and when, for audits and stock counts */
(function () {
  const B = window.B100, W = B.world, S = B.sim, P = B.panel;
  const log = [];
  const prev = new Int32Array(B.SLOTS.length);
  const prevQty = new Float64Array(B.SLOTS.length);
  B.SLOTS.forEach((s) => { prev[s.i] = s.item; prevQty[s.i] = s.qty; });
  let pending = [], lastPaint = 0;

  const stamp = () => {
    const d = new Date();
    return { date: d.toISOString().slice(0, 10), sim: S.clock(S.st.t) };
  };
  function record(e) {
    const r = Object.assign(stamp(), e);
    log.unshift(r);
    if (log.length > 5000) log.pop();
    const now = performance.now();
    if (B.tools.isOpen('log') && now - lastPaint > 2000 && (document.activeElement || {}).id !== 'lgQ') { lastPaint = now; B.tools.refresh(); }
    return r;
  }
  const itemName = (i) => (i >= 0 && B.ITEMS[i] ? B.ITEMS[i] : null);

  // every slot change goes through updateSlot: compare with what was there before
  const update = W.updateSlot;
  W.updateSlot = function (s, noFlag) {
    update(s, noFlag);
    const was = prev[s.i], wasQty = prevQty[s.i];
    if (was === s.item && wasQty === s.qty) return;
    prev[s.i] = s.item; prevQty[s.i] = s.qty;
    const f = S.forklifts.find((q) => q.task && (q.task.to === s || q.task.from === s));
    if (f && s.item >= 0 && was < 0) {
      const it = itemName(s.item);
      record({ action: 'Put away', code: s.code, mat: it.mat, name: it.name, qty: s.qty, by: 'Forklift ' + f.n, ref: 'Receiving door IN ' + f.task.from.door.n });
    } else if (f && s.item < 0 && was >= 0) {
      const it = itemName(was);
      record({ action: 'Picked for issue', code: s.code, mat: it ? it.mat : '', name: it ? it.name : '', qty: wasQty, by: 'Forklift ' + f.n, ref: f.task.order ? f.task.order.id : '' });
    } else pending.push({ s, was, wasQty });
  };
  // changes without a forklift come from the planner, an import or a count: group them per frame
  B.hooks.frame.push(() => {
    if (!pending.length) return;
    const batch = pending; pending = [];
    if (batch.length > 60) { record({ action: 'Bulk update', code: batch.length + ' locations', mat: '', name: 'Stock import or full re-slotting', qty: '', by: 'Planner', ref: '' }); return; }
    batch.forEach(({ s, was, wasQty }) => {
      const it = itemName(s.item) || itemName(was);
      const action = s.item === was ? 'Quantity changed' : s.item >= 0 ? 'Re-slotted in' : 'Re-slotted out';
      record({ action, code: s.code, mat: it ? it.mat : '', name: it ? it.name : '', qty: s.item === was ? wasQty + ' > ' + s.qty : s.item >= 0 ? s.qty : wasQty, by: B.audit.by || 'Re-slotting plan', ref: B.audit.ref || '' });
    });
  });

  // ---------- location card: recent history ----------
  const show = P.showSlot;
  P.showSlot = function (s) {
    show(s);
    const h = log.filter((r) => r.code === s.code).slice(0, 5);
    document.getElementById('details').insertAdjacentHTML('beforeend', '<div class="card"><div class="kicker">History of this location</div>' +
      (h.length ? '<table class="hist">' + h.map((r) => '<tr><td class="code">' + r.sim + '</td><td>' + r.action + '<br><small>' + P.esc(r.by) + (r.ref ? ' · ' + P.esc(r.ref) : '') + '</small></td></tr>').join('') + '</table>'
        : '<p class="empty">No movement recorded here since this page opened.</p>') + '</div>');
  };

  // ---------- Change log tab ----------
  let filter = '';
  function render(el) {
    const q = filter.toLowerCase();
    const rows = (q ? log.filter((r) => (r.code + ' ' + r.mat + ' ' + r.name + ' ' + r.by + ' ' + r.action + ' ' + r.ref).toLowerCase().includes(q)) : log).slice(0, 120);
    const puts = log.filter((r) => r.action === 'Put away').length, picks = log.filter((r) => r.action === 'Picked for issue').length;
    el.innerHTML = `<h4>Change log</h4><p>Every pallet movement is recorded with the time, the location, the material and who moved it. Use it to trace a missing pallet or to support a stock audit.</p>
      <div class="row2"><div class="stat"><b>${B.tools.fmt(log.length)}</b><small>changes recorded</small></div><div class="stat"><b>${B.tools.fmt(puts)} / ${B.tools.fmt(picks)}</b><small>put away / picked</small></div></div>
      <label class="f">Filter by location, material, forklift or order<input type="search" id="lgQ" value="${P.esc(filter)}" placeholder="e.g. C-07, Forklift 2, SO-4103" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2)"></label>
      <table><thead><tr><th>Time</th><th>Action</th><th>Location</th><th>Material</th><th class="num">Qty</th><th>By</th></tr></thead><tbody>
      ${rows.map((r) => '<tr data-code="' + P.esc(r.code) + '" style="cursor:pointer"><td class="code">' + r.sim + '</td><td>' + r.action + '</td><td class="code">' + P.esc(r.code) + '</td><td>' + P.esc(r.name) + '</td><td class="num">' + r.qty + '</td><td>' + P.esc(r.by) + '</td></tr>').join('') || '<tr><td colspan="6">Nothing has moved yet. Let the simulation run for a minute.</td></tr>'}</tbody></table>
      <div class="btnrow"><button class="btn" id="lgCsv">Export full log (CSV)</button></div>`;
    const inp = el.querySelector('#lgQ');
    inp.addEventListener('input', () => { filter = inp.value; const pos = inp.selectionStart; render(el); const n = el.querySelector('#lgQ'); n.focus(); n.setSelectionRange(pos, pos); });
    el.querySelectorAll('[data-code]').forEach((tr) => tr.addEventListener('click', () => { const s = B.SLOTS.find((q) => q.code === tr.dataset.code); if (s) B.ui.focusSlot(s); }));
    el.querySelector('#lgCsv').addEventListener('click', () => {
      const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
      B.tools.download('building100-change-log.csv', ['Date,Sim time,Action,Location,Material no,Material,Quantity,By,Reference'].concat(log.map((r) => [r.date, r.sim, r.action, r.code, r.mat, r.name, r.qty, r.by, r.ref].map(esc).join(','))).join('\n'));
    });
  }
  const css = document.createElement('style');
  css.textContent = '.hist { width: 100%; font-size: 12px; border-collapse: collapse; } .hist td { padding: 4px 4px; border-bottom: 1px solid var(--line); vertical-align: top; }';
  document.head.appendChild(css);
  B.tools.add({ id: 'log', label: 'Change log', render });
  B.audit = { record, list: log, by: '', ref: '' };
})();
