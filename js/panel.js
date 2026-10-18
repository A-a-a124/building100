/* Building 100 - side panel: search, details and zones */
(function () {
  const B = window.B100;
  const P = (B.panel = {});
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const unit = (u) => B.UNITS[u] || u;
  P.esc = esc;
  P.fmt = fmt;

  function ageChip(days) {
    if (days < 90) return '<span class="pill ok"><i></i>Active stock</span>';
    if (days < 180) return '<span class="pill warn"><i></i>Slow moving</span>';
    return '<span class="pill bad"><i></i>Stagnant</span>';
  }
  const copyBtn = (text) => '<button class="chip" data-copy="' + esc(text) + '">Copy</button>';
  const locBtn = (s) => '<button class="loc" data-slot="' + s.i + '">' + s.code + '</button>';

  P.showWelcome = function () {
    $('details').innerHTML =
      '<h2>Details</h2><div class="card"><h3>Click anything in the 3D view</h3>' +
      '<p class="empty">Pick a pallet, a zone or a forklift to see what it holds: material number, quantity, location and how recently it moved.</p>' +
      '<dl class="kv"><dt>Footprint</dt><dd>120 x 70 m, 12 m clear height</dd><dt>Pallet positions</dt><dd>' + fmt(B.SLOTS.length) + ' in 12 rows</dd>' +
      '<dt>Dock doors</dt><dd>4 inbound (north), 4 outbound (south)</dd></dl></div>';
  };

  P.showSlot = function (s) {
    const out = ['<h2>Location details</h2><div class="card">'];
    out.push('<div class="kicker">Pallet racking, row ' + s.letter + '</div>');
    if (s.item < 0) {
      out.push('<h3>Empty location</h3><div class="code">' + s.code + '</div>');
      out.push('<p class="empty">' + (s.reserved ? 'Reserved for a pallet that is on its way here now.' : 'Free to receive a new pallet.') + '</p>');
    } else {
      const it = B.ITEMS[s.item], cat = B.CATS[it.cat];
      out.push('<h3>' + esc(it.name) + '</h3><div class="code">' + s.code + '</div>');
      out.push('<div class="chips"><span class="pill"><i style="color:' + cat.color + '"></i>' + esc(cat.name) + '</span>' + ageChip(s.days) +
        (s.reserved ? '<span class="pill warn"><i></i>Allocated to an issue order</span>' : '') + '</div>');
      out.push('<dl class="kv">' +
        '<dt>Specification</dt><dd>' + esc(it.spec) + '</dd>' +
        '<dt>Material no.</dt><dd><span class="code">' + it.mat + '</span> ' + copyBtn(it.mat) + '</dd>' +
        '<dt>Quantity</dt><dd>' + fmt(s.qty) + ' ' + unit(it.unit) + '</dd>' +
        '<dt>Last movement</dt><dd>' + (s.days === 0 ? 'Today' : s.days + ' days ago') + '</dd></dl>');
    }
    out.push('<dl class="kv"><dt>Bay</dt><dd>' + s.bay + ' of 20</dd><dt>Level</dt><dd>' + s.level + ' of 5 (' + s.y.toFixed(1) + ' m above floor)</dd><dt>Position</dt><dd>' + (s.pos === 1 ? 'Left' : 'Right') + '</dd></dl>');
    if (s.item >= 0) {
      const others = B.SLOTS.filter((o) => o.item === s.item && o !== s);
      if (others.length) out.push('<div><small class="empty">Same material in ' + others.length + ' other locations:</small><div class="locs">' + others.slice(0, 24).map(locBtn).join('') + '</div></div>');
    }
    out.push('</div>');
    $('details').innerHTML = out.join('');
  };

  P.zoneOccupancy = function (id) {
    if (id === 'RACK') return B.sim.occ / B.SLOTS.length;
    if (id === 'RCV') return B.world.stageIn.filter((p) => p.used).length / B.world.stageIn.length;
    if (id === 'DSP') return B.world.stageOut.filter((p) => p.used).length / B.world.stageOut.length;
    return { QC: 0.58, PIPE: 0.71, SHELF: 0.83, HAZ: 0.64, OFF: null, CHG: null }[id];
  };

  P.showZone = function (id) {
    const zn = B.zoneById(id);
    const occ = P.zoneOccupancy(id);
    const out = ['<h2>Zone details</h2><div class="card">'];
    out.push('<div class="kicker" style="color:' + zn.color + '">Zone ' + zn.id + '</div><h3>' + esc(zn.name) + '</h3><p>' + esc(zn.desc) + '</p>');
    out.push('<dl class="kv"><dt>Capacity</dt><dd>' + esc(zn.capacity) + '</dd><dt>Area</dt><dd>' + fmt((zn.x[1] - zn.x[0]) * (zn.z[1] - zn.z[0])) + ' m&sup2;</dd></dl>');
    if (occ != null) {
      out.push('<div><div class="split"><small class="empty">Utilisation</small><b class="code">' + Math.round(occ * 100) + '%</b></div><div class="bar"><span style="width:' + Math.round(occ * 100) + '%"></span></div></div>');
    }
    if (id === 'RACK') {
      out.push('<div><small class="empty">Row allocation by category:</small><div class="locs">' +
        B.RACK.rows.map((r, i) => '<span class="loc" style="border-color:' + B.CATS[B.ROW_CAT[i]].color + '">' + r.letter + ' ' + esc(B.CATS[B.ROW_CAT[i]].name) + '</span>').join('') + '</div></div>');
    }
    const items = B.ZONE_ITEMS.filter((z) => z.zone === id);
    if (items.length) {
      out.push('<div class="results">' + items.map((z) =>
        '<div class="res"><b>' + esc(z.name) + '</b><small>' + esc(z.spec) + '</small><small><span class="code">' + z.mat + '</span> &middot; ' + fmt(z.qty) + ' ' + unit(z.unit) + ' &middot; ' + esc(z.loc) + '</small></div>').join('') + '</div>');
    }
    if (id === 'HAZ') out.push('<span class="pill bad"><i></i>Restricted area: permit and PPE required</span>');
    out.push('</div>');
    $('details').innerHTML = out.join('');
  };

  P.showForklift = function (n) {
    const d = B.sim.describeForklift(n);
    if (!d) return P.showWelcome();
    $('details').innerHTML = '<h2>Forklift details</h2><div class="card"><div class="kicker">Electric reach forklift</div><h3>Forklift ' + n + '</h3>' +
      '<div class="chips"><span class="pill ' + (d.f.phase === 'idle' ? 'ok' : 'warn') + '"><i></i>' + esc(d.status) + '</span></div>' +
      (d.detail ? '<p>' + esc(d.detail) + '</p>' : '<p class="empty">No task right now.</p>') +
      '<dl class="kv"><dt>Utilisation</dt><dd>' + Math.round(d.util * 100) + '%</dd><dt>Rated capacity</dt><dd>2.5 t, lift to 8 m</dd></dl>' +
      '<button class="btn" data-follow="' + n + '">Follow with camera</button></div>';
  };

  P.renderZones = function () {
    $('zones').innerHTML = B.ZONES.map((z) => {
      const occ = P.zoneOccupancy(z.id);
      return '<button class="zbtn" data-zone="' + z.id + '"><i style="background:' + z.color + '"></i><span>' + esc(z.name) + '</span><small>' + (occ != null ? Math.round(occ * 100) + '%' : '') + '</small></button>';
    }).join('');
  };

  P.renderLegend = function (heat) {
    $('legend').innerHTML = heat
      ? '<span>Last movement:</span><span>Today</span><span class="grad"></span><span>1 year+</span>'
      : Object.values(B.CATS).map((c) => '<span><i style="background:' + c.color + '"></i>' + esc(c.name) + '</span>').join('');
  };

  P.renderSearch = function (q) {
    const box = $('results');
    if (!q.trim()) { box.innerHTML = ''; return; }
    const r = B.search(q);
    const out = [];
    if (r.slots.length) {
      out.push('<div class="res"><b>Locations starting with <span class="code">' + esc(q.toUpperCase()) + '</span></b><div class="locs">' + r.slots.slice(0, 40).map(locBtn).join('') + '</div></div>');
    }
    r.materials.forEach((m) => {
      if (m.kind === 'rack') {
        out.push('<div class="res"><b>' + esc(m.item.name) + '</b><small>' + esc(m.item.spec) + ' &middot; <span class="code">' + m.item.mat + '</span></small>' +
          '<small>' + m.locs.length + ' locations &middot; ' + fmt(m.total) + ' ' + unit(m.item.unit) + ' on hand</small>' +
          '<div class="locs">' + m.locs.slice(0, 18).map(locBtn).join('') + (m.locs.length > 18 ? '<span class="empty">+' + (m.locs.length - 18) + ' more</span>' : '') + '</div></div>');
      } else {
        out.push('<button class="res" data-zone="' + m.item.zone + '"><b>' + esc(m.item.name) + '</b><small>' + esc(m.item.spec) + ' &middot; <span class="code">' + m.item.mat + '</span></small><small>' + esc(B.zoneById(m.item.zone).name) + ' &middot; ' + esc(m.item.loc) + '</small></button>');
      }
    });
    box.innerHTML = out.length ? out.join('') : '<p class="empty">No results for "' + esc(q) + '". Try part of a material name, a material number, or a location such as C-07.</p>';
  };

  P.renderExamples = function (onPick) {
    const ex = ['Gate valve', 'Bearing', 'Transmitter', 'C-07', 'Pipe', 'Solvent'];
    $('examples').innerHTML = ex.map((e) => '<button class="chip" data-ex="' + esc(e) + '">' + esc(e) + '</button>').join('');
    $('examples').addEventListener('click', (e) => { const b = e.target.closest('[data-ex]'); if (b) onPick(b.dataset.ex); });
  };
})();
