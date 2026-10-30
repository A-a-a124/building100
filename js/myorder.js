/* Building 100 - place your own order and watch it picked and shipped; move a pallet by hand */
(function () {
  const B = window.B100, S = B.sim, W = B.world, T = THREE, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  let seq = 1, filter = '';
  const pickedItems = new Set(), mine = [];

  // ---------- place an order ----------
  function send() {
    const want = [];
    pickedItems.forEach((i) => {
      const s = B.SLOTS.filter((q) => q.item === i && !q.reserved).sort((a, b) => a.level - b.level || a.days - b.days)[0];
      if (s) { s.reserved = true; want.push(s); }
    });
    if (!want.length) return B.tools.toast('Choose at least one material that is in stock');
    const o = { id: 'MY-' + String(seq++).padStart(3, '0'), lines: want.length, picked: 0, created: S.st.t, door: null, pos: [], want: want.slice(), mine: true, steps: { created: S.st.t } };
    S.pendingOrders.unshift(o);
    mine.unshift({ o, items: want.map((s) => ({ name: B.ITEMS[s.item].name, code: s.code })) });
    pickedItems.clear();
    S.addLog('Your order ' + o.id + ' placed: ' + o.lines + ' pallets', 'out');
    B.tools.toast('Order ' + o.id + ' sent to the floor. Watch the progress card.');
    chip.hidden = false;
    return o;
  }
  function stage(o) {
    const st = o.steps, tr = S.trucks.find((t) => t.order === o);
    if (!o.door) return 'Waiting for a free shipping door';
    if (!st.door) st.door = S.st.t;
    if (o.picked < o.lines) return 'Picking ' + o.picked + ' of ' + o.lines + ' pallets · door OUT ' + o.door.n;
    if (!st.picked) st.picked = S.st.t;
    if (tr) { st.truck = st.truck || S.st.t; return 'Loading on the truck at door OUT ' + o.door.n; }
    if (st.truck && !st.shipped) { st.shipped = S.st.t; S.addLog('Your order ' + o.id + ' has left the warehouse', 'out'); B.tools.toast('Your order ' + o.id + ' has shipped in ' + Math.round((S.st.t - st.created) / 60) + ' min'); }
    return st.shipped ? 'Shipped' : 'Waiting for the truck';
  }

  const chip = document.createElement('button');
  chip.className = 'ordchip'; chip.hidden = true;
  B.three.stage.appendChild(chip);
  chip.addEventListener('click', () => B.tools.open('order'));

  function render(el) {
    const q = filter.toLowerCase();
    const stocked = B.ITEMS.map((it) => ({ it, n: B.SLOTS.filter((s) => s.item === it.i && !s.reserved).length })).filter((r) => r.n && (!q || (r.it.name + ' ' + r.it.mat).toLowerCase().includes(q)));
    el.innerHTML = `<h4>Place an order</h4><p>Choose up to 6 materials and send the order to the floor. A forklift picks each pallet, brings it to a shipping lane, and a truck collects the order. Each step is timed.</p>
      <input type="search" id="moQ" placeholder="Filter materials" value="${P.esc(filter)}" style="padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2)">
      <div class="molist">${stocked.slice(0, 40).map((r) => '<label><input type="checkbox" data-i="' + r.it.i + '"' + (pickedItems.has(r.it.i) ? ' checked' : '') + '><span>' + P.esc(r.it.name) + '</span><small>' + r.n + ' pallets</small></label>').join('')}</div>
      <div class="btnrow"><button class="btn primary" id="moSend" ${pickedItems.size ? '' : 'disabled'}>Send order (${pickedItems.size} of 6)</button></div>
      ${mine.length ? '<h4>Your orders</h4>' + mine.map(({ o, items }) => { const s = o.steps, t = (a, b) => (a && b ? fmt((b - a) / 60, 0) + ' min' : '-');
        return `<div class="card"><b>${o.id} · ${P.esc(stage(o))}</b><small>${items.map((x) => x.name + ' (' + x.code + ')').join(', ')}</small>
          <table><tbody><tr><td>Waiting for a door</td><td class="num">${t(s.created, s.door)}</td></tr><tr><td>Picking</td><td class="num">${t(s.door, s.picked)}</td></tr><tr><td>Truck loading and leaving</td><td class="num">${t(s.picked, s.shipped)}</td></tr><tr><td><b>Total</b></td><td class="num"><b>${t(s.created, s.shipped || (s.created && S.st.t))}</b></td></tr></tbody></table>
          ${!s.shipped ? '<div class="btnrow"><button class="btn" data-follow="' + o.id + '">Follow the forklift</button></div>' : ''}</div>`; }).join('') : ''}`;
    const inp = el.querySelector('#moQ');
    inp.addEventListener('input', () => { filter = inp.value; const pos = inp.selectionStart; render(el); const n = el.querySelector('#moQ'); n.focus(); n.setSelectionRange(pos, pos); });
    el.querySelectorAll('[data-i]').forEach((c) => c.addEventListener('change', () => { const i = +c.dataset.i; if (c.checked && pickedItems.size >= 6) { c.checked = false; return B.tools.toast('An order has at most 6 pallets'); } c.checked ? pickedItems.add(i) : pickedItems.delete(i); render(el); }));
    el.querySelector('#moSend').addEventListener('click', () => { send(); render(el); });
    el.querySelectorAll('[data-follow]').forEach((b) => b.addEventListener('click', () => {
      const o = mine.find((m) => m.o.id === b.dataset.follow).o, f = S.forklifts.find((q) => q.task && q.task.order === o);
      if (!f) return B.tools.toast('No forklift is on this order right now');
      document.getElementById('drawerClose').click(); B.ui.flyTo([f.x - 8, 7, f.z + 9], [f.x, 1, f.z], 1); setTimeout(() => B.ui.followObj(f), 1050);
    }));
  }
  B.tools.add({ id: 'order', label: 'Place an order', render });

  // ---------- move a pallet by hand ----------
  let src = null;
  const show = P.showSlot;
  P.showSlot = function (s) {
    show(s);
    if (s.item < 0 || s.reserved) return;
    document.getElementById('details').insertAdjacentHTML('beforeend', '<div class="btnrow" style="margin-top:8px"><button class="btn" id="mvBtn">Move this pallet</button></div>');
    document.getElementById('mvBtn').addEventListener('click', () => { src = s; B.tools.open('move'); });
  };
  function nearestFree(s) {
    return B.SLOTS.filter((q) => q.item < 0 && !q.reserved).sort((a, b) => (a.row !== s.row) - (b.row !== s.row) || Math.abs(a.bay - s.bay) + Math.abs(a.level - s.level) - (Math.abs(b.bay - s.bay) + Math.abs(b.level - s.level))).slice(0, 8);
  }
  function move(a, b) {
    if (a.item < 0 || b.item >= 0 || a.reserved || b.reserved) return B.tools.toast('That move is not possible right now');
    const it = a.item, qty = a.qty, days = a.days;
    // a pallet flies along an arc from the old location to the new one
    const p = W.makePallet(it); p.position.set(a.x, a.y, a.z); W.scene.add(p);
    a.item = -1; a.qty = 0; B.audit.by = 'You (manual move)'; B.audit.ref = 'to ' + b.code; W.updateSlot(a);
    b.reserved = true;
    let k = 0;
    const anim = (dt) => {
      k = Math.min(1, k + dt / 1.6);
      p.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * 3, a.z + (b.z - a.z) * k);
      if (k >= 1) {
        W.scene.remove(p); B.hooks.frame.splice(B.hooks.frame.indexOf(anim), 1);
        b.item = it; b.qty = qty; b.days = days; b.reserved = false; B.audit.ref = 'from ' + a.code; W.updateSlot(b);
        setTimeout(() => { B.audit.by = ''; B.audit.ref = ''; }, 400);
        B.ui.focusSlot(b, false);
        B.tools.toast('Moved from ' + a.code + ' to ' + b.code + ' and logged in the change log');
      }
    };
    B.hooks.frame.push(anim);
  }
  function renderMove(el) {
    if (!src || src.item < 0) { el.innerHTML = '<h4>Move a pallet</h4><p>Click a pallet in the 3D view (or search for a location), then press "Move this pallet" on its card.</p>'; return; }
    const free = nearestFree(src);
    el.innerHTML = `<h4>Move a pallet</h4><p>Moving <b>${P.esc(B.ITEMS[src.item].name)}</b> from <span class="code">${src.code}</span>. Choose a free location nearby or type one. The move is recorded in the change log.</p>
      <div class="locs">${free.map((s) => '<button class="chip code" data-to="' + s.code + '">' + s.code + '</button>').join('')}</div>
      <form id="mvForm" class="btnrow"><input id="mvTo" placeholder="e.g. D-10-1-1" style="padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);font-family:var(--f-mono)"><button class="btn primary">Move</button></form>`;
    const go = (code) => { const b = B.SLOTS.find((q) => q.code === code.trim().toUpperCase()); if (!b) return B.tools.toast('No location ' + code); if (b.item >= 0) return B.tools.toast(b.code + ' is not empty'); move(src, b); src = null; renderMove(el); };
    el.querySelectorAll('[data-to]').forEach((x) => x.addEventListener('click', () => go(x.dataset.to)));
    el.querySelector('#mvForm').addEventListener('submit', (e) => { e.preventDefault(); go(el.querySelector('#mvTo').value); });
  }
  B.tools.add({ id: 'move', label: 'Move a pallet', render: renderMove });

  B.hooks.frame.push(() => {
    const live = mine.find((m) => !m.o.steps.shipped);
    chip.hidden = !live;
    if (live) chip.textContent = 'Your order ' + live.o.id + ': ' + stage(live.o);
  });
  const css = document.createElement('style');
  css.textContent = `.molist { display: grid; gap: 2px; max-height: 260px; overflow-y: auto; border: 1px solid var(--line); border-radius: 10px; padding: 6px; }
    .molist label { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; font-size: 13px; padding: 3px 4px; } .molist small { color: var(--muted); }
    .ordchip { position: absolute; z-index: 4; left: 50%; top: 64px; transform: translateX(-50%); background: var(--accent-strong); color: var(--accent-ink); border: 0; border-radius: 999px; padding: 7px 14px; font-weight: 700; box-shadow: var(--shadow); cursor: pointer; } body.cine .ordchip { display: none; }`;
  document.head.appendChild(css);
  B.myorder = { send, mine, move };
})();
