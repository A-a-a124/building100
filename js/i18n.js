/* Building 100 - English / Arabic switch: translates the page as it renders, flips the layout to right-to-left, relabels the 3D scene */
(function () {
  const B = window.B100;
  const { AR, RULES } = B.i18n;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  let lang = store.get('b100.lang') === 'ar' && !/[?&]capture/.test(location.search) ? 'ar' : 'en';
  const MID = /^(.+) · (.+)$/;

  function trText(s) {
    const k = s.trim();
    if (!k) return s;
    let out = AR[k];
    if (!out) for (const [re, rep] of RULES) if (re.test(k)) { out = k.replace(re, rep); break; }
    if (!out && MID.test(k)) { const [, a, b] = k.match(MID); if (AR[a] || AR[b]) out = (AR[a] || a) + ' · ' + (AR[b] || b); }
    return out ? s.replace(k, out) : s;
  }
  B.tr = (s) => (lang === 'ar' ? trText(s) : s);

  const SKIP = new Set(['SCRIPT', 'STYLE', 'CANVAS', 'TEXTAREA', 'svg']);
  const ATTRS = ['placeholder', 'aria-label', 'title'];
  function doText(n) {
    if (n.__en === undefined) n.__en = n.nodeValue;
    const v = lang === 'ar' ? trText(n.__en) : n.__en;
    n.__ar = v;
    if (n.nodeValue !== v) n.nodeValue = v;
  }
  function doEl(el) {
    ATTRS.forEach((a) => {
      if (!el.hasAttribute(a)) return;
      const key = '__en_' + a;
      if (el[key] === undefined) el[key] = el.getAttribute(a);
      el.setAttribute(a, lang === 'ar' ? trText(el[key]) : el[key]);
    });
  }
  function walk(node) {
    if (node.nodeType === 3) return doText(node);
    if (node.nodeType !== 1 || SKIP.has(node.tagName) || (node.classList && (node.classList.contains('code') || node.classList.contains('clock')))) return;
    doEl(node);
    node.childNodes.forEach(walk);
  }
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') {
        const n = m.target;
        if (n.__ar === n.nodeValue) continue; // our own change
        n.__en = n.nodeValue;
        doText(n);
      } else m.addedNodes.forEach((n) => { if (n.nodeType === 3) n.__en = undefined; walk(n); });
    }
  });

  // name tags above people are canvas sprites: rebuild them in the chosen language
  function retag() {
    if (!B.actors || !B.world.makeLabel) return;
    B.actors.list.forEach((a) => {
      const old = a.mesh.userData.tag;
      if (!old) return;
      const tag = B.world.makeLabel(B.tr(a.name), { size: 0.62, bg: 'rgba(242,179,27,0.96)', fg: '#1a1300', weight: 700 });
      tag.position.copy(old.position); tag.visible = old.visible;
      a.mesh.remove(old); a.mesh.add(tag);
      a.mesh.userData.tag = tag;
    });
  }

  const css = document.createElement('style');
  css.textContent = `[dir="rtl"] .res, [dir="rtl"] .zbtn, [dir="rtl"] .dbody th, [dir="rtl"] .dbody td { text-align: right; }
    [dir="rtl"] .dbody td.num { text-align: left; } [dir="rtl"] .kpi b, [dir="rtl"] .clock, [dir="rtl"] .code, [dir="rtl"] .loc { direction: ltr; unicode-bidi: isolate; }
    [lang="ar"] body { font-family: "IBM Plex Sans Arabic", "IBM Plex Sans", Tahoma, sans-serif; }
    [lang="ar"] h1, [lang="ar"] h2, [lang="ar"] h3, [lang="ar"] h4 { font-family: "IBM Plex Sans Arabic", "Archivo", Tahoma, sans-serif; letter-spacing: 0; }`;
  document.head.appendChild(css);
  if (!document.querySelector('link[href*="IBM+Plex+Sans+Arabic"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.id = 'langBtn';
  document.getElementById('helpBtn').after(btn);
  function setLang(l, initial) {
    lang = l;
    if (!initial) store.set('b100.lang', l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    btn.textContent = l === 'ar' ? 'English' : 'عربي';
    btn.__en = undefined;
    obs.disconnect();
    walk(document.body);
    btn.firstChild.__ar = btn.textContent;
    btn.firstChild.__en = btn.textContent;
    if (l === 'ar') obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    if (B.world && B.world.labels) B.world.buildLabels();
    retag();
    window.dispatchEvent(new Event('resize'));
  }
  btn.addEventListener('click', () => setLang(lang === 'ar' ? 'en' : 'ar'));
  // apply after the other modules have built their parts of the page
  setTimeout(() => setLang(lang, true), 0);
  B.lang = () => lang;
})();
