/* Building 100 - carriers: each truck belongs to a transport company with a booked slot; gate queue, lateness, waiting and turnaround */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const R = B.rng(4242);
  const CARRIERS = ['Desert Line Transport', 'Gulf Route Haulage', 'Eastern Freight Co.', 'Al Nakheel Transport', 'Coastal Cargo'];
  // how punctual each company tends to be: share of trucks that come late
  const LATE = [0.12, 0.25, 0.4, 0.18, 0.3];
  const recs = [], waiting = [];
  const LETTERS = 'ABDEGHJKLNRSTUVXZ';
  const plate = () => String(1000 + Math.floor(R() * 9000)) + ' ' + [0, 1, 2].map(() => LETTERS[Math.floor(R() * LETTERS.length)]).join('');
  const mins = (s) => s / 60;

  function newRec(dir, arrivedAt) {
    const c = Math.floor(R() * CARRIERS.length), u = R();
    const off = u < LATE[c] ? (10 + R() * 35) * 60 : u < LATE[c] + 0.1 ? -(10 + R() * 20) * 60 : (R() - 0.5) * 16 * 60; // + late, - early
    const r = { id: recs.length + 1, carrier: CARRIERS[c], plate: plate(), dir, gate: arrivedAt, appt: arrivedAt - off, docked: null, left: null, door: null, pallets: 0, status: 'At the gate' };
    recs.unshift(r); if (recs.length > 200) recs.pop();
    return r;
  }
  const delay = (r) => mins(r.gate - r.appt);
  const punct = (r) => { const d = delay(r); return d > 5 ? Math.round(d) + ' min late' : d < -5 ? Math.round(-d) + ' min early' : 'On time'; };

  // trucks waiting at the gate, drawn on the access road north of the receiving doors
  const queue = new T.Group(); W.scene.add(queue);
  const qMeshes = [];
  function queueTruck(k) {
    if (qMeshes[k]) return qMeshes[k];
    const g = new T.Group();
    const trailer = W.box(2.5, 2.9, 12, '#d9dde1'); trailer.position.set(0, 2.25, -6);
    const cab = W.box(2.5, 2.6, 2.4, '#f4f6f8'); cab.position.set(0, 1.9, 1.6);
    g.add(trailer, cab); queue.add(g); qMeshes[k] = g;
    return g;
  }
  function labelFor(mesh, text, y) {
    if (mesh.userData.carrierTag && mesh.userData.carrierTag.userData.text === text) return;
    if (mesh.userData.carrierTag) { const o = mesh.userData.carrierTag; mesh.remove(o); o.material.map.dispose(); o.material.dispose(); }
    const l = W.makeLabel(text, { size: 0.9, bg: 'rgba(16,22,29,0.85)', weight: 600, depthTest: true });
    l.position.set(0, y, -5); l.userData.text = text; mesh.add(l); mesh.userData.carrierTag = l;
  }

  let t = 0;
  B.hooks.frame.push((dt) => {
    // one record per truck waiting at the gate, first come first served
    const g = S.gate || [];
    while (waiting.length < g.length) waiting.push(newRec('in', g[waiting.length].t));
    S.trucks.forEach((tr) => {
      if (!tr.rec) {
        tr.rec = tr.gateWait != null && waiting.length ? waiting.shift() : newRec(tr.dir, S.st.t);
        tr.rec.door = (tr.dir === 'in' ? 'IN ' : 'OUT ') + tr.door.n; tr.rec.status = 'Driving to door ' + tr.rec.door;
        labelFor(tr.mesh, tr.rec.carrier, 4.4);
      }
      const r = tr.rec;
      if (tr.phase === 'work' && r.docked == null) { r.docked = S.st.t; r.status = 'At door ' + r.door; }
      if (tr.phase === 'leave' && r.status !== 'Leaving') r.status = 'Leaving';
      r.pallets = tr.dir === 'in' ? tr.count || 0 : tr.order ? tr.order.lines : 0;
    });
    recs.forEach((r) => { if (r.docked != null && r.left == null && !S.trucks.some((tr) => tr.rec === r)) { r.left = S.st.t; r.status = 'Done'; } });
    if ((t += dt) < 0.5) return;
    t = 0;
    qMeshes.forEach((m) => (m.visible = false));
    waiting.forEach((r, k) => {
      const m = queueTruck(k), door = W.doorsIn[0];
      m.visible = true; m.position.set(door.x - 9, 0, B.BUILDING.z0 - 26 - k * 15);
      labelFor(m, r.carrier + ' · waiting ' + Math.max(1, Math.round(mins(S.st.t - r.gate))) + ' min', 4.4);
    });
  });

  B.alertSources = B.alertSources || [];
  B.alertSources.push(() => (waiting.length >= 2 ? [{ key: 'gate' + waiting.length, level: 'warn', text: waiting.length + ' trucks waiting at the gate', sub: 'All inbound doors are busy. Longest wait ' + Math.round(mins(S.st.t - waiting[0].gate)) + ' min (' + waiting[0].carrier + ').', act: 'Carriers', go: () => B.tools.open('carriers') }] : []));

  function stats(list) {
    const arrived = list.filter((r) => r.docked != null), done = list.filter((r) => r.left != null);
    return {
      n: list.length, onTime: arrived.length ? arrived.filter((r) => Math.abs(delay(r)) <= 5 || delay(r) < 0).length / arrived.length : null,
      late: arrived.filter((r) => delay(r) > 5).reduce((a, r) => a + delay(r), 0) / Math.max(1, arrived.filter((r) => delay(r) > 5).length),
      gateWait: arrived.reduce((a, r) => a + mins(r.docked - r.gate), 0) / Math.max(1, arrived.length),
      turn: done.reduce((a, r) => a + mins(r.left - r.gate), 0) / Math.max(1, done.length),
    };
  }
  function render(el) {
    const all = stats(recs);
    el.innerHTML = `<h4>Carriers and appointments</h4><p>Every truck belongs to a transport company and has a booked arrival slot. When all inbound doors are busy, trucks wait at the gate. The table shows who came on time, who was late and how long each truck stayed.</p>
      <div class="row2"><div class="stat"><b>${all.onTime == null ? '-' : fmt(all.onTime * 100, 0) + '%'}</b><small>trucks on time or early</small></div><div class="stat"><b>${waiting.length}</b><small>waiting at the gate now</small></div>
      <div class="stat"><b>${fmt(all.gateWait, 1)} min</b><small>average wait from gate to door</small></div><div class="stat"><b>${fmt(all.turn, 0)} min</b><small>average turnaround, gate to leaving</small></div></div>
      <h4>By company</h4><table><thead><tr><th>Carrier</th><th class="num">Trucks</th><th class="num">On time</th><th class="num">Avg late</th><th class="num">Turnaround</th></tr></thead><tbody>
      ${CARRIERS.map((c) => { const s = stats(recs.filter((r) => r.carrier === c)); return s.n ? '<tr><td>' + c + '</td><td class="num">' + s.n + '</td><td class="num ' + (s.onTime != null && s.onTime < 0.7 ? 'bad' : '') + '">' + (s.onTime == null ? '-' : fmt(s.onTime * 100, 0) + '%') + '</td><td class="num">' + (s.late ? fmt(s.late, 0) + ' min' : '-') + '</td><td class="num">' + (s.turn ? fmt(s.turn, 0) + ' min' : '-') + '</td></tr>' : ''; }).join('')}</tbody></table>
      <h4>Today's trucks</h4><table><thead><tr><th>Slot</th><th>Carrier</th><th>Arrival</th><th>Status</th></tr></thead><tbody>
      ${recs.slice(0, 25).map((r) => '<tr><td class="code">' + S.clock(r.appt) + '</td><td>' + P.esc(r.carrier) + '<br><small class="code">' + r.plate + ' · ' + (r.dir === 'in' ? 'delivery' : 'collection') + (r.pallets ? ', ' + r.pallets + ' pallets' : '') + '</small></td><td class="' + (delay(r) > 5 ? 'bad' : 'good') + '">' + punct(r) + '</td><td>' + P.esc(r.status) + (r.docked != null && r.docked - r.gate > 60 ? '<br><small>waited ' + Math.round(mins(r.docked - r.gate)) + ' min at the gate</small>' : '') + '</td></tr>').join('') || '<tr><td colspan="4">No trucks yet. Let the simulation run for a minute.</td></tr>'}</tbody></table>
      <div class="btnrow"><button class="btn" id="caLook">Look at the gate</button><button class="btn" id="caCsv">Export the truck log (CSV)</button></div>`;
    el.querySelector('#caLook').addEventListener('click', () => B.ui.flyTo([-80, 30, -110], [-50, 0, -55], 1.3));
    el.querySelector('#caCsv').addEventListener('click', () => B.tools.download('building100-trucks.csv', ['Carrier,Plate,Type,Slot,Gate arrival,At door,Left,Door,Pallets,Punctuality,Gate wait min,Turnaround min']
      .concat(recs.map((r) => ['"' + r.carrier + '"', r.plate, r.dir === 'in' ? 'Delivery' : 'Collection', S.clock(r.appt), S.clock(r.gate), r.docked == null ? '' : S.clock(r.docked), r.left == null ? '' : S.clock(r.left), r.door || '', r.pallets, punct(r), r.docked == null ? '' : mins(r.docked - r.gate).toFixed(1), r.left == null ? '' : mins(r.left - r.gate).toFixed(1)].join(','))).join('\n')));
  }
  B.tools.add({ id: 'carriers', label: 'Carriers', render });
  B.carriers = { recs, waiting, CARRIERS };
})();
