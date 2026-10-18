/* Building 100 - warehouse layout and inventory (illustrative sample data) */
(function () {
  const B = (window.B100 = window.B100 || {});

  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  B.rng = rng;
  const R = rng(100);

  // Building is 120 x 70 m, 12 m high. North = negative z
  B.BUILDING = { x0: -60, x1: 60, z0: -35, z1: 35, h: 12 };
  // Forklift lane network
  B.LANES = { west: -31, east: 34, front: -22, back: 23 };

  B.ZONES = [
    { id: 'RCV', name: 'Receiving', x: [-58, -20], z: [-33, -24], color: '#3a7bd5', labelY: 4,
      desc: 'Inbound trucks dock at 4 doors on the north wall. Pallets are unloaded into the staging lane, booked into the system, then put away by forklift.',
      capacity: '4 dock doors, 24 staging positions' },
    { id: 'QC', name: 'Quality Inspection', x: [-58, -38], z: [-20, -9], color: '#7d5bc6', labelY: 4,
      desc: 'Incoming material is checked against the purchase order before storage. Non-conforming items stay on hold here until a decision is made.',
      capacity: '12 pallets, 2 inspection tables' },
    { id: 'PIPE', name: 'Pipe & Large Valve Yard', x: [-58, -35], z: [-5, 32], color: '#8a6a4a', labelY: 6,
      desc: 'Cantilever racks holding 12 m pipe lengths on three arm levels.',
      capacity: '3 cantilever racks, 216 pipe bundles' },
    { id: 'RACK', name: 'Pallet Racking', x: [-28, 32], z: [-20, 21], color: '#2a8c82', labelY: 11,
      desc: 'Selective racking in 12 rows (A to L). Each row has 20 bays, each bay 5 levels with 2 pallets per level. Every row is served from the aisle in front of it.',
      capacity: '2,400 pallet positions' },
    { id: 'SHELF', name: 'Small Parts Store', x: [38, 58], z: [-30, 1], color: '#4f7cac', labelY: 4.5,
      desc: 'Bin shelving for small, high-value spares: bearings, seals, O-rings, fuses and instrument parts.',
      capacity: '6 shelving runs, about 1,300 bins' },
    { id: 'HAZ', name: 'Hazardous Materials Cage', x: [38, 58], z: [6, 32], color: '#c0392b', labelY: 4.5,
      desc: 'Fenced cage with a spill-containment floor. Permit-only entry. Drums sit on spill pallets and gas cylinders are chained in racks.',
      capacity: '96 drums, 24 gas cylinders' },
    { id: 'DSP', name: 'Shipping & Issue', x: [-22, 32], z: [25, 33], color: '#d08a12', labelY: 4,
      desc: 'Issue orders are assembled here, then loaded onto project and plant trucks through 4 doors on the south wall.',
      capacity: '4 dock doors, 24 marshalling positions' },
    { id: 'OFF', name: 'Warehouse Office', x: [-16, -2], z: [-33, -25], color: '#5d6d7e', labelY: 5.5,
      desc: 'Storekeeper and shift supervisor office, and the document issue counter.',
      capacity: '8 workstations' },
    { id: 'CHG', name: 'Forklift Charging', x: [2, 16], z: [-33, -27], color: '#3f8f4f', labelY: 3.5,
      desc: 'Electric forklifts park here to charge whenever they have no task.',
      capacity: '6 chargers' },
  ];
  B.zoneById = (id) => B.ZONES.find((z) => z.id === id);

  // Pallet racking
  const RACK = (B.RACK = { x0: -26, bays: 20, bayW: 2.8, levels: 5, levelH: 1.75, depth: 1.2, pairs: 6, z0: -16, pitch: 6.2, back: 0.2, rows: [] });
  const letters = 'ABCDEFGHIJKL';
  for (let k = 0; k < RACK.pairs; k++) {
    const za = RACK.z0 + k * RACK.pitch;
    const zb = za + RACK.depth + RACK.back;
    RACK.rows.push({ letter: letters[2 * k], z: za, access: za - RACK.depth / 2 - 1.8 });
    RACK.rows.push({ letter: letters[2 * k + 1], z: zb, access: zb + RACK.depth / 2 + 1.8 });
  }

  B.CATS = {
    valve: { name: 'Valves', color: '#d9653b' },
    flange: { name: 'Flanges & Fittings', color: '#c9a227' },
    gasket: { name: 'Gaskets & Bolting', color: '#5f9e4f' },
    elec: { name: 'Electrical', color: '#3a7bc8' },
    mech: { name: 'Mechanical Spares', color: '#8a6fc4' },
    inst: { name: 'Instrumentation', color: '#2fa39a' },
    ppe: { name: 'Safety / PPE', color: '#c7608f' },
    cons: { name: 'Consumables & Lubes', color: '#8c949c' },
  };
  B.UNITS = { EA: 'ea', RL: 'reel', PR: 'pair', DR: 'drum', PL: 'pail', KG: 'kg', M: 'm', CY: 'cyl' };

  const RAW = [
    ['valve', 'Gate Valve', '6 in, ANSI 300, carbon steel', 'EA', 4, 1.0],
    ['valve', 'Ball Valve', '2 in, ANSI 600', 'EA', 24, 0.8],
    ['valve', 'Check Valve', '4 in, ANSI 150, swing type', 'EA', 8, 0.9],
    ['valve', 'Pressure Relief Valve', '1x2 in, set 150 psi', 'EA', 10, 0.9],
    ['valve', 'Butterfly Valve', '10 in, ANSI 150, wafer', 'EA', 3, 1.1],
    ['flange', 'Weld Neck Flange', '8 in, ANSI 300, RF', 'EA', 12, 0.7],
    ['flange', '90 Degree Elbow', '6 in, SCH 40, butt weld', 'EA', 30, 0.9],
    ['flange', 'Equal Tee', '4 in, SCH 80', 'EA', 40, 0.8],
    ['flange', 'Concentric Reducer', '6 x 4 in', 'EA', 36, 0.8],
    ['gasket', 'Spiral Wound Gasket', '4 in, ANSI 300, 316SS', 'EA', 400, 0.6],
    ['gasket', 'B7 Stud Bolts with Nuts', '7/8 x 6 in', 'EA', 600, 0.6],
    ['gasket', 'RTJ Ring Gasket', 'R-45, soft iron', 'EA', 250, 0.5],
    ['elec', 'Power Cable Reel', '3 x 95 mm2, 0.6/1 kV, 500 m', 'RL', 1, 1.25],
    ['elec', 'Electric Motor', '75 kW, 4-pole, 400 V', 'EA', 1, 1.0],
    ['elec', 'Circuit Breaker', '630 A, 3-pole', 'EA', 6, 0.8],
    ['elec', 'Explosion-Proof Light Fitting', 'LED 60 W, Zone 1', 'EA', 16, 0.9],
    ['mech', 'Deep Groove Ball Bearing', '6316-2Z/C3', 'EA', 20, 0.6],
    ['mech', 'Pump Mechanical Seal', '65 mm shaft', 'EA', 8, 0.6],
    ['mech', 'Turbine Lube Oil Filter', '10 micron element', 'EA', 24, 1.0],
    ['mech', 'V-Belt', 'SPB section, 2500 mm', 'EA', 50, 0.7],
    ['inst', 'Pressure Transmitter', '0-100 bar, 4-20 mA, HART', 'EA', 12, 0.7],
    ['inst', 'RTD Temperature Sensor', 'PT100 with thermowell', 'EA', 40, 0.6],
    ['inst', 'Control Valve', '3 in, pneumatic actuator', 'EA', 2, 1.2],
    ['inst', 'Pressure Gauge', '100 mm dial, 0-25 bar', 'EA', 60, 0.6],
    ['ppe', 'Safety Helmet', 'Adjustable ratchet', 'EA', 120, 1.1],
    ['ppe', 'Safety Boots', 'Steel toe, mixed sizes', 'PR', 48, 1.0],
    ['ppe', 'Emergency Escape Breathing Device', 'EEBD, 15 min', 'EA', 20, 0.9],
    ['ppe', 'Chemical-Resistant Gloves', 'Nitrile', 'PR', 300, 0.9],
    ['cons', 'Lube Oil Drum', 'ISO VG 46, 208 L', 'DR', 4, 1.2],
    ['cons', 'Industrial Grease', 'NLGI 2, 18 kg pail', 'PL', 24, 0.8],
    ['cons', 'Welding Electrodes', 'E7018, 3.2 mm', 'KG', 500, 0.6],
    ['cons', 'Cutting Discs', '230 mm', 'EA', 800, 0.7],
  ];
  const matNo = () => '10' + String(Math.floor(R() * 1e8)).padStart(8, '0');
  B.ITEMS = RAW.map(([cat, name, spec, unit, per, h], i) => ({ i, cat, name, spec, unit, per, h, mat: matNo() }));
  const byCat = {};
  B.ITEMS.forEach((it) => (byCat[it.cat] = byCat[it.cat] || []).push(it.i));
  B.itemsByCat = byCat;

  // Each row is assigned a main category, with some mixing as in real stores
  const ROW_CAT = ['valve', 'valve', 'flange', 'flange', 'gasket', 'elec', 'elec', 'mech', 'mech', 'inst', 'ppe', 'cons'];
  B.ROW_CAT = ROW_CAT;
  B.randomItemForRow = function (ri, r) {
    r = r || R;
    const cat = r() < 0.82 ? ROW_CAT[ri] : Object.keys(byCat)[Math.floor(r() * 8)];
    const list = byCat[cat];
    return list[Math.floor(r() * list.length)];
  };

  B.SLOTS = [];
  RACK.rows.forEach((row, ri) => {
    for (let b = 0; b < RACK.bays; b++) {
      for (let l = 0; l < RACK.levels; l++) {
        for (let p = 0; p < 2; p++) {
          const s = {
            i: B.SLOTS.length, row: ri, letter: row.letter, bay: b + 1, level: l + 1, pos: p + 1,
            x: RACK.x0 + b * RACK.bayW + (p === 0 ? 0.7 : 2.1), y: l * RACK.levelH + (l > 0 ? 0.07 : 0),
            z: row.z, access: row.access, item: -1, qty: 0, days: 0, reserved: false,
          };
          s.code = row.letter + '-' + String(b + 1).padStart(2, '0') + '-' + (l + 1) + '-' + (p + 1);
          if (R() < 0.74) {
            const it = B.ITEMS[B.randomItemForRow(ri)];
            s.item = it.i;
            s.qty = Math.max(1, Math.round(it.per * (0.35 + 0.65 * R())));
            s.days = Math.floor(Math.pow(R(), 2.2) * 420);
          }
          B.SLOTS.push(s);
        }
      }
    }
  });

  // Stock held outside the pallet racking
  const Z = (zone, name, spec, unit, qty, loc) => ({ zone, name, spec, unit, qty, loc, mat: matNo() });
  B.ZONE_ITEMS = [
    Z('PIPE', 'Carbon Steel Pipe', '6 in, SCH 40, 12 m lengths', 'M', 1440, 'Cantilever rack P1'),
    Z('PIPE', 'Carbon Steel Pipe', '8 in, SCH 40, 12 m lengths', 'M', 960, 'Cantilever rack P1'),
    Z('PIPE', 'Carbon Steel Pipe', '12 in, STD, 12 m lengths', 'M', 576, 'Cantilever rack P2'),
    Z('PIPE', 'Stainless Steel Pipe', '4 in, 316L, 6 m lengths', 'M', 720, 'Cantilever rack P3'),
    Z('PIPE', 'Epoxy-Lined Pipe', '10 in, 12 m lengths', 'M', 432, 'Cantilever rack P2'),
    Z('HAZ', 'Industrial Solvent', '200 L drum, flammable liquid', 'DR', 28, 'Haz cage, row 1'),
    Z('HAZ', 'Acid Cleaner', '200 L drum, corrosive', 'DR', 20, 'Haz cage, row 2'),
    Z('HAZ', 'Epoxy Paint', '20 L pail', 'PL', 140, 'Haz cage, row 3'),
    Z('HAZ', 'Nitrogen Cylinder', '50 L, 200 bar', 'CY', 14, 'Cylinder rack'),
    Z('HAZ', 'Acetylene Cylinder', '40 L', 'CY', 10, 'Cylinder rack'),
    Z('SHELF', 'O-Ring Kit', 'Viton, assorted sizes', 'EA', 5200, 'Shelves S1-S2'),
    Z('SHELF', 'Industrial Fuses', '10-100 A', 'EA', 1800, 'Shelf S3'),
    Z('SHELF', 'Needle Roller Bearing', 'NK 35/20', 'EA', 340, 'Shelf S4'),
    Z('SHELF', 'Small-Bore Tube Fittings', '1/2 in, 316SS', 'EA', 2600, 'Shelves S5-S6'),
    Z('QC', 'Valve Shipment Awaiting Inspection', 'PO 4500, 18 pieces', 'EA', 18, 'Inspection area'),
    Z('QC', 'Cable on Hold (Non-Conformance)', 'Missing test certificate', 'RL', 3, 'Hold area'),
  ];

  B.occupiedCount = () => B.SLOTS.reduce((n, s) => n + (s.item >= 0 ? 1 : 0), 0);

  // Search matches location code, material number, name or category
  const norm = (t) => String(t).toLowerCase().trim();
  B.search = function (q) {
    const nq = norm(q);
    if (!nq) return { slots: [], materials: [] };
    const slots = [];
    if (/^[a-l](-|\d|$)/i.test(nq)) {
      const cq = nq.toUpperCase().replace(/-/g, '');
      for (const s of B.SLOTS) if (s.code.replace(/-/g, '').startsWith(cq)) slots.push(s);
    }
    const materials = [];
    for (const it of B.ITEMS) {
      if (norm(it.name + ' ' + it.spec + ' ' + B.CATS[it.cat].name).includes(nq) || it.mat.includes(nq)) {
        const locs = B.SLOTS.filter((s) => s.item === it.i);
        materials.push({ kind: 'rack', item: it, locs, total: locs.reduce((n, s) => n + s.qty, 0) });
      }
    }
    for (const zi of B.ZONE_ITEMS) {
      if (norm(zi.name + ' ' + zi.spec).includes(nq) || zi.mat.includes(nq)) materials.push({ kind: 'zone', item: zi, total: zi.qty });
    }
    return { slots: slots.slice(0, 60), materials: materials.slice(0, 30) };
  };
})();
