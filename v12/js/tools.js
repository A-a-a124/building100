/* Building 100 - "Data & analysis" drawer: tabs registered by the add-on modules, plus toasts */
(function () {
  const B = window.B100;
  const $ = (id) => document.getElementById(id);
  const tabs = [];
  let current = null;

  const css = document.createElement('style');
  css.textContent = `
  .drawer { position: absolute; z-index: 5; top: 0; right: 0; bottom: 0; width: min(460px, 100%); background: var(--surface); border-left: 1px solid var(--line);
    box-shadow: var(--shadow); display: grid; grid-template-rows: auto auto 1fr; min-height: 0; }
  .drawer header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line); }
  .drawer header h3 { margin: 0; font: 700 16px var(--f-display); }
  .dtabs { display: flex; gap: 4px; padding: 8px 12px; border-bottom: 1px solid var(--line); overflow-x: auto; }
  .dtabs button { border: 1px solid transparent; background: transparent; padding: 6px 10px; border-radius: 8px; font-weight: 600; font-size: 13px; color: var(--muted); white-space: nowrap; }
  .dtabs button[aria-selected="true"] { background: var(--accent-strong); color: var(--accent-ink); }
  .dbody { overflow-y: auto; padding: 16px; display: grid; gap: 14px; align-content: start; min-height: 0; }
  .dbody h4 { margin: 0; font: 700 15px var(--f-display); }
  .dbody p { margin: 0; color: var(--muted); font-size: 13px; }
  .drop { border: 2px dashed var(--line); border-radius: 12px; padding: 22px; text-align: center; color: var(--muted); cursor: pointer; }
  .drop.over { border-color: var(--accent-strong); background: var(--surface-2); color: var(--ink); }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .stat { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
  .stat b { display: block; font: 600 20px var(--f-mono); }
  .stat small { color: var(--muted); font-size: 12px; }
  .dbody table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .dbody th, .dbody td { text-align: left; padding: 6px 6px; border-bottom: 1px solid var(--line); }
  .dbody th { color: var(--muted); font-weight: 600; }
  .dbody td.num { font-family: var(--f-mono); text-align: right; }
  .dbody td.good { color: var(--ok); font-weight: 600; } .dbody td.bad { color: var(--bad); font-weight: 600; }
  .dbody select, .dbody input[type=number] { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); }
  .dbody label.f { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
  .btnrow { display: flex; gap: 8px; flex-wrap: wrap; }
  .dbody canvas { width: 100%; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; }
  .toast { position: fixed; z-index: 30; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--ink); color: var(--bg); padding: 10px 16px; border-radius: 10px;
    font-weight: 600; box-shadow: var(--shadow); max-width: min(560px, calc(100% - 32px)); }
  @media print { body * { visibility: hidden !important; } #printReport, #printReport * { visibility: visible !important; } #printReport { position: absolute; inset: 0; padding: 24px; background: #fff; color: #000; } }
  `;
  document.head.appendChild(css);

  const drawer = document.createElement('aside');
  drawer.className = 'drawer';
  drawer.hidden = true;
  drawer.innerHTML = '<header><h3>Data &amp; analysis</h3><button class="chip" id="drawerClose">Close</button></header><nav class="dtabs" id="dtabs"></nav><div class="dbody" id="dbody"></div>';
  $('stage').appendChild(drawer);
  $('drawerClose').addEventListener('click', () => (drawer.hidden = true));

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.id = 'toolsBtn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>Data &amp; analysis';
  $('tourBtn').before(btn);
  btn.addEventListener('click', () => (drawer.hidden ? open(current || tabs[0].id) : (drawer.hidden = true)));

  function renderTabs() {
    $('dtabs').innerHTML = tabs.map((t) => '<button data-tab="' + t.id + '" aria-selected="' + (t.id === current) + '">' + t.label + '</button>').join('');
  }
  $('dtabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) open(b.dataset.tab); });
  function open(id) {
    current = id;
    drawer.hidden = false;
    renderTabs();
    const t = tabs.find((q) => q.id === id);
    $('dbody').innerHTML = '';
    t.render($('dbody'));
  }
  let toastTimer = null;
  function toast(msg, ms) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), ms || 3500);
  }
  // downloads work on the public site; inside some embedded viewers they are blocked
  function download(name, text, type) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { toast('Download is not available in this viewer. Open the public site to export.'); }
  }
  const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

  B.tools = { add: (t) => { tabs.push(t); if (!current) current = t.id; }, open, toast, download, fmt, isOpen: (id) => !drawer.hidden && current === id, refresh: () => { if (!drawer.hidden) open(current); } };
})();
