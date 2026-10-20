/* Building 100 - forklift breakdowns and maintenance: random failures, repair time, preventive plan, effect on orders */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const CAPTURE = /[?&]capture/.test(location.search);
  const R = B.rng(77);
  // failure rates are compressed so breakdowns show up within a demo session; set real figures in the Fleet tab
  const opts = { mtbf: 30, repair: 75, pm: false, on: !CAPTURE };
  const st = { breakdowns: 0, pmDone: 0, downH: 0, t0: S.st.t, log: [] };
  const FAULTS = ['Hydraulic hose leak', 'Traction motor fault', 'Battery connector burnt', 'Mast chain worn', 'Brake sensor error', 'Steering motor fault'];
  const exp = (mean) => -Math.log(1 - R()) * mean;
  const nextFail = (f) => S.st.t + exp(opts.mtbf * (opts.pm ? 2.5 : 1)) * 3600;

  function tag(f, text) {
    if (f.mesh.userData.downTag) f.mesh.remove(f.mesh.userData.downTag);
    f.mesh.userData.downTag = null;
    if (!text) return;
    const l = W.makeLabel((text), { size: 0.62, bg: 'rgba(200,30,30,0.95)', weight: 700 });
    l.position.set(0, 3.7, 0.3); f.mesh.add(l); f.mesh.userData.downTag = l;
  }
  function breakDown(f, why, pm) {
    if (f.down) return false;
    f.down = { why: why || FAULTS[Math.floor(R() * FAULTS.length)], until: S.st.t + (pm ? 3600 : (0.5 + R()) * opts.repair * 60), pm: !!pm, busy: f.busyT };
    f.prevPhase = f.phase; f.phase = 'down'; f.path = [];
    if (pm) st.pmDone++; else st.breakdowns++;
    st.log.unshift({ n: f.n, why: f.down.why, at: S.clock(S.st.t), pm: !!pm });
    tag(f, pm ? 'Preventive maintenance' : 'Broken down');
    S.addLog((pm ? 'Forklift ' + f.n + ' in for preventive maintenance' : 'Forklift ' + f.n + ' broke down: ' + f.down.why), pm ? 'info' : 'warn');
    if (!pm && !CAPTURE) B.tools.toast('Forklift ' + f.n + ' broke down: ' + f.down.why, 4500);
    if (B.audit) B.audit.record({ action: pm ? 'Maintenance' : 'Breakdown', code: 'Forklift ' + f.n, mat: '', name: f.down.why, qty: '', by: 'Fleet', ref: '' });
    return true;
  }
  function repair(f) {
    if (!f.down) return;
    S.addLog('Forklift ' + f.n + (f.down.pm ? ' back from maintenance' : ' repaired and back in service'), 'info');
    f.down = null; f.phase = 'idle'; f.next = nextFail(f);
    tag(f, '');
  }

  // a forklift only fails between jobs, so loads are never dropped half-way
  let lastT = S.st.t;
  B.hooks.frame.push(() => {
    const now = S.st.t, d = Math.max(0, now - lastT); lastT = now;
    const h = ((now / 3600) % 24 + 24) % 24;
    S.forklifts.forEach((f) => {
      if (f.next == null) f.next = nextFail(f);
      if (f.down) {
        f.busyT = f.down.busy; st.downH += d / 3600;
        const b = f.mesh.userData.beacon; if (b) { b.material.emissive.set('#ff2a1a'); b.material.emissiveIntensity = Math.sin(performance.now() / 120) > 0 ? 2 : 0.2; }
        if (now >= f.down.until) { repair(f); if (b) b.material.emissive.set('#ff9500'); }
        return;
      }
      if (!opts.on || f.phase !== 'idle') return;
      if (now >= f.next) breakDown(f);
      // preventive plan: one forklift at a time, night shift 01:00-03:00, about once a week each
      else if (opts.pm && h >= 1 && h < 3 && !S.forklifts.some((q) => q.down && q.down.pm) && (f.pmAt == null || now - f.pmAt > 6 * 86400)) { f.pmAt = now; breakDown(f, 'Planned service: brakes, hydraulics, battery check', true); }
    });
  });

  // forklift card and alerts
  const describe = S.describeForklift;
  S.describeForklift = (n) => {
    const r = describe(n);
    if (r && r.f.down) { r.status = (r.f.down.pm ? 'Preventive maintenance' : 'Broken down: ' + r.f.down.why) + ' · back in ' + Math.max(1, Math.round((r.f.down.until - S.st.t) / 60)) + ' min'; r.detail = ''; }
    return r;
  };
  B.alertSources = B.alertSources || [];
  B.alertSources.push(() => S.forklifts.filter((f) => f.down && !f.down.pm).map((f) => ({ key: 'fl' + f.n + f.down.until, level: 'bad', text: 'Forklift ' + f.n + ' broken down', sub: f.down.why + '. Back in about ' + Math.max(1, Math.round((f.down.until - S.st.t) / 60)) + ' min.', act: 'Fleet', go: () => B.tools.open('fleet') })));

  function render(el) {
    const n = S.forklifts.length, hrs = Math.max(0.1, (S.st.t - st.t0) / 3600), avail = Math.max(0, 1 - st.downH / (n * hrs));
    const rate = S.st.rate, full = B.analysis.simulate({ forklifts: n, rate, slotting: 'current', hours: 8 }), less = n > 1 ? B.analysis.simulate({ forklifts: n - 1, rate, slotting: 'current', hours: 8 }) : null;
    el.innerHTML = `<h4>Forklift fleet and maintenance</h4><p>Forklifts break down at random between jobs and are out until the mechanic has fixed them. The other forklifts take over the work, so orders wait longer.</p>
      <div class="row2"><div class="stat"><b>${fmt(avail * 100, 1)}%</b><small>fleet availability</small></div><div class="stat"><b>${st.breakdowns}</b><small>breakdowns this session</small></div>
      <div class="stat"><b>${fmt(st.downH, 1)} h</b><small>forklift hours lost</small></div><div class="stat"><b>${st.pmDone}</b><small>preventive services done</small></div></div>
      <table><thead><tr><th>Forklift</th><th>Status</th></tr></thead><tbody>${S.forklifts.map((f) => '<tr><td>Forklift ' + f.n + '</td><td>' + (f.down ? '<b style="color:var(--bad)">' + P.esc(f.down.pm ? 'Preventive maintenance' : f.down.why) + '</b>' : 'In service') + '</td><td><button class="chip" data-brk="' + f.n + '"' + (f.down ? ' disabled' : '') + '>Break down now</button></td></tr>').join('')}</tbody></table>
      ${less ? `<h4>What one broken forklift costs</h4><table><thead><tr><th></th><th class="num">${n} forklifts</th><th class="num">${n - 1} forklifts</th></tr></thead><tbody>
        <tr><td>Order cycle time</td><td class="num">${fmt(full.cycle, 1)} min</td><td class="num bad">${fmt(less.cycle, 1)} min</td></tr>
        <tr><td>Average wait for a forklift</td><td class="num">${fmt(full.waitAvg, 1)} min</td><td class="num bad">${fmt(less.waitAvg, 1)} min</td></tr>
        <tr><td>Utilisation of the rest</td><td class="num">${fmt(full.util * 100, 0)}%</td><td class="num">${fmt(less.util * 100, 0)}%</td></tr></tbody></table>` : ''}
      <h4>Settings</h4>
      <label><input type="checkbox" id="mOn" ${opts.on ? 'checked' : ''}> Random breakdowns</label>
      <label><input type="checkbox" id="mPm" ${opts.pm ? 'checked' : ''}> Preventive maintenance plan (one forklift a night, 01:00 to 03:00; breakdowns 2.5 times rarer)</label>
      <div class="row2"><label class="f">Hours between breakdowns, per forklift<input type="number" id="mMtbf" min="2" value="${opts.mtbf}"></label><label class="f">Average repair time (minutes)<input type="number" id="mRep" min="10" value="${opts.repair}"></label></div>
      <p>Defaults are shortened so breakdowns appear during a short session. Real electric forklifts typically run several hundred hours between failures.</p>
      ${st.log.length ? '<h4>Fleet log</h4><table><tbody>' + st.log.slice(0, 8).map((q) => '<tr><td class="code">' + q.at + '</td><td>Forklift ' + q.n + '</td><td>' + P.esc(q.why) + '</td></tr>').join('') + '</tbody></table>' : ''}`;
    el.querySelectorAll('[data-brk]').forEach((b) => b.addEventListener('click', () => { const f = S.forklifts.find((q) => q.n === +b.dataset.brk); if (f.phase !== 'idle' && f.phase !== 'home') { f.next = S.st.t; B.tools.toast('Forklift ' + f.n + ' will stop after its current load'); } else breakDown(f); render(el); }));
    el.querySelector('#mOn').addEventListener('change', (e) => (opts.on = e.target.checked));
    el.querySelector('#mPm').addEventListener('change', (e) => { opts.pm = e.target.checked; S.forklifts.forEach((f) => (f.next = nextFail(f))); });
    el.querySelector('#mMtbf').addEventListener('change', (e) => { opts.mtbf = Math.max(2, +e.target.value || 30); S.forklifts.forEach((f) => (f.next = nextFail(f))); });
    el.querySelector('#mRep').addEventListener('change', (e) => (opts.repair = Math.max(10, +e.target.value || 75)));
  }
  B.tools.add({ id: 'fleet', label: 'Fleet', render });
  B.maint = { opts, stats: st, breakDown, repair };
})();
