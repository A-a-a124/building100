/* Building 100 - KPI targets: each indicator tile shows its target and turns green, amber or red */
(function () {
  const B = window.B100, S = B.sim, P = B.panel;
  const fmt = (n, d) => B.tools.fmt(n, d);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  // [id, name, unit, good limit, warning limit, direction]: 'max' = lower is better, 'band' = between the two
  const T = [
    { id: 'occ', name: 'Rack occupancy', unit: '%', good: 85, warn: 92, dir: 'max', get: (k) => k.occ * 100 },
    { id: 'cycle', name: 'Order cycle time', unit: 'min', good: 60, warn: 90, dir: 'max', get: (k) => k.cycle },
    { id: 'util', name: 'Forklift utilisation', unit: '%', good: 55, warn: 85, dir: 'band', get: (k) => k.util * 100 },
    { id: 'open', name: 'Open tasks', unit: '', good: 15, warn: 30, dir: 'max', get: (k) => k.open },
    { id: 'near', name: 'Near misses', unit: '', good: 5, warn: 15, dir: 'max', get: () => S.st.nearMiss || 0 },
  ];
  try { const saved = JSON.parse(store.get('b100.targets') || '{}'); T.forEach((t) => { if (saved[t.id]) Object.assign(t, saved[t.id]); }); } catch (e) {}
  const save = () => store.set('b100.targets', JSON.stringify(Object.fromEntries(T.map((t) => [t.id, { good: t.good, warn: t.warn }]))));

  function state(t, v) {
    if (v == null || isNaN(v)) return '';
    if (t.dir === 'band') return v >= t.good && v <= t.warn ? 'kg' : v >= t.good * 0.6 && v <= Math.min(100, t.warn + 7) ? 'kw' : 'kb';
    return v <= t.good ? 'kg' : v <= t.warn ? 'kw' : 'kb';
  }
  const label = (t) => (t.dir === 'band' ? 'Target ' + t.good + '–' + t.warn + t.unit : 'Target ≤ ' + t.good + (t.unit === '%' ? '%' : t.unit ? ' ' + t.unit : ''));

  const css = document.createElement('style');
  css.textContent = `.kpi { position: relative; border-left-width: 4px !important; } .kpi.kg { border-left-color: var(--ok) !important; } .kpi.kw { border-left-color: #e2a400 !important; } .kpi.kb { border-left-color: var(--bad) !important; }
    .kpi .tgt { font-style: normal; font-size: 11px; font-weight: 600; } .kpi.kg .tgt { color: var(--ok); } .kpi.kw .tgt { color: #b27f00; } .kpi.kb .tgt { color: var(--bad); }`;
  document.head.appendChild(css);
  T.forEach((t) => { const b = document.getElementById('k_' + t.id); if (b) b.closest('.kpi').insertAdjacentHTML('beforeend', '<i class="tgt" id="tg_' + t.id + '"></i>'); });

  function paint() {
    const k = S.kpis();
    T.forEach((t) => {
      const b = document.getElementById('k_' + t.id); if (!b) return;
      const tile = b.closest('.kpi'), st = state(t, t.get(k));
      tile.classList.remove('kg', 'kw', 'kb'); if (st) tile.classList.add(st);
      document.getElementById('tg_' + t.id).textContent = label(t);
    });
  }
  let tm = 0;
  B.hooks.frame.push((dt) => { if ((tm += dt) > 0.5) { tm = 0; paint(); } });

  function render(el) {
    const k = S.kpis();
    el.innerHTML = `<h4>Targets</h4><p>Each indicator at the bottom has a target. Green means on target, amber means watch it, red means act. Change the limits to match your own standards; they are kept in this browser.</p>
      <table><thead><tr><th>Indicator</th><th class="num">Now</th><th class="num">Green up to</th><th class="num">Amber up to</th></tr></thead><tbody>
      ${T.map((t) => { const v = t.get(k), s = state(t, v); return '<tr><td>' + t.name + (t.dir === 'band' ? '<br><small>green between the two limits</small>' : '') + '</td><td class="num ' + (s === 'kg' ? 'good' : s === 'kb' ? 'bad' : '') + '">' + (v == null ? '-' : fmt(v, t.unit === 'min' ? 1 : 0) + (t.unit === '%' ? '%' : '')) + '</td><td class="num"><input type="number" data-t="' + t.id + '" data-k="good" value="' + t.good + '" style="width:70px"></td><td class="num"><input type="number" data-t="' + t.id + '" data-k="warn" value="' + t.warn + '" style="width:70px"></td></tr>'; }).join('')}</tbody></table>
      <div class="btnrow"><button class="btn" id="tgReset">Restore default targets</button></div>`;
    el.querySelectorAll('[data-t]').forEach((i) => i.addEventListener('change', () => { const t = T.find((q) => q.id === i.dataset.t); t[i.dataset.k] = +i.value || 0; save(); paint(); }));
    el.querySelector('#tgReset').addEventListener('click', () => { store.set('b100.targets', '{}'); location.reload(); });
  }
  B.tools.add({ id: 'targets', label: 'Targets', render });
  B.targets = { list: T, state };
})();
