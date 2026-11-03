/* Building 19 - pallet journey: follow one real pallet from the truck to the rack and out again, every station timed by the twin */
(function () {
  const B = window.B100, S = B.sim, W = B.world, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const STATIONS = ['On the truck', 'Unloaded at the door', 'Forklift takes it', 'Stored in the rack', 'Order placed', 'Picked for the order', 'Staged at shipping', 'Truck loaded, on its way'];
  let j = null;

  const card = document.createElement('div');
  card.className = 'jrcard'; card.hidden = true;
  B.three.stage.appendChild(card);
  const css = document.createElement('style');
  css.textContent = `.jrcard { position: absolute; z-index: 6; left: 12px; right: 12px; bottom: 12px; background: rgba(10,18,26,0.9); color: #fff; border-radius: 12px; padding: 10px 14px; display: grid; gap: 8px; box-shadow: var(--shadow); }
    .jrTop { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; } .jrTop b { font: 700 15px var(--f-display); color: #f2b31b; } .jrTop span { font-size: 13px; color: #dfe8ef; } .jrTop .btnrow { margin-left: auto; } .jrcard .btn:not(.primary) { background: rgba(255,255,255,0.14); color: #fff; border-color: transparent; }
    .jrLine { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; } .jrSt { position: relative; padding-top: 16px; font-size: 11px; line-height: 1.25; color: #8fa2b0; } .jrSt::before { content: ""; position: absolute; left: 0; right: 0; top: 5px; height: 3px; background: rgba(255,255,255,0.15); } .jrSt::after { content: ""; position: absolute; left: 0; top: 0; width: 13px; height: 13px; border-radius: 50%; background: #334450; }
    .jrSt.done { color: #fff; } .jrSt.done::before { background: #2fbf5a; } .jrSt.done::after { background: #2fbf5a; } .jrSt.now { color: #f2b31b; font-weight: 700; } .jrSt.now::after { background: #f2b31b; box-shadow: 0 0 0 4px rgba(242,179,27,0.3); } .jrSt em { display: block; font: 600 10.5px var(--f-mono); font-style: normal; color: #9fc4d8; } body.cine .jrcard { display: none; }`;
  document.head.appendChild(css);

  function start() {
    const d = document.querySelector('.drawer'); if (d && !d.hidden) document.getElementById('drawerClose').click();
    j = { step: 0, times: [S.st.t], task: null, slot: null, order: null, itemName: '', wasSpeed: S.st.speed };
    S.st.running = true;
    const sp = document.querySelector('#speed [data-v="20"]'); if (sp) sp.click();
    // a truck on its way or at a door carries our pallet
    if (!S.trucks.some((t) => t.dir === 'in' && t.done < (t.count || 0))) S.newInbound(8);
    const tr = S.trucks.find((t) => t.dir === 'in' && t.done < (t.count || 0));
    j.truck = tr; if (tr) j.known = new Set(S.tasks);
    card.hidden = false; B.ui.setView('rcv'); paint();
  }
  function mark(step) { j.step = step; j.times[step] = S.st.t; paint(); }
  function stop() {
    if (!j) return;
    B.ui.stopFollow(); card.hidden = true;
    const sp = document.querySelector('#speed [data-v="' + j.wasSpeed + '"]'); if (sp) sp.click();
    W.clearHighlight(); j = null;
  }
  function follow(f) { if (!f || j.followed === f) return; j.followed = f; B.ui.flyTo([f.x - 7, 6, f.z + 8], [f.x, 1, f.z], 0.9); setTimeout(() => { if (j && j.followed === f) B.ui.followObj(f); }, 950); }
  function placeOrder() {
    const s = j.slot; if (!s || s.item < 0 || s.reserved) return;
    s.reserved = true;
    const o = { id: 'JR-' + String(Math.floor(S.st.t) % 1000).padStart(3, '0'), lines: 1, picked: 0, created: S.st.t, door: null, pos: [], want: [s] };
    S.pendingOrders.unshift(o); j.order = o;
    S.addLog('Issue order ' + o.id + ' placed for the pallet at ' + s.code, 'out');
    mark(4);
  }

  function tick() {
    if (!j) return;
    if (j.step === 0) {
      const nt = S.tasks.find((t) => t.type === 'put' && !j.known.has(t) && !t.cross);
      S.tasks.forEach((t) => { if (t !== nt) j.known.add(t); });
      if (nt) { j.task = nt; j.itemName = B.ITEMS[nt.item] ? B.ITEMS[nt.item].name : ''; j.slot = nt.to; nt.xChecked = true; mark(1); }
    } else if (j.step === 1 && j.task.fl) { follow(j.task.fl); mark(2); }
    else if (j.step === 2 && !S.tasks.includes(j.task)) {
      B.ui.stopFollow(); j.followed = null; mark(3);
      const s = j.slot; const side = Math.sign(s.access - s.z); B.ui.focusSlot(s, false); B.ui.flyTo([s.x - 4, 5, s.z + side * 9], [s.x, s.y + 0.6, s.z], 1.2);
      j.wait = S.st.t + 240;
    } else if (j.step === 3 && S.st.t >= j.wait) placeOrder();
    else if (j.step === 4) { const t = S.tasks.find((q) => q.order === j.order && q.fl); if (t) { follow(t.fl); j.pickTask = t; mark(5); } }
    else if (j.step === 5 && j.order.picked >= 1) { B.ui.stopFollow(); j.followed = null; mark(6); B.ui.setView('dsp'); }
    else if (j.step === 6 && j.order.door && S.st.ordersDone !== undefined && !S.orders.includes(j.order) && !S.pendingOrders.includes(j.order)) { mark(7); S.addLog('Pallet journey complete in ' + fmt((S.st.t - j.times[0]) / 60, 0) + ' min', 'done'); }
  }
  function paint() {
    if (!j) return;
    const tot = (j.times[j.step] - j.times[0]) / 60;
    card.innerHTML = `<div class="jrTop"><b>Pallet journey</b><span>${j.itemName ? P.esc(j.itemName) + (j.slot ? ' · ' + j.slot.code : '') : 'Waiting for the truck to unload our pallet'}</span><span>${fmt(tot, 0)} min so far</span><div class="btnrow">${j.step === 3 ? '<button class="btn primary" id="jrOrder">Order it now</button>' : ''}<button class="btn" id="jrEnd">${j.step === 7 ? 'Done' : 'Stop'}</button></div></div>
      <div class="jrLine">${STATIONS.map((n, i) => { const dur = i > 0 && j.times[i] != null && j.times[i - 1] != null ? fmt((j.times[i] - j.times[i - 1]) / 60, 0) + ' min' : ''; return '<div class="jrSt ' + (i < j.step || j.step === 7 ? 'done' : i === j.step ? 'now' : '') + '">' + n + '<em>' + dur + '</em></div>'; }).join('')}</div>`;
    card.querySelector('#jrEnd').addEventListener('click', stop);
    const o = card.querySelector('#jrOrder'); if (o) o.addEventListener('click', placeOrder);
  }
  B.hooks.frame.push(() => { if (j && j.step < 7) tick(); });
  document.getElementById('views').insertAdjacentHTML('beforeend', '<button class="vbtn" id="vJourney" title="Follow one pallet through the warehouse">Follow a pallet</button>');
  document.getElementById('vJourney').addEventListener('click', () => (j ? stop() : start()));
  B.journey = { start, stop, state: () => j };
})();
