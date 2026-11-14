import { simulateOhms, simulateLed, logicGate } from './circuits.mjs';
import { isAdvancedLab, advancedBenchMarkup, updateAdvancedBench } from './advanced-workbench.mjs';

// Curated original classroom content. A quiz unlocks completion only when all answers are correct.
const lessons = [
  {
    title: 'Electricity 101', subtitle: 'Voltage, current, resistance', lab: 'ohms', time: '15 min',
    intro: 'Electricity is the movement of charge. Voltage is the push, current is the flow, and resistance limits that flow.',
    objectives: ['Distinguish volts, amps, and ohms', 'Use Ohm’s law: I = V / R', 'Recognize why power matters'],
    concepts: [
      ['Voltage (V)', 'Electric potential difference. Think of it as the energy-per-charge difference that can drive current.'],
      ['Current (I)', 'The rate at which electric charge flows, measured in amperes (A). 1 mA is 0.001 A.'],
      ['Resistance (R)', 'How strongly a component opposes current, measured in ohms (Ω). For an ideal resistor: I = V / R.'],
      ['Power (P)', 'The rate of electrical energy transfer. For a resistor, P = V × I = I² × R.']
    ],
    challenge: 'Set 5 V and 1,000 Ω in the Ohm’s Law Bench. Predict the current before reading the measurement: it should be 5 mA.',
    quiz: [
      ['At 10 V across 1,000 Ω, what is the current?', ['1 mA', '10 mA', '100 mA'], 1],
      ['Which unit measures electrical resistance?', ['Ohms', 'Watts', 'Amperes'], 0]
    ]
  },
  {
    title: 'Series & Parallel', subtitle: 'Where electricity flows', lab: 'network', time: '15 min',
    intro: 'Two basic wiring arrangements shape nearly every circuit: series components share a path; parallel branches share a pair of nodes.',
    objectives: ['Describe series versus parallel wiring', 'Calculate total series resistance', 'Explain shared voltage in parallel branches'],
    concepts: [
      ['Series path', 'In a single series path, the same current passes through each component. Ideal resistances add: R_total = R1 + R2.'],
      ['Parallel branches', 'Ideal branches connected across the same two nodes have the same voltage. For two resistors: 1/R_total = 1/R1 + 1/R2.'],
      ['Open circuit', 'A broken path prevents current through that path.'],
      ['Short circuit', 'A very low-resistance path can draw excessive current. Real circuits need current limiting and protection.']
    ],
    challenge: 'Open the Series & Parallel Bench, set R1 to 500 Ω and R2 to 500 Ω, then compare series and parallel at 6 V. Predict the equivalent resistance, supply current, and each resistor’s voltage before switching. Next, explore the Voltage Divider bench to observe a load.',
    quiz: [
      ['Two 100 Ω resistors in series total:', ['50 Ω', '100 Ω', '200 Ω'], 2],
      ['Ideal parallel branches share the same:', ['Voltage', 'Current always', 'Resistance always'], 0]
    ]
  },
  {
    title: 'LEDs & Resistors', subtitle: 'Your first indicator circuit', lab: 'led', time: '20 min',
    intro: 'Light-emitting diodes allow current mainly in one direction. They normally require a current-limiting resistor.',
    objectives: ['Understand LED polarity and forward voltage', 'Calculate an approximate limiting resistor', 'Spot simulated overcurrent'],
    concepts: [
      ['Polarity', 'An LED has an anode and a cathode. Orientation matters: conventional current flows from anode to cathode when forward-biased.'],
      ['Forward voltage', 'An illuminated LED has a characteristic forward voltage that varies with color, current, temperature, and part number.'],
      ['Limit current', 'A first-pass resistor estimate is R = (V_supply - V_forward) / I_target. This classroom uses a simplified fixed forward-voltage model.'],
      ['Resistor rating', 'Check dissipated power: P = I²R. A resistor can overheat even when its resistance value is correct.']
    ],
    challenge: 'Choose a 5 V supply, red LED, and 330 Ω resistor. Compare the simulated current to a target of around 9 mA.',
    quiz: [
      ['Why do most basic LEDs need a series resistor?', ['To raise voltage', 'To limit current', 'To generate Wi-Fi'], 1],
      ['What can happen if an LED draws too much current?', ['It can be damaged', 'It becomes a capacitor', 'Nothing'], 0]
    ]
  },
  {
    title: 'Components & Signals', subtitle: 'Capacitors, diodes, transistors', lab: 'rc', time: '20 min',
    intro: 'Real electronics uses components to store energy, steer current, and control larger signals with smaller ones.',
    objectives: ['Recognize core component symbols', 'Explain a capacitor’s basic role', 'Differentiate diodes and transistors'],
    concepts: [
      ['Capacitor', 'Stores energy in an electric field and can smooth changes in voltage. Capacitors have voltage ratings; some types are polarized.'],
      ['Diode', 'Allows substantial current mainly in one direction when forward-biased. An LED is a diode that emits light.'],
      ['Transistor', 'Can act as an electronic switch or amplifier. Common families include MOSFETs and bipolar junction transistors.'],
      ['Sensor', 'Converts a physical condition, such as temperature or light, into a signal the circuit can measure.']
    ],
    challenge: 'Open RC Timing. Set R = 1,000 Ω, C = 100 µF. Find the time constant τ, compare capacitor voltage at 1τ and 5τ, and switch to discharge. Then explain why the curve changes when R doubles.',
    quiz: [
      ['Which component stores energy in an electric field?', ['Capacitor', 'Resistor', 'Fuse'], 0],
      ['Which component is widely used as an electronic switch?', ['Transistor', 'Wire label', 'Screw'], 0]
    ]
  },
  {
    title: 'Digital Logic', subtitle: 'The beginnings of computing', lab: 'logic', time: '20 min',
    intro: 'Digital logic treats signals as states, commonly 0 and 1. Logic gates combine input bits into output bits.',
    objectives: ['Read truth tables', 'Experiment with AND, OR, XOR, and their inverses', 'Explain a digital input and output'],
    concepts: [
      ['Binary signals', '0 and 1 represent logical states; physical voltage thresholds depend on the hardware family.'],
      ['AND', 'Outputs 1 only when both inputs are 1.'],
      ['OR and XOR', 'OR outputs 1 if either input is 1. XOR outputs 1 only if the inputs differ.'],
      ['Inverted gates', 'NAND, NOR, and XNOR are the inverted forms of AND, OR, and XOR.']
    ],
    challenge: 'In the Logic Bench, select XOR and test all four input pairs. Which pairs produce a 1?',
    quiz: [
      ['What is 1 AND 0?', ['0', '1', '2'], 0],
      ['Which gate outputs 1 when its two inputs differ?', ['AND', 'XOR', 'NOR'], 1]
    ]
  },
  {
    title: 'Microcontrollers', subtitle: 'Firmware meets physical inputs', lab: null, time: '25 min',
    intro: 'A microcontroller is a tiny computer designed to interact with sensors, controls, and other electronics.',
    objectives: ['Distinguish a microcontroller from a desktop CPU', 'Understand GPIO and ADC', 'Identify a safe first virtual ESP32 experiment'],
    concepts: [
      ['GPIO', 'General-purpose input/output pins can read digital signals or drive low-power outputs within their limits.'],
      ['ADC', 'An analog-to-digital converter measures analog signal levels and represents them with digital numbers.'],
      ['Firmware', 'Software stored and executed on the microcontroller. It initializes hardware, reads inputs, and controls behavior.'],
      ['First virtual project', 'Use a Wokwi ESP32 project to blink an LED and react to a pushbutton before trying a physical development board.']
    ],
    challenge: 'Open Wokwi from the Workbench resources. Build or open an ESP32 LED example and modify its blink timing.',
    quiz: [
      ['What does GPIO mean?', ['General-purpose input/output', 'Graphics power interface', 'Global packet inspector'], 0],
      ['What does an ADC do?', ['Converts analog input to a digital value', 'Charges a battery', 'Draws copper traces'], 0]
    ]
  },
  {
    title: 'Hardware Communication', subtitle: 'UART, I²C, SPI, and networking', lab: null, time: '20 min',
    intro: 'Electronics becomes a system when chips and devices exchange information using shared electrical and timing rules.',
    objectives: ['Compare UART, I²C, and SPI at a high level', 'Understand logic-level compatibility', 'Relate hardware messages to software protocols'],
    concepts: [
      ['UART', 'Typically asynchronous serial transmit and receive connections, with agreed baud rate and framing.'],
      ['I²C', 'A shared serial bus commonly using SDA (data) and SCL (clock), with devices selected by address.'],
      ['SPI', 'Clocked serial communication commonly using SCLK, MOSI, MISO, and a chip-select signal.'],
      ['Electrical limits', 'Devices must share compatible voltage levels and ground references. Pins must never exceed their documented ratings.']
    ],
    challenge: 'Draw two microcontrollers exchanging UART data. Label TX, RX, and common GND, then explain why TX connects to the other side’s RX.',
    quiz: [
      ['Which bus typically uses SDA and SCL?', ['I²C', 'HDMI', 'PCIe'], 0],
      ['What must be checked before connecting logic pins?', ['Voltage compatibility', 'Case color', 'Monitor resolution'], 0]
    ]
  },
  {
    title: 'PCB Design', subtitle: 'From schematic to copper', lab: null, time: '30 min',
    intro: 'A printed circuit board (PCB) connects components with copper traces rather than temporary jumper wires.',
    objectives: ['Explain the difference between schematic and layout', 'Recognize footprints and nets', 'Identify ERC, DRC, and fabrication files'],
    concepts: [
      ['Schematic', 'An abstract map of components, pin connections, power, and signal nets.'],
      ['Footprint', 'The physical pad and hole pattern for a specific package or connector.'],
      ['Routing', 'Copper traces connect nets. Spacing, widths, return paths, and protection matter.'],
      ['Checks and fabrication', 'Run electrical-rule checking (ERC), design-rule checking (DRC), inspect a 3D view, and export Gerber/drill data when ready.']
    ],
    challenge: 'Install free KiCad when possible, or study its documentation. Draft a schematic for one power source, one resistor, and one LED.',
    quiz: [
      ['A schematic primarily describes:', ['Electrical connectivity', 'Box artwork', 'Shipping cost'], 0],
      ['A footprint describes:', ['Physical board pads for a part', 'Firmware source code', 'Wi-Fi encryption'], 0]
    ]
  },
  {
    title: 'Φ Hardware Architect', subtitle: 'Design and review Node-01', lab: 'led', time: '30 min',
    intro: 'Combine fundamentals into a realistic design brief for an eventual physical device. Simulation comes before fabrication.',
    objectives: ['Write a requirements list', 'Plan power, controls, and feedback', 'Record assumptions and safety checks'],
    concepts: [
      ['Project definition', 'Φ Node-01 is a proposed USB-powered ESP32-S3 learning module with a button, indicator, and optional display/sensor.'],
      ['Block diagram', 'Separate power input, microcontroller, input devices, and outputs. Draw each connection and note operating voltages.'],
      ['Review gates', 'Before manufacturing, verify pin capabilities, power budget, component ratings, wiring, and PCB checks.'],
      ['Honest boundaries', 'The three in-browser benches teach focused math and logic; complex behavior should be validated with specialized simulators and actual testing.']
    ],
    challenge: 'Produce a one-page Node-01 brief: supply, microcontroller, input, output, communication path, parts list, and top five design risks.',
    quiz: [
      ['What should happen before ordering a custom PCB?', ['Electrical and design reviews', 'Skip checks', 'Assume all pins are 5 V tolerant'], 0],
      ['What is the sensible first power source for a beginner project?', ['A known low-voltage USB development setup', 'Unprotected mains wiring', 'Unknown salvaged battery pack'], 0]
    ]
  }
];

