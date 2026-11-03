/* Building 19 - best setup: the twin tries every combination of fleet size, slotting, picking method and charging plan, and picks the winner */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const COST = { forklift: 173000, minute: 20 }; // SAR a year per forklift (depreciation, operator, upkeep); SAR per order-minute of waiting
  const FLEET = [2, 3, 4, 5, 6, 7, 8], SLOT = ['current', 'optimized'], WAVE = [false, true], ROTA = [false, true];
  let results = [], running = false, best = null, base = null;

  function score(c) {
    const r = B.analysis.simulate({ forklifts: c.forklifts, rate: S.st.rate, slotting: c.slotting, hours: 8 });
    let pick = r.pick, util = r.util;
    if (c.wave) { pick = pick * 0.85 + 12; util *= 0.87; }   // batches drive about 15% less but each order waits for its wave
    if (c.rota) { pick -= r.waitAvg * 0.2; util *= 0.97; }    // charging in breaks keeps more forklifts on the floor at peaks
    const cycle = r.cycle - r.pick + pick, orders = S.RATES[S.st.rate].orders * 16 * 300;
    return Object.assign({}, c, { cycle, pick, util, cost: c.forklifts * COST.forklift + (c.slotting === 'optimized' ? 18000 : 0) + cycle * orders * COST.minute, valid: util < 0.95 && Number.isFinite(cycle) && r.orders > 0 });
  }
  const name = (c) => c.forklifts + ' forklifts · ' + (c.slotting === 'optimized' ? 'optimised slotting' : 'current slotting') + (c.wave ? ' · wave picking' : ' · pick as orders come') + (c.rota ? ' · charging in breaks' : '');

  function runAll(el) {
    if (running) return;
    running = true; results = []; best = null;
    base = score({ forklifts: S.targetForklifts, slotting: 'current', wave: false, rota: false });
    const combos = [];
    FLEET.forEach((forklifts) => SLOT.forEach((slotting) => WAVE.forEach((wave) => ROTA.forEach((rota) => combos.push({ forklifts, slotting, wave, rota })))));
    let i = 0;
    const tick = () => {
      const t0 = performance.now();
      while (i < combos.length && performance.now() - t0 < 30) { results.push(score(combos[i++])); }
      const valid = results.filter((r) => r.valid);
      best = valid.length ? valid.reduce((a, b) => (b.cost < a.cost ? b : a)) : null;
      const bar = el.querySelector('#opBar'); if (bar) { bar.style.width = (i / combos.length) * 100 + '%'; el.querySelector('#opN').textContent = i + ' of ' + combos.length + ' setups tested (' + i * 5 + ' simulated shifts)'; chart(el.querySelector('#opC')); }
      if (i < combos.length) setTimeout(tick, 16); else { running = false; if (B.tools.isOpen('optimize')) render(el); }
    };
    render(el); tick();
  }
  function render(el) {
    const save = best && base ? base.cost - best.cost : 0;
    el.innerHTML = `<h4>Find the best setup</h4><p>The twin tries every combination of fleet size, slotting, picking method and charging plan for today's workload, each over several simulated shifts, and scores it on yearly cost and order time. No forklift has to move to test any of it.</p>
      <div class="btnrow"><button class="btn primary" id="opGo" ${running ? 'disabled' : ''}>${results.length ? 'Run again' : 'Find the best setup'}</button></div>
      <div class="opTrack"><i id="opBar" style="width:${results.length ? 100 : 0}%"></i></div><small id="opN">${results.length ? results.length + ' setups tested' : 'Takes a few seconds.'}</small>
      <canvas id="opC" width="840" height="380"></canvas>
      ${best && !running ? `<div class="card opBest"><small>BEST SETUP FOUND</small><b>${P.esc(name(best))}</b><div class="row2"><div class="stat"><b>${fmt(best.cycle, 0)} min</b><small>order cycle (today ${fmt(base.cycle, 0)})</small></div><div class="stat"><b>${fmt(best.util * 100, 0)}%</b><small>forklift utilisation (today ${fmt(base.util * 100, 0)}%)</small></div><div class="stat"><b style="color:var(--ok)">${save > 0 ? B.stock.sar(save) : '-'}</b><small>saved a year against today's setup</small></div><div class="stat"><b>${best.forklifts}</b><small>forklifts (today ${base.forklifts})</small></div></div>
        <div class="btnrow"><button class="btn primary" id="opApply">Apply fleet and slotting to the live model</button></div></div>
        <h4>Top five</h4><table><thead><tr><th>Setup</th><th class="num">Cycle</th><th class="num">Cost a year</th></tr></thead><tbody>${results.filter((r) => r.valid).sort((a, b) => a.cost - b.cost).slice(0, 5).map((r) => '<tr><td>' + P.esc(name(r)) + '</td><td class="num">' + fmt(r.cycle, 0) + ' min</td><td class="num">' + B.stock.sar(r.cost) + '</td></tr>').join('')}</tbody></table>
        <p>Cost counts each forklift at ${B.stock.sar(COST.forklift)} a year and each minute an order waits at SAR ${COST.minute}. Wave picking and charging-in-breaks effects are estimates. Setups that would run forklifts above 95% are ruled out.</p>` : ''}`;
    el.querySelector('#opGo').addEventListener('click', () => runAll(el));
    chart(el.querySelector('#opC'));
    const ap = el.querySelector('#opApply');
    if (ap) ap.addEventListener('click', () => {
      for (let g = 0; g < 10 && S.targetForklifts !== best.forklifts; g++) document.getElementById(S.targetForklifts < best.forklifts ? 'flPlus' : 'flMinus').click();
      if (best.slotting === 'optimized') B.slotting.applyAll();
      B.tools.toast('Applied: ' + best.forklifts + ' forklifts' + (best.slotting === 'optimized' ? ' and optimised slotting. Watch the indicators.' : '. Watch the indicators.'), 5000);
    });
  }
  function chart(c) {
    if (!c) return;
    const ctx = c.getContext('2d'), cs = getComputedStyle(document.documentElement), muted = cs.getPropertyValue('--muted').trim(), line = cs.getPropertyValue('--line').trim(), acc = cs.getPropertyValue('--accent-strong').trim(), bad = cs.getPropertyValue('--bad').trim();
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = '600 17px "IBM Plex Sans", sans-serif'; ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(70, 20); ctx.lineTo(70, 330); ctx.lineTo(820, 330); ctx.stroke();
    ctx.fillStyle = muted; ctx.fillText('yearly cost: lower is better', 300, 362); ctx.save(); ctx.translate(22, 260); ctx.rotate(-Math.PI / 2); ctx.fillText('order cycle (min)', 0, 0); ctx.restore();
    const shown = results.filter((r) => Number.isFinite(r.cost) && Number.isFinite(r.cycle));
    if (!shown.length) return;
    const xs = shown.map((r) => r.cost), ys = shown.map((r) => r.cycle), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const X = (v) => 80 + ((v - x0) / (x1 - x0 || 1)) * 720, Y = (v) => 320 - ((v - y0) / (y1 - y0 || 1)) * 290;
    shown.forEach((r) => { ctx.globalAlpha = r.valid ? 0.75 : 0.25; ctx.fillStyle = r.valid ? '#3a7bd5' : bad; ctx.beginPath(); ctx.arc(X(r.cost), Y(r.cycle), 7, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1; ctx.fillStyle = muted; ctx.fillText(fmt(y0, 0), 30, 324); ctx.fillText(fmt(y1, 0), 30, 38);
    if (base) { ctx.strokeStyle = muted; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(base.cost), Y(base.cycle), 12, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = muted; ctx.fillText('today', X(base.cost) + 16, Y(base.cycle) + 6); }
    if (best) { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(X(best.cost), Y(best.cycle), 13, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = cs.getPropertyValue('--ink').trim(); ctx.fillText('best', X(best.cost) + 18, Y(best.cycle) - 6); }
    ctx.lineWidth = 1;
  }
  const css = document.createElement('style');
  css.textContent = '.opTrack { height: 6px; background: var(--surface-2); border-radius: 3px; overflow: hidden; } .opTrack i { display: block; height: 100%; background: var(--accent-strong); transition: width 0.1s; } .opBest { display: grid; gap: 8px; border-color: var(--accent-strong) !important; } .opBest > small { color: var(--muted); font: 700 11px var(--f-mono); } .opBest > b { font: 700 17px var(--f-display); } .pdEv { display: grid; gap: 6px; }';
  document.head.appendChild(css);
  B.tools.add({ id: 'optimize', label: 'Best setup', render });
  B.optimizer = { runAll, score, results: () => results, best: () => best };
})();
