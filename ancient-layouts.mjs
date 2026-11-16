/**
 * Ancient Architecture Circuit Lab: reference-inspired diagram geometry only.
 * Coordinates are illustrative SVG units, not surveyed/geospatial coordinates.
 * The components and PCB routes are modern teaching inventions, never ancient artifacts.
 */
export const LAYOUTS = {
  solomon: {
    id: 'solomon',
    name: "Solomon's Temple",
    era: 'Biblical architectural description',
    subtitle: '1 Kings 6:2–3, 16–20',
    orientation: 'Traditional east-facing reconstruction; schematic, not a recovered blueprint.',
    claim: 'Textual proportions: house 60 × 20 cubits; porch projects 10 cubits; inner sanctuary 20 × 20 cubits. Wall and side-room details are simplified.',
    evidence: 'TEXTUAL RECONSTRUCTION',
    sources: [
      { label: '1 Kings 6', url: 'https://www.biblegateway.com/passage/?search=1%20Kings%206&version=NIV' }
    ],
    shapes: [
      { kind: 'rect', x: 80, y: 160, w: 520, h: 210, label: 'Side rooms (schematic)', dashed: true },
      { kind: 'rect', x: 130, y: 195, w: 420, h: 140, label: 'House: 60 × 20 cubits' },
      { kind: 'rect', x: 60, y: 195, w: 70, h: 140, label: 'Porch 10 × 20' },
      { kind: 'rect', x: 410, y: 195, w: 140, h: 140, label: 'Inner sanctuary 20 × 20', accent: true },
      { kind: 'line', x1: 130, y1: 195, x2: 130, y2: 335 },
      { kind: 'line', x1: 410, y1: 195, x2: 410, y2: 335 }
    ],
    landmarks: [
      { x: 60, y: 173, label: 'PORCH' },
      { x: 215, y: 260, label: 'MAIN HALL' },
      { x: 428, y: 260, label: 'MOST HOLY' },
      { x: 586, y: 145, label: 'EAST ← / → WEST (view flipped)' }
    ],
    circuit: {
      battery: [92, 265], switch: [184, 265], resistor: [318, 265], led: [477, 265], ground: [614, 265],
      returnBends: [[650, 420], [48, 420]]
    }
  },
  ezekiel: {
    id: 'ezekiel',
    name: "Ezekiel's Vision",
    era: 'Prophetic temple description',
    subtitle: 'Ezekiel 40–48',
    orientation: 'Representative arrangement; the text contains translation and reconstruction ambiguities.',
    claim: 'Court enclosure 500 × 500 cubits, inner court 100 × 100 cubits. Gatehouses, altar, and sanctuary are indicative, not to survey scale.',
    evidence: 'VISION / TEXTUAL RECONSTRUCTION',
    sources: [
      { label: 'Ezekiel 40–48', url: 'https://www.biblegateway.com/passage/?search=Ezekiel%2040-48&version=NIV' },
      { label: 'Measurements with uncertainties', url: 'https://ot-translation-aids.net/sites/www.ot-translation-aids.net/files/Ezekiel%27s%20Temple%20-%20Structures%20%26%20Measurements_0.pdf' }
    ],
    shapes: [
      { kind: 'rect', x: 151, y: 56, w: 444, h: 444, label: 'Outer enclosure: 500 × 500 cubits' },
      { kind: 'rect', x: 322, y: 210, w: 89, h: 89, label: 'Inner court 100 × 100', accent: true },
      { kind: 'rect', x: 240, y: 225, w: 82, h: 60, label: 'Temple' },
      { kind: 'rect', x: 595, y: 252, w: 29, h: 52, label: 'East gate' },
      { kind: 'rect', x: 360, y: 35, w: 52, h: 21, label: 'North gate' },
      { kind: 'rect', x: 360, y: 500, w: 52, h: 20, label: 'South gate' },
      { kind: 'rect', x: 404, y: 245, w: 28, h: 28, label: 'Altar' }
    ],
    landmarks: [
      { x: 194, y: 95, label: 'OUTER COURT' },
      { x: 236, y: 207, label: 'SANCTUARY' },
      { x: 342, y: 230, label: 'INNER COURT' },
      { x: 452, y: 275, label: 'ALTAR → EAST GATE' }
    ],
    circuit: {
      battery: [576, 400], switch: [524, 276], resistor: [424, 276], led: [285, 276], ground: [163, 276],
      returnBends: [[111, 445], [645, 470]]
    }
  },
  teotihuacan: {
    id: 'teotihuacan',
    name: 'Teotihuacan',
    era: 'Mesoamerican archaeological city',
    subtitle: 'Mexico, ca. 100 BCE–650 CE (monumental center)',
    orientation: 'North upward for readability. The real avenue is rotated roughly 15.5° from geographic north.',
    claim: 'Actual relative relationships: Pyramid of the Moon at northern end of Avenue of the Dead; Pyramid of the Sun east of the avenue; Ciudadela to the south. This is an orientation sketch, not aerial imagery or a surveyed map.',
    evidence: 'ARCHAEOLOGICAL RELATIONSHIPS / NOT TO SCALE',
    sources: [
      { label: 'INAH: Avenue of the Dead', url: 'https://visitateotihuacan.inah.gob.mx/en/explore/avenue-of-the-dead/' },
      { label: 'Met Museum: Teotihuacan overview', url: 'https://www.metmuseum.org/essays/teotihuacan' }
    ],
    shapes: [
      { kind: 'rect', x: 346, y: 105, w: 60, h: 370, label: 'Avenue of the Dead', dashed: true },
      { kind: 'rect', x: 317, y: 39, w: 120, h: 117, label: 'Pyramid of the Moon', accent: true },
      { kind: 'rect', x: 445, y: 168, w: 147, h: 148, label: 'Pyramid of the Sun', accent: true },
      { kind: 'rect', x: 258, y: 353, w: 206, h: 144, label: 'Ciudadela' },
      { kind: 'rect', x: 336, y: 401, w: 56, h: 52, label: 'Feathered Serpent Temple' }
    ],
    landmarks: [
      { x: 352, y: 26, label: 'N ↑' },
      { x: 442, y: 70, label: 'MOON' },
      { x: 482, y: 233, label: 'SUN' },
      { x: 277, y: 377, label: 'CITADEL' },
      { x: 189, y: 261, label: 'AVENUE OF THE DEAD →' }
    ],
    circuit: {
      battery: [310, 444], switch: [378, 374], resistor: [378, 290], led: [513, 238], ground: [555, 130],
      returnBends: [[668, 125], [668, 525], [215, 525]]
    }
  }
};