const STORAGE_KEY = 'phi-circuit-lab-progress-v1';
let completed = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (Array.isArray(saved)) completed = new Set(saved.filter(n => Number.isInteger(n) && n >= 0 && n < lessons.length));
} catch (_) { /* Storage can be unavailable in locked-down browsers. */ }
const state = { view: 'home', lesson: 0, lab: 'led' };
const root = document.getElementById('app-content');

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed])); }
  catch (_) { /* In-memory progress still works for this visit. */ }
}
function showLesson(index) {
  state.view = 'classroom';
  state.lesson = index;
  render();
  document.getElementById('main').focus({ preventScroll: true });
}
function progressUI() {
  document.getElementById('progress-count').textContent = completed.size + ' / ' + lessons.length;
  document.getElementById('progress-fill').style.width = (100 * completed.size / lessons.length) + '%';
  const list = document.getElementById('lesson-list');
  list.innerHTML = lessons.map((lesson, i) => '<button type="button" class="lesson-button ' +
    (state.view === 'classroom' && state.lesson === i ? 'selected ' : '') +
    (completed.has(i) ? 'completed' : '') +
    '" data-lesson="' + i + '" aria-label="Open module ' + (i+1) + ': ' + lesson.title + '">' +
    '<span class="lesson-number">' + (completed.has(i) ? '✓' : i+1) + '</span><span>' + lesson.title + '</span></button>').join('');
  document.querySelectorAll('[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === state.view);
    if (el.dataset.view === state.view) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}
function renderHome() {
  const next = lessons.findIndex((_, i) => !completed.has(i));
  const chosen = next < 0 ? 0 : next;
  root.innerHTML =
    '<section class="hero"><span class="pill">FREE • NO HARDWARE REQUIRED</span>' +
    '<h1>Build the knowledge.<br>Before you build the board.</h1>' +
    '<p>Your virtual electronics academy. Start with volts and ohms, experiment in interactive benches, master digital logic, and design your first PCB.</p>' +
    '<div class="hero-actions"><button class="button primary" data-lesson="' + chosen + '">' +
    (completed.size ? 'Continue learning' : 'Begin Lesson 01') +
    '</button><button class="button" data-view="workbench">Open the Workbench</button></div></section>' +
    '<div class="section-heading"><h2>Learning modules</h2><span class="muted">' + completed.size + ' of 9 complete</span></div>' +
    '<div class="grid">' + lessons.map((l,i) => '<button type="button" class="card clickable" data-lesson="' + i + '" style="text-align:left;color:inherit">' +
    '<span class="chip">MODULE ' + String(i+1).padStart(2,'0') + (completed.has(i) ? ' • COMPLETE' : '') +
    '</span><h3>' + l.title + '</h3><p>' + l.subtitle + '</p><span class="micro">' + l.time + ' • ' +
    (l.lab ? 'Interactive bench' : 'Guided exercise') + '</span></button>').join('') + '</div>';
}
function renderLesson() {
  const l = lessons[state.lesson];
  root.innerHTML = '<div class="lesson-header"><span class="eyebrow">MODULE ' + String(state.lesson+1).padStart(2,'0') + ' OF 09 • ' + l.time + '</span>' +
    '<h1>' + l.title + '</h1><p>' + l.intro + '</p>' +
    (completed.has(state.lesson) ? '<span class="pill">✓ COMPLETED</span>' : '') + '</div>' +
    '<div class="content-grid"><section class="panel"><h2>Core concepts</h2>' +
    l.concepts.map(c => '<h3>' + c[0] + '</h3><p>' + c[1] + '</p>').join('') +
    '</section><aside class="panel"><h2>Your objectives</h2><ul>' + l.objectives.map(x=>'<li>'+x+'</li>').join('') +
    '</ul><h3>Lab assignment</h3><div class="callout"><p>' + l.challenge + '</p></div>' +
    '<div class="actions">' + (l.lab ?
    '<button class="button primary" data-open-lab="' + l.lab + '">Launch ' + (l.lab==='ohms' ? 'Ohm’s Bench' : l.lab==='led' ? 'LED Bench' : l.lab==='network' ? 'Network Bench' : l.lab==='rc' ? 'RC Timing Bench' : 'Logic Bench') + '</button>' :
    '<button class="button primary" data-view="workbench">Explore lab resources</button>') + '</div></aside></div>' +
    '<section class="panel" style="margin-top:1rem"><span class="eyebrow">KNOWLEDGE CHECK</span><h2>Quiz</h2>' +
    '<p>Answer every question correctly to mark this module complete. You can retry as often as you want.</p>' +
    '<form id="lesson-quiz">' + l.quiz.map((q,i) => '<fieldset class="question" style="border:0;padding-left:0"><legend><strong>' + (i+1) + '. ' + q[0] + '</strong></legend>' +
      q[1].map((answer,j) => '<label class="option"><input type="radio" name="q' + i + '" value="' + j + '" required> ' + answer + '</label>').join('') + '</fieldset>').join('') +
    '<button type="submit" class="button primary">Check answers</button><p id="quiz-feedback" class="feedback" role="status"></p></form></section>' +
    '<div class="actions">' +
    (state.lesson > 0 ? '<button class="button" data-lesson="' + (state.lesson-1) + '">Previous lesson</button>' : '') +
    (state.lesson < lessons.length - 1 ? '<button class="button" data-lesson="' + (state.lesson+1) + '">Next lesson</button>' : '') +
    '</div>';
}
function renderTextbook() {
  root.innerHTML = '<span class="eyebrow">THE OPEN TEXTBOOK</span><h1>Electronics for the Curious</h1>' +
    '<p>A nine-chapter companion to the interactive classroom. Every chapter includes a hands-on exercise and an answer key. No purchases required.</p>' +
    '<section class="panel"><h2>Table of contents</h2><ol class="chapter-list">' +
    lessons.map((l,i) => '<li><button class="button" data-lesson="' + i + '">Chapter ' + (i+1) + ': ' + l.title + '</button> <span class="micro">' + l.subtitle + '</span></li>').join('') +
    '</ol><div class="actions"><a class="button primary" href="https://github.com/MichaelWave369/PhiCircuitLab/blob/main/docs/LESSONBOOK.md" target="_blank" rel="noopener noreferrer">Open full lesson book</a>' +
    '<a class="button" href="https://github.com/MichaelWave369/PhiCircuitLab/blob/main/docs/SAFETY.md" target="_blank" rel="noopener noreferrer">Read safety guide</a></div></section>' +
    '<div class="section-heading"><h2>Engineering references</h2></div><div class="grid">' +
    '<div class="card"><span class="chip">CIRCUIT EXPLORATION</span><h3>CircuitJS / Falstad</h3><p>General-purpose circuit experimentation beyond our guided benches.</p><a href="https://falstad.com/circuit/" target="_blank" rel="noopener noreferrer">Open simulator</a></div>' +
    '<div class="card"><span class="chip">MICROCONTROLLERS</span><h3>Wokwi</h3><p>Virtual ESP32 and Arduino-style firmware experiments; third-party service with its own terms.</p><a href="https://wokwi.com/" target="_blank" rel="noopener noreferrer">Open Wokwi</a></div>' +
    '<div class="card"><span class="chip">PCB ENGINEERING</span><h3>KiCad</h3><p>Free and open-source software for schematics, layout and fabrication output.</p><a href="https://www.kicad.org/" target="_blank" rel="noopener noreferrer">Explore KiCad</a></div></div>';
}
function renderProgress() {
  root.innerHTML = '<span class="eyebrow">YOUR LOCAL LEARNING RECORD</span><h1>Progress</h1>' +
    '<p>Completion is saved in this browser using localStorage. There is no account, server database, or tracking.</p>' +
    '<div class="grid"><div class="card"><span class="eyebrow">MODULES COMPLETED</span><div class="stat">' + completed.size + ' / 9</div></div>' +
    '<div class="card"><span class="eyebrow">COURSE PROGRESS</span><div class="stat">' + Math.round(completed.size/lessons.length*100) + '%</div></div>' +
    '<div class="card"><span class="eyebrow">YOUR NEXT STEP</span><p>' +
    (completed.size===lessons.length ? 'You finished all nine modules. Review or design your Node-01 capstone.' : 'Complete a module quiz to mark it finished.') +
    '</p></div></div><section class="panel" style="margin-top:1rem"><h2>Module checklist</h2><ul>' +
    lessons.map((l,i)=>'<li>' + (completed.has(i)?'✓ Complete: ':'○ To learn: ') + l.title + '</li>').join('') +
    '</ul><button class="button" id="reset-progress">Reset local progress</button></section>';
}
function renderWorkbench() {
  const items = [['ohms','Ohm’s Law'],['led','LED + Resistor'],['network','Series & Parallel'],['divider','Voltage Divider'],['rc','RC Timing'],['logic','Logic Gates']];
  root.innerHTML = '<span class="eyebrow">VIRTUAL LABORATORY</span><h1>The Workbench</h1>' +
    '<p>Change inputs and see calculated circuit behavior instantly. These are intentionally simple educational models, not full physics or hardware emulation.</p>' +
    '<div class="lab-tabs" role="group" aria-label="Choose experiment">' +
    items.map(([id,title]) => '<button class="lab-tab ' + (state.lab===id?'active':'') + '" data-lab="' + id + '">' + title + '</button>').join('') + '</div>' +
    (isAdvancedLab(state.lab) ? advancedBenchMarkup(state.lab) : state.lab==='ohms' ? ohmsWorkbench() : state.lab==='led' ? ledWorkbench() : logicWorkbench()) +
    '<div class="panel" style="margin-top:1rem"><h3>Continue in engineering tools</h3><p>Explore more complex circuits in <a href="https://falstad.com/circuit/" target="_blank" rel="noopener noreferrer">CircuitJS</a>, embedded firmware in <a href="https://wokwi.com/" target="_blank" rel="noopener noreferrer">Wokwi</a>, or PCB layouts in <a href="https://www.kicad.org/" target="_blank" rel="noopener noreferrer">KiCad</a>.</p>' +
    '<div class="callout warning"><strong>Simulation limits:</strong> ideal resistor behavior, fixed LED forward-voltage assumptions, and Boolean logic. Do not treat these readings as component specifications or electrical safety certification.</div></div>';
  updateBench();
}
function ohmsWorkbench() {
  return '<div class="workbench-grid"><section class="panel"><h2>Ohm’s Law Bench</h2><p>Change voltage or resistance to see the expected current and resistor power.</p>' +
    '<div class="diagram"><svg viewBox="0 0 500 230" role="img" aria-label="Simple circuit showing a DC voltage source and resistor connected in a loop">' +
    '<g stroke="#55e2df" stroke-width="5" fill="none" stroke-linecap="round"><path d="M110 50 H350 V75 M350 145 V188 H110 V150 M110 90 V50" /></g>' +
    '<g stroke="#edf4ff" stroke-width="3"><line x1="89" y1="92" x2="131" y2="92"/><line x1="98" y1="112" x2="122" y2="112"/></g>' +
    '<path d="M350 75 L350 87 L332 93 L368 103 L332 113 L368 123 L332 133 L350 139 L350 145" stroke="#ffc578" stroke-width="4" fill="none"/>' +
    '<g fill="#edf4ff" font-size="17" font-family="sans-serif"><text x="43" y="105" id="ohms-supply-svg">5 V</text><text x="376" y="116" id="ohms-resistor-svg">1 kΩ</text><text x="206" y="215">DC loop</text></g></svg></div></section>' +
    '<section class="panel"><h2>Controls</h2><div class="controls">' +
    '<label><span class="control-label">Supply voltage <output id="ohms-voltage-value">5 V</output></span><input type="range" id="ohms-voltage" data-field min="0" max="12" step="0.5" value="5"></label>' +
    '<label><span class="control-label">Resistance <output id="ohms-resistance-value">1000 Ω</output></span><input type="range" id="ohms-resistance" data-field min="100" max="2200" step="100" value="1000"></label>' +
    '</div><div class="result-grid"><div class="result"><small>Current</small><strong id="ohms-current"></strong></div>' +
    '<div class="result"><small>Resistor power</small><strong id="ohms-power"></strong></div></div>' +
    '<p class="micro">Equations: I = V / R and P = V × I.</p></section></div>';
}
function ledWorkbench() {
  return '<div class="workbench-grid"><section class="panel"><h2>LED + Current-Limiting Resistor</h2><p>Model a simple LED indicator. Raise voltage or lower resistance to see why component ratings matter.</p>' +
    '<div class="diagram"><svg viewBox="0 0 520 260" role="img" aria-label="Simplified series LED circuit: battery, resistor, and LED">' +
    '<g stroke="#55e2df" stroke-width="5" fill="none" stroke-linecap="round"><path d="M105 52 H250 M340 52 H410 V103 M410 154 V211 H105 V151 M105 95 V52" /></g>' +
    '<g stroke="#edf4ff" stroke-width="3"><line x1="84" y1="97" x2="126" y2="97"/><line x1="94" y1="117" x2="116" y2="117"/></g>' +
    '<rect x="250" y="35" width="90" height="35" rx="7" stroke="#ffc578" stroke-width="3" fill="#3e3529"/>' +
    '<circle id="led-lamp" class="lamp" cx="410" cy="130" r="25" stroke="#edf4ff" stroke-width="3" fill="#fa6464"/>' +
    '<g stroke="#edf4ff" stroke-width="2"><path d="M432 109 L456 86 M448 86 H456 V94 M437 117 L468 107 M460 103 L468 107 L464 115"/></g>' +
    '<g fill="#edf4ff" font-size="17" font-family="sans-serif"><text x="34" y="112" id="led-supply-svg">5 V</text><text x="269" y="25" id="led-resistor-svg">330 Ω</text><text x="365" y="191">LED</text><text x="190" y="245">Simplified LED model</text></g></svg></div></section>' +
    '<section class="panel"><h2>Controls</h2><div class="controls">' +
    '<label><span class="control-label">Supply voltage <output id="led-voltage-value">5 V</output></span><input type="range" id="led-voltage" data-field min="0" max="12" step="0.5" value="5"></label>' +
    '<label><span class="control-label">Resistor <output id="led-resistance-value">330 Ω</output></span><input type="range" id="led-resistance" data-field min="100" max="2200" step="10" value="330"></label>' +
    '<label><span class="control-label">LED type</span><select id="led-color" data-field><option value="red">Red (~2.0 V)</option><option value="green">Green (~2.2 V)</option><option value="blue">Blue (~3.2 V)</option></select></label></div>' +
    '<div class="result-grid"><div class="result"><small>LED current</small><strong id="led-current"></strong></div>' +
    '<div class="result"><small>Resistor power</small><strong id="led-power"></strong></div></div>' +
    '<p id="led-status" class="feedback" role="status"></p><p class="micro">Assumes constant LED forward voltage and a typical 20 mA warning threshold. Consult specific component datasheets for real designs.</p></section></div>';
}
function logicWorkbench() {
  return '<div class="workbench-grid"><section class="panel"><h2>Logic Gate Bench</h2><p>Experiment with binary inputs. The truth table highlights your current input pair.</p>' +
    '<div class="logic-panel"><span class="bit" id="logic-a-bit">0</span><span class="gate" id="logic-gate-glyph">AND</span><span class="bit" id="logic-output">0</span></div>' +
    '<table class="truth-table"><thead><tr><th>Input A</th><th>Input B</th><th>Output</th></tr></thead><tbody id="logic-truth"></tbody></table></section>' +
    '<section class="panel"><h2>Controls</h2><div class="controls">' +
    '<label>Gate<select id="logic-type" data-field style="display:block;width:100%;padding:.7rem;margin-top:.4rem;background:#17243a;color:#edf4ff;border:1px solid #263651;border-radius:9px">' +
    ['AND','OR','XOR','NAND','NOR','XNOR'].map(g=>'<option value="'+g+'">'+g+'</option>').join('') + '</select></label>' +
    '<label class="option"><input type="checkbox" id="logic-a" data-field> Input A = 1</label>' +
    '<label class="option"><input type="checkbox" id="logic-b" data-field> Input B = 1</label>' +
    '</div><div class="callout"><strong>Try XOR:</strong> its output is 1 when the two inputs differ.</div></section></div>';
}
function updateBench() {
  if (state.view !== 'workbench') return;
  if (isAdvancedLab(state.lab)) { updateAdvancedBench(state.lab); return; }
  if (state.lab === 'ohms') {
    const v = Number(document.getElementById('ohms-voltage').value);
    const r = Number(document.getElementById('ohms-resistance').value);
    const s = simulateOhms(v,r);
    document.getElementById('ohms-voltage-value').textContent = v + ' V';
    document.getElementById('ohms-resistance-value').textContent = r + ' Ω';
    document.getElementById('ohms-supply-svg').textContent = v + ' V';
    document.getElementById('ohms-resistor-svg').textContent = r + ' Ω';
    document.getElementById('ohms-current').textContent = s.currentMa.toFixed(2) + ' mA';
    document.getElementById('ohms-power').textContent = s.powerW.toFixed(3) + ' W';
  } else if (state.lab === 'led') {
    const v = Number(document.getElementById('led-voltage').value);
    const r = Number(document.getElementById('led-resistance').value);
    const color = document.getElementById('led-color').value;
    const data = {red:[2.0,'#ff6363'],green:[2.2,'#80ebad'],blue:[3.2,'#77aaff']};
    const [vf, fill] = data[color];
    const s = simulateLed(v,r,vf);
    document.getElementById('led-voltage-value').textContent = v + ' V';
    document.getElementById('led-resistance-value').textContent = r + ' Ω';
    document.getElementById('led-supply-svg').textContent = v + ' V';
    document.getElementById('led-resistor-svg').textContent = r + ' Ω';
    document.getElementById('led-current').textContent = s.currentMa.toFixed(2) + ' mA';
    document.getElementById('led-power').textContent = s.resistorW.toFixed(3) + ' W';
    const lamp = document.getElementById('led-lamp');
    lamp.style.fill = fill;
    lamp.style.color = fill;
    lamp.style.opacity = s.currentMa < 1 ? '.18' : String(Math.min(1, .3 + s.currentMa / 18));
    lamp.classList.toggle('on', s.currentMa >= 1);
    const status = document.getElementById('led-status');
    const overCurrent = s.currentMa > 20, overPower = s.resistorW > .25;
    status.classList.toggle('error', overCurrent || overPower);
    status.textContent = overCurrent ? 'Caution: modeled LED current exceeds 20 mA.' :
      overPower ? 'Caution: resistor power exceeds 0.25 W.' :
      s.currentMa < 1 ? 'LED off or very dim in this simplified model.' :
      'Within the model’s example current and resistor limits.';
  } else {
    const gate = document.getElementById('logic-type').value;
    const a = document.getElementById('logic-a').checked ? 1 : 0;
    const b = document.getElementById('logic-b').checked ? 1 : 0;
    const output = logicGate(gate,a,b);
    document.getElementById('logic-a-bit').textContent = a + ' , ' + b;
    document.getElementById('logic-gate-glyph').textContent = gate;
    document.getElementById('logic-output').textContent = String(output);
    document.getElementById('logic-truth').innerHTML = [[0,0],[0,1],[1,0],[1,1]].map(([x,y]) =>
      '<tr class="' + (x===a && y===b ? 'current' : '') + '"><td>' + x + '</td><td>' + y +
      '</td><td>' + logicGate(gate,x,y) + '</td></tr>').join('');
  }
}
function render() {
  progressUI();
  if (state.view === 'home') renderHome();
  else if (state.view === 'classroom') renderLesson();
  else if (state.view === 'workbench') renderWorkbench();
  else if (state.view === 'textbook') renderTextbook();
  else if (state.view === 'progress') renderProgress();
}
document.addEventListener('click', event => {
  const lesson = event.target.closest('[data-lesson]');
  if (lesson) { showLesson(Number(lesson.dataset.lesson)); return; }
  const view = event.target.closest('[data-view]');
  if (view) { state.view = view.dataset.view; render(); return; }
  const lab = event.target.closest('[data-lab]');
  if (lab) { state.lab = lab.dataset.lab; state.view = 'workbench'; render(); return; }
  const openLab = event.target.closest('[data-open-lab]');
  if (openLab) { state.lab = openLab.dataset.openLab; state.view = 'workbench'; render(); return; }
  if (event.target.closest('#reset-progress')) {
    if (window.confirm('Reset all locally saved lesson completions?')) { completed.clear(); save(); render(); }
  }
});
document.addEventListener('input', event => {
  if (event.target.matches('[data-field]')) updateBench();
});
document.addEventListener('change', event => {
  if (event.target.matches('[data-field]')) updateBench();
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'lesson-quiz') return;
  event.preventDefault();
  const quiz = lessons[state.lesson].quiz;
  const data = new FormData(event.target);
  const right = quiz.reduce((count,q,i) => count + (Number(data.get('q'+i)) === q[2] && data.has('q'+i) ? 1 : 0),0);
  const feedback = document.getElementById('quiz-feedback');
  if (right === quiz.length) {
    completed.add(state.lesson);
    save(); progressUI();
    feedback.classList.remove('error');
    feedback.textContent = 'Perfect: ' + right + '/' + quiz.length + '. Module complete! ✓';
    const next = state.lesson + 1;
    if (next < lessons.length) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'button';
      nextBtn.type = 'button';
      nextBtn.dataset.lesson = String(next);
      nextBtn.textContent = 'Continue to module ' + (next+1);
      feedback.after(nextBtn);
    }
  } else {
    feedback.classList.add('error');
    feedback.textContent = right + '/' + quiz.length + ' correct. Review your answers and try again.';
  }
});
// Start in the first incomplete module, with navigation to every other module.
state.lesson = Math.max(0, lessons.findIndex((_,i) => !completed.has(i)));
render();
