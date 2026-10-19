/* Building 100 - import real stock from an SAP / WMS export (CSV or Excel) and place it in the racks */
(function () {
  const B = window.B100, W = B.world, S = B.sim, P = B.panel;
  const KEY = 'b100.import';
  const COLS = {
    mat: ['material', 'material number', 'material no', 'material no.', 'matnr', 'item', 'item number', 'sku', 'part number'],
    desc: ['description', 'material description', 'maktx', 'desc', 'short text', 'item description'],
    qty: ['quantity', 'qty', 'unrestricted', 'unrestricted stock', 'unrestricted use', 'stock', 'on hand', 'labst', 'total stock'],
    unit: ['unit', 'uom', 'base unit', 'base unit of measure', 'bun', 'meins'],
    bin: ['storage bin', 'bin', 'location', 'lgpla', 'bin location', 'storage location bin'],
    last: ['last movement', 'last goods movement', 'last movement date', 'last issue', 'last gr date', 'date', 'days since movement', 'days'],
    group: ['category', 'material group', 'matkl', 'group'],
  };
  const CAT_WORDS = [
    ['valve', /valve/i], ['flange', /flange|elbow|tee|reducer|fitting|coupling|nipple/i], ['gasket', /gasket|stud|bolt|nut|ring|washer/i],
    ['elec', /cable|motor|breaker|light|lamp|electric|switch|transformer|fuse/i], ['mech', /bearing|seal|filter|belt|pump|impeller|shaft|coupling/i],
    ['inst', /transmitter|gauge|sensor|rtd|thermocouple|instrument|analy[sz]er|controller/i], ['ppe', /helmet|boot|glove|ppe|goggle|mask|harness|eebd/i],
  ];
  const guessCat = (text, group) => { for (const [c, re] of CAT_WORDS) if (re.test(text + ' ' + (group || ''))) return c; return 'cons'; };

  // ---------- parsing ----------
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', q = false;
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some((c) => c.trim())) rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    row.push(cell); if (row.some((c) => c.trim())) rows.push(row);
    return rows;
  }
  function loadXLSXLib() {
    return new Promise((res, rej) => {
      if (window.XLSX) return res(window.XLSX);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error('Could not load the Excel reader. Save the sheet as CSV and try again.'));
      document.head.appendChild(s);
    });
  }
  async function readFile(file) {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const X = await loadXLSXLib();
      const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
    }
    return parseCSV(await file.text());
  }
  function mapColumns(header) {
    const h = header.map((x) => String(x).trim().toLowerCase());
    const out = {};
    for (const k in COLS) out[k] = h.findIndex((x) => COLS[k].includes(x));
    return out;
  }
  function toDays(v) {
    if (v === '' || v == null) return 30;
    if (v instanceof Date) return Math.max(0, Math.round((Date.now() - v.getTime()) / 864e5));
    const n = Number(v);
    if (!isNaN(n)) return n > 20000 && n < 80000 ? Math.max(0, Math.round((Date.now() - (n - 25569) * 864e5) / 864e5)) : Math.max(0, Math.round(n));
    const d = Date.parse(String(v).replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1'));
    return isNaN(d) ? 30 : Math.max(0, Math.round((Date.now() - d) / 864e5));
  }
  const CODE = /^([A-N])\W?0?(\d{1,2})\W?(\d)\W?([12])$/i;

  // ---------- apply ----------
  function apply(rows, label) {
    const c = mapColumns(rows[0]);
    if (c.mat < 0 && c.desc < 0) throw new Error('No "Material" or "Description" column was found. Use the template headers.');
    if (c.qty < 0) throw new Error('No "Quantity" column was found. Use the template headers.');
    const recs = rows.slice(1).map((r) => ({
      mat: c.mat >= 0 ? String(r[c.mat]).trim() : '', desc: c.desc >= 0 ? String(r[c.desc]).trim() : '', qty: Number(String(r[c.qty]).replace(/,/g, '')) || 0,
      unit: c.unit >= 0 ? String(r[c.unit]).trim() || 'EA' : 'EA', bin: c.bin >= 0 ? String(r[c.bin]).trim() : '', days: c.last >= 0 ? toDays(r[c.last]) : 30, group: c.group >= 0 ? String(r[c.group]) : '',
    })).filter((r) => (r.mat || r.desc) && r.qty > 0);
    // rebuild the item catalogue in place so every module keeps its references
    B.ITEMS.length = 0;
    Object.keys(B.itemsByCat).forEach((k) => (B.itemsByCat[k].length = 0));
    const byMat = new Map();
    recs.forEach((r) => {
      const key = r.mat || r.desc;
      if (!byMat.has(key)) {
        const cat = guessCat(r.desc, r.group);
        const it = { i: B.ITEMS.length, cat, name: r.desc || 'Material ' + r.mat, spec: r.group || '', unit: r.unit.toUpperCase(), per: r.qty, h: 0.6 + (B.ITEMS.length % 5) * 0.15, mat: r.mat || '-' };
        B.ITEMS.push(it);
        (B.itemsByCat[cat] = B.itemsByCat[cat] || []).push(it.i);
        byMat.set(key, it);
      }
      r.item = byMat.get(key);
    });
    B.SLOTS.forEach((s) => { s.item = -1; s.qty = 0; s.days = 0; s.reserved = false; });
    const byCode = new Map(B.SLOTS.map((s) => [s.code, s]));
    let exact = 0, auto = 0, unplaced = 0;
    const later = [];
    recs.forEach((r) => {
      const m = r.bin.match(CODE);
      const s = m && byCode.get(m[1].toUpperCase() + '-' + m[2].padStart(2, '0') + '-' + m[3] + '-' + m[4]);
      if (s && s.item < 0) { place(s, r); exact++; } else later.push(r);
    });
    later.forEach((r) => {
      const rows = B.ROW_CAT.map((cat, i) => (cat === r.item.cat ? i : -1)).filter((i) => i >= 0);
      const s = B.SLOTS.find((q) => q.item < 0 && rows.includes(q.row)) || B.SLOTS.find((q) => q.item < 0);
      if (s) { place(s, r); auto++; } else unplaced++;
    });
    B.SLOTS.forEach((s) => W.updateSlot(s, true));
    W.flagPallets();
    S.occ = B.occupiedCount();
    P.renderZones();
    B.importInfo = { label, rows: recs.length, items: B.ITEMS.length, exact, auto, unplaced, when: new Date().toLocaleString('en-GB') };
    if (B.slotting) B.slotting.clear();
    return B.importInfo;
  }
  function place(s, r) { s.item = r.item.i; s.qty = r.qty; s.days = r.days; }

  async function handle(file) {
    try {
      const rows = await readFile(file);
      if (rows.length < 2) throw new Error('The file has no data rows.');
      const info = apply(rows, file.name);
      try { if (rows.length < 20000) localStorage.setItem(KEY, JSON.stringify({ label: file.name, rows })); } catch (e) {}
      B.tools.toast('Loaded ' + B.tools.fmt(info.rows) + ' stock lines from ' + file.name);
      B.tools.refresh();
    } catch (e) { B.tools.toast(e.message, 6000); }
  }

  const TEMPLATE = 'Material,Description,Quantity,Unit,Storage Bin,Last Movement,Material Group\n' +
    '1000123456,"GATE VALVE 6IN ANSI 300 CS",4,EA,C-07-1-1,2026-09-14,VALVES\n' +
    '1000123457,"BEARING 6316-2Z/C3",20,EA,H-03-2-2,2026-03-02,MECH SPARES\n' +
    '1000123458,"PRESSURE TRANSMITTER 0-100 BAR",12,EA,,2025-11-20,INSTRUMENTS\n';

  function render(el) {
    const info = B.importInfo;
    el.innerHTML = `
      <h4>Load your real stock</h4>
      <p>Export stock from SAP (for example MB52 or LX02) or your WMS as Excel or CSV. Bins that match the rack codes (like C-07-3-1) go to that exact slot. Everything else is placed in its category's rows.</p>
      <label class="drop" id="drop" tabindex="0">Drop an .xlsx or .csv file here, or click to choose<input type="file" id="file" accept=".csv,.xlsx,.xls" hidden></label>
      <p>Recognised columns: Material, Description, Quantity, Unit, Storage Bin, Last Movement (date or days), Material Group. Your file stays in this browser and is never uploaded.</p>
      <div class="btnrow"><button class="btn" id="tpl">Download template</button><button class="btn" id="restore">Restore sample data</button></div>
      ${info ? `<h4>Current data: ${B.panel.esc(info.label)}</h4><div class="row2">
        <div class="stat"><b>${B.tools.fmt(info.rows)}</b><small>stock lines read</small></div><div class="stat"><b>${B.tools.fmt(info.items)}</b><small>distinct materials</small></div>
        <div class="stat"><b>${B.tools.fmt(info.exact)}</b><small>placed by bin code</small></div><div class="stat"><b>${B.tools.fmt(info.auto)}</b><small>auto-placed by category</small></div></div>
        ${info.unplaced ? `<p style="color:var(--bad)">${B.tools.fmt(info.unplaced)} lines did not fit: the racks are full.</p>` : ''}` : '<p><b>Now showing:</b> sample data.</p>'}`;
    const drop = el.querySelector('#drop'), inp = el.querySelector('#file');
    drop.addEventListener('click', () => inp.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') inp.click(); });
    inp.addEventListener('change', () => inp.files[0] && handle(inp.files[0]));
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && handle(e.dataTransfer.files[0]));
    el.querySelector('#tpl').addEventListener('click', () => B.tools.download('building100-stock-template.csv', TEMPLATE));
    el.querySelector('#restore').addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); });
  }

  B.tools.add({ id: 'data', label: 'Data', render });
  // reload the last import kept in this browser
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && !/[?&]capture/.test(location.search)) apply(saved.rows, saved.label);
  } catch (e) {}
  B.importer = { apply, parseCSV };
})();
