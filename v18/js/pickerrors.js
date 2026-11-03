/* Building 19 - pick accuracy: a few picks take the wrong material or quantity; the dispatch check catches most of them */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const R = B.rng(717);
  const opts = { rate: 0.015, scan: false, check: 0.85 };
  const st = { picks: 0, errors: [], byRow: {} };
  const rings = [];

  const record = B.audit.record;
  B.audit.record = function (e) {
    const r = record(e);
    if (e.action !== 'Picked for issue') return r;
    st.picks++;
    if (R() >= opts.rate * (opts.scan ? 0.2 : 1)) return r;
    const s = B.SLOTS.find((q) => q.code === e.code), wrongItem = R() < 0.6, caught = R() < (opts.scan ? 0.98 : opts.check);
    const err = { at: S.clock(S.st.t), code: e.code, name: e.name, type: wrongItem ? 'Wrong material' : 'Wrong quantity', caught, order: e.ref, row: s ? s.letter : '?' };
    st.errors.unshift(err); if (st.errors.length > 200) st.errors.pop();
    st.byRow[err.row] = (st.byRow[err.row] || 0) + 1;
    S.addLog((caught ? 'Pick error caught at the dispatch check: ' : 'Pick error not caught, sent to site: ') + err.type.toLowerCase() + ' at ' + e.code + ' (' + e.ref + ')', 'warn');
    if (s) {
      const m = new T.Mesh(new T.RingGeometry(0.9, 1.2, 32), new T.MeshBasicMaterial({ color: caught ? '#e2a400' : '#e5372b', transparent: true, side: T.DoubleSide, depthTest: false, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(s.x, 0.1, s.access); m.renderOrder = 12; W.scene.add(m); rings.push({ m, t: 0 });
    }
    return r;
  };
  B.hooks.frame.push((dt) => {
    for (let i = rings.length - 1; i >= 0; i--) { const q = rings[i]; q.t += dt; q.m.scale.setScalar(1 + q.t * 1.5); q.m.material.opacity = Math.max(0, 1 - q.t / 2); if (q.t > 2) { W.scene.remove(q.m); rings.splice(i, 1); } }
  });

  function render(el) {
    const n = st.errors.length, missed = st.errors.filter((e) => !e.caught).length;
    const acc = st.picks ? 1 - n / st.picks : null, out = st.picks ? 1 - missed / st.picks : null;
    const rows = Object.entries(st.byRow).sort((a, b) => b[1] - a[1]).slice(0, 5);
    el.innerHTML = `<h4>Pick accuracy</h4><p>Now and then a picker takes the wrong material or the wrong quantity. The check at the dispatch lane catches most mistakes before the truck leaves; the rest reach the site and come back as returns or complaints.</p>
      <div class="row2"><div class="stat"><b>${acc == null ? '-' : fmt(acc * 100, 1) + '%'}</b><small>picks right first time</small></div><div class="stat"><b>${out == null ? '-' : fmt(out * 100, 2) + '%'}</b><small>orders leaving correct</small></div>
      <div class="stat"><b>${n - missed}</b><small>errors caught at dispatch</small></div><div class="stat"><b style="color:${missed ? 'var(--bad)' : 'inherit'}">${missed}</b><small>errors that reached the site</small></div></div>
      <label><input type="checkbox" id="peScan" ${opts.scan ? 'checked' : ''}> Scan the location and material barcode at every pick (errors 5 times rarer, almost all caught)</label>
      <label class="f">Error rate without scanning: <b id="peV">${fmt(opts.rate * 100, 1)}%</b><input type="range" id="peR" min="0" max="50" value="${opts.rate * 1000}"></label>
      ${rows.length ? '<h4>Where errors happen</h4><table><tbody>' + rows.map(([r, c]) => '<tr><td>Row ' + r + '</td><td class="num">' + c + '</td></tr>').join('') + '</tbody></table>' : ''}
      <h4>Latest errors</h4><table><thead><tr><th>Time</th><th>Location</th><th>Error</th><th>Result</th></tr></thead><tbody>
      ${st.errors.slice(0, 12).map((e) => '<tr><td class="code">' + e.at + '</td><td class="code">' + e.code + '</td><td>' + e.type + '<br><small>' + P.esc(e.name) + '</small></td><td class="' + (e.caught ? 'good' : 'bad') + '">' + (e.caught ? 'Caught' : 'Reached site') + '</td></tr>').join('') || '<tr><td colspan="4">No errors yet. Let the simulation run.</td></tr>'}</tbody></table>`;
    el.querySelector('#peScan').addEventListener('change', (e) => { opts.scan = e.target.checked; render(el); });
    const r = el.querySelector('#peR');
    r.addEventListener('input', () => { opts.rate = +r.value / 1000; el.querySelector('#peV').textContent = fmt(opts.rate * 100, 1) + '%'; });
  }
  B.tools.add({ id: 'errors', label: 'Pick accuracy', render });
  B.pickErrors = { opts, stats: st };
})();
