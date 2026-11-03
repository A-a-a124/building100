/* Building 19 - what if: close a dock door or a rack row, a peak day, one forklift fewer, with the live effect; rack cutaway view */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, P = B.panel;
  const { renderer, scene } = B.three;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const state = { doors: new Set(), row: '', peak: false, fewer: false, base: null, since: null, prevRate: null };
  const barriers = new T.Group(); scene.add(barriers);

  function snapshot() { const k = S.kpis(); return { t: S.st.t, cycle: k.cycle, open: k.open, util: k.util, shipped: S.st.shipped, gate: (S.gate || []).length }; }
  function changed(what) { state.base = snapshot(); state.since = what; S.addLog('What if: ' + what, 'info'); }

  // closed doors stay busy so no truck is sent there
  B.hooks.frame.push(() => {
    state.doors.forEach((d) => { if (!S.trucks.some((tr) => tr.door === d) && !d.busy) W.setDoorLamp(d, true); });
  });
  function toggleDoor(d, close) {
    if (close) { state.doors.add(d); if (!S.trucks.some((tr) => tr.door === d)) W.setDoorLamp(d, true); }
    else { state.doors.delete(d); if (!S.trucks.some((tr) => tr.door === d)) W.setDoorLamp(d, false); }
    changed((close ? 'door ' : 'reopened door ') + (W.doorsIn.includes(d) ? 'IN ' : 'OUT ') + d.n + (close ? ' closed' : ''));
  }
  function closeRow(letter) {
    B.SLOTS.forEach((s) => { if (s.blocked) { s.blocked = false; s.reserved = false; } });
    while (barriers.children.length) barriers.remove(barriers.children[0]);
    state.row = letter;
    if (!letter) return changed('rack row reopened');
    const row = B.RACK.rows.find((r) => r.letter === letter);
    B.SLOTS.forEach((s) => { if (s.letter === letter && !s.reserved) { s.blocked = true; s.reserved = true; } });
    const tape = W.mat('#d63a2f', { emissive: '#d63a2f', emissiveIntensity: 0.3 });
    [B.RACK.x0 - 1.6, B.RACK.x0 + B.RACK.bays * B.RACK.bayW + 1.6].forEach((x) => {
      const b = new T.Mesh(new T.BoxGeometry(0.12, 1.1, 3.4), tape); b.position.set(x, 0.55, row.access); barriers.add(b);
      const l = W.makeLabel('Row ' + letter + ' closed for maintenance', { size: 0.8, bg: 'rgba(200,30,30,0.95)', weight: 700, depthTest: true }); l.position.set(x, 2.2, row.access); barriers.add(l);
    });
    changed('rack row ' + letter + ' closed for maintenance');
  }
  function peak(on) {
    if (on) { state.prevRate = S.st.rate; S.st.rate = 'high'; } else S.st.rate = state.prevRate || 'base';
    state.peak = on; changed(on ? 'peak day, high workload' : 'normal workload again');
  }
  function fewer(on) {
    state.fewer = on; S.setForklifts(S.targetForklifts + (on ? -1 : 1)); changed(on ? 'one forklift fewer' : 'forklift back');
  }

  function render(el) {
    const now = snapshot(), b = state.base, mins = b ? (S.st.t - b.t) / 60 : 0;
    const delta = (k, d, unit, inv) => { if (!b || b[k] == null || now[k] == null) return '-'; const v = now[k] - b[k]; return '<span class="' + (Math.abs(v) < 0.05 ? '' : (v > 0) !== !!inv ? 'bad' : 'good') + '">' + (v > 0 ? '+' : '') + fmt(v, d) + unit + '</span>'; };
    el.innerHTML = `<h4>What if?</h4><p>Change one thing on the floor and watch what happens. The live effect compares the indicators now with the moment of the last change.</p>
      <h4>Dock doors</h4><div class="wiGrid">${W.doorsIn.concat(W.doorsOut).map((d, i) => '<label><input type="checkbox" data-door="' + i + '"' + (state.doors.has(d) ? ' checked' : '') + '>Close ' + (i < 4 ? 'IN ' : 'OUT ') + d.n + '</label>').join('')}</div>
      <label class="f">Close a rack row for maintenance<select id="wiRow"><option value="">None</option>${B.RACK.rows.map((r) => '<option' + (state.row === r.letter ? ' selected' : '') + '>' + r.letter + '</option>').join('')}</select></label>
      <label><input type="checkbox" id="wiPeak" ${state.peak ? 'checked' : ''}> Peak day: high workload</label>
      <label><input type="checkbox" id="wiFewer" ${state.fewer ? 'checked' : ''}> One forklift fewer</label>
      ${b ? `<h4>Live effect · ${fmt(mins, 0)} min since "${P.esc(state.since)}"</h4>
        <table><tbody><tr><td>Order cycle time</td><td class="num">${now.cycle == null ? '-' : fmt(now.cycle, 1) + ' min'}</td><td class="num">${delta('cycle', 1, ' min')}</td></tr>
        <tr><td>Open tasks</td><td class="num">${now.open}</td><td class="num">${delta('open', 0, '')}</td></tr>
        <tr><td>Forklift utilisation</td><td class="num">${fmt(now.util * 100, 0)}%</td><td class="num">${b ? '<span>' + (now.util - b.util > 0 ? '+' : '') + fmt((now.util - b.util) * 100, 0) + ' pts</span>' : ''}</td></tr>
        <tr><td>Trucks waiting at the gate</td><td class="num">${now.gate}</td><td class="num">${delta('gate', 0, '')}</td></tr>
        <tr><td>Pallets shipped since</td><td class="num">${now.shipped - b.shipped}</td><td></td></tr></tbody></table>
        <p>Let it run for 30 simulated minutes or more (use 20x) for a fair picture.</p>` : ''}
      <div class="btnrow"><button class="btn" id="wiReset">Undo all changes</button><button class="btn" id="wiRefresh">Refresh</button></div>`;
    const all = W.doorsIn.concat(W.doorsOut);
    el.querySelectorAll('[data-door]').forEach((c) => c.addEventListener('change', () => { toggleDoor(all[+c.dataset.door], c.checked); render(el); }));
    el.querySelector('#wiRow').addEventListener('change', (e) => { closeRow(e.target.value); if (e.target.value) B.ui.setView('rack'); render(el); });
    el.querySelector('#wiPeak').addEventListener('change', (e) => { peak(e.target.checked); render(el); });
    el.querySelector('#wiFewer').addEventListener('change', (e) => { fewer(e.target.checked); render(el); });
    el.querySelector('#wiRefresh').addEventListener('click', () => render(el));
    el.querySelector('#wiReset').addEventListener('click', () => { [...state.doors].forEach((d) => toggleDoor(d, false)); if (state.row) closeRow(''); if (state.peak) peak(false); if (state.fewer) fewer(false); state.base = null; render(el); });
  }
  B.tools.add({ id: 'whatif', label: 'What if', render });

  // ---------- rack cutaway: slice the racks along a row to see every level ----------
  renderer.localClippingEnabled = true;
  W.palletBase.material = W.palletBase.material.clone();
  const plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
  const rackMats = new Set([W.palletBase.material, W.palletLoad.material, ...B.loads.materials]);
  scene.traverse((o) => { if (o.isInstancedMesh && (o.count === B.RACK.rows.length * (B.RACK.bays + 1) * 2 || o.count === B.RACK.rows.length * (B.RACK.bays + 1) * 6 || o.count === B.RACK.rows.length * (B.RACK.bays + 1) || (o.count === B.SLOTS.length && o !== W.palletBase && o !== W.palletLoad))) rackMats.add(o.material); });
  let cut = '', labelsWere = true;
  const ctl = document.createElement('div');
  ctl.className = 'cutbar'; ctl.hidden = true;
  ctl.innerHTML = '<span>Cutaway at row</span><input type="range" id="cutR" min="0" max="13" value="3"><b id="cutL">D</b><button class="btn" id="cutX">Close</button>';
  B.three.stage.appendChild(ctl);
  function setCut(i) {
    const row = B.RACK.rows[i];
    if (!cut) { labelsWere = W.labels.visible; W.labels.visible = false; }
    cut = row.letter;
    plane.constant = -(row.z - B.RACK.depth / 2 - 0.05);
    rackMats.forEach((m) => { m.clippingPlanes = [plane]; m.clipShadows = true; m.needsUpdate = true; });
    document.getElementById('cutL').textContent = row.letter;
    const cx = B.RACK.x0 + (B.RACK.bays * B.RACK.bayW) / 2;
    B.ui.flyTo([cx - 10, 5, row.z - 15], [cx, 3.6, row.z], 1.1);
  }
  function stopCut() { if (cut) W.labels.visible = labelsWere; cut = ''; rackMats.forEach((m) => { m.clippingPlanes = []; m.clipShadows = false; m.needsUpdate = true; }); ctl.hidden = true; }
  document.getElementById('views').insertAdjacentHTML('beforeend', '<button class="vbtn" id="vCut" title="Slice the racks to see inside a row">Rack cutaway</button>');
  document.getElementById('vCut').addEventListener('click', () => { if (cut) return stopCut(); ctl.hidden = false; setCut(+document.getElementById('cutR').value); });
  document.getElementById('cutR').addEventListener('input', (e) => setCut(+e.target.value));
  document.getElementById('cutX').addEventListener('click', stopCut);
  const css = document.createElement('style');
  css.textContent = `.wiGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; font-size: 13px; }
    .cutbar { position: absolute; z-index: 4; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; box-shadow: var(--shadow); font-weight: 600; font-size: 13px; }
    .cutbar b { font: 700 18px var(--f-mono); min-width: 18px; text-align: center; } body.cine .cutbar { display: none; }`;
  document.head.appendChild(css);
  B.whatif = { state, toggleDoor, closeRow, cutaway: { set: setCut, stop: stopCut } };
})();