export function getLayout(id) {
  return LAYOUTS[id] ?? LAYOUTS.solomon;
}

/**
 * Idealized demonstration ONLY: fixed 2 V LED drop; no LED curve/thermal/SPICE.
 * Netlist: source (+) -> switch -> resistor -> LED -> source (-).
 * Every placement is invented for this teaching circuit.
 */
export function analyzeCircuit({ voltage = 5, resistance = 330, closed = true } = {}) {
  const v = Number(voltage), r = Number(resistance);
  if (!Number.isFinite(v) || !Number.isFinite(r) || v < 0 || v > 24 || r <= 0) {
    throw new RangeError('Use a finite 0–24 V supply and positive resistance.');
  }
  const ledDrop = 2;
  const currentA = closed && v > ledDrop ? (v - ledDrop) / r : 0;
  return {
    voltageV: v, resistanceOhms: r, closed: Boolean(closed),
    ledDropV: currentA > 0 ? ledDrop : 0,
    currentA, currentMa: currentA * 1000,
    resistorPowerW: currentA * currentA * r,
    ledOn: currentA > 0,
    warning: currentA > 0.02 ? 'Above 20 mA: reduce voltage or increase resistance.' : ''
  };
}

export function netlistFor(id, options = {}) {
  const layout = getLayout(id);
  const result = analyzeCircuit(options);
  return {
    schema: 'phicircuitlab.architecture-netlist.v1',
    site: layout.id,
    evidence: layout.evidence,
    disclaimer: 'Modern illustrative circuit superimposed on source-inspired architecture; not evidence of ancient electrical technology, not a manufacturing-ready PCB.',
    parts: [
      { ref: 'V1', type: 'dc-source', positive: 'VCC', negative: 'GND', valueV: result.voltageV },
      { ref: 'SW1', type: 'switch', from: 'VCC', to: 'N1', closed: result.closed },
      { ref: 'R1', type: 'resistor', from: 'N1', to: 'N2', valueOhms: result.resistanceOhms },
      { ref: 'D1', type: 'led-idealized', anode: 'N2', cathode: 'GND', modelDropV: 2 }
    ],
    calculated: result
  };
}

export function validateLayouts() {
  for (const layout of Object.values(LAYOUTS)) {
    for (const name of ['battery', 'switch', 'resistor', 'led', 'ground']) {
      const p = layout.circuit[name];
      if (!Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n))) {
        throw new Error(layout.id + ': invalid ' + name + ' position');
      }
    }
    if (!layout.sources?.length || !layout.shapes?.length || !layout.evidence) {
      throw new Error(layout.id + ': missing provenance or geometry');
    }
  }
  return true;
}
