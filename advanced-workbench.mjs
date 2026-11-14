import { resistorNetwork, voltageDivider, rcTransient } from './advanced-circuits.mjs';

export const advancedLabNames = {
  network: 'Series & Parallel',
  divider: 'Voltage Divider',
  rc: 'RC Timing'
};
export function isAdvancedLab(name) {
  return Object.hasOwn(advancedLabNames, name);
}
function slider(id, label, min, max, step, value, unit = '') {
  return '<label><span class="control-label">' + label + ' <output id="' + id + '-value"></output></span>' +
    '<input type="range" id="' + id + '" data-field min="' + min + '" max="' + max +
    '" step="' + step + '" value="' + value + '" aria-label="' + label + ' (' + unit + ')"></label>';
}
function select(id, label, choices) {
  return '<label><span class="control-label">' + label + '</span><select id="' + id +
    '" data-field class="lab-select" aria-label="' + label + '">' +
    choices.map(([v,t]) => '<option value="' + v + '">' + t + '</option>').join('') +
    '</select></label>';
}
function metric(id, label) {
  return '<div class="result"><small>' + label + '</small><strong id="' + id + '">—</strong></div>';
}
function panel(title, description, diagram, controls, metrics, notes) {
  return '<div class="workbench-grid">' +
    '<section class="panel"><h2>' + title + '</h2><p>' + description + '</p><div class="diagram">' +
    diagram + '</div><p class="micro">' + notes + '</p></section>' +
    '<section class="panel"><h2>Experiment controls</h2><div class="controls">' + controls +
    '</div><div class="result-grid">' + metrics + '</div>' +
    '<p id="advanced-warning" class="feedback" role="status"></p></section></div>';
}
function networkBench() {
  const diagram = '<svg viewBox="0 0 490 260" role="img" aria-label="Two resistors in a series loop or two parallel branches">' +
    '<g id="network-series"><g fill="none" stroke="#55e2df" stroke-width="4" stroke-linecap="round">' +
    '<path d="M68 45 H155 M242 45 H275 M362 45 H425 V210 H68 V148 M68 93 V45"/></g>' +
    '<rect x="155" y="25" width="87" height="40" rx="6" stroke="#ffc578" stroke-width="3" fill="#3e3529"/>' +
    '<rect x="275" y="25" width="87" height="40" rx="6" stroke="#ffc578" stroke-width="3" fill="#3e3529"/>' +
    '<text x="170" y="50" fill="#edf4ff" font-size="17">R1</text><text x="290" y="50" fill="#edf4ff" font-size="17">R2</text>' +
    '<text x="185" y="138" fill="#55e2df" font-size="16">One current path</text></g>' +
    '<g id="network-parallel" class="hidden"><g fill="none" stroke="#55e2df" stroke-width="4" stroke-linecap="round">' +
    '<path d="M68 45 H150 V85 H205 M285 85 H425 V210 H68 V148 M68 93 V45 M150 85 V155 H205 M285 155 H425"/></g>' +
    '<rect x="205" y="65" width="80" height="40" rx="6" stroke="#ffc578" stroke-width="3" fill="#3e3529"/>' +
    '<rect x="205" y="135" width="80" height="40" rx="6" stroke="#ffc578" stroke-width="3" fill="#3e3529"/>' +
    '<text x="227" y="90" fill="#edf4ff" font-size="17">R1</text><text x="227" y="160" fill="#edf4ff" font-size="17">R2</text>' +
    '<text x="170" y="237" fill="#55e2df" font-size="15">Two branches share voltage</text></g>' +
    '<g fill="none" stroke="#edf4ff" stroke-width="3"><line x1="51" y1="94" x2="85" y2="94"/><line x1="57" y1="113" x2="79" y2="113"/></g>' +
    '<g fill="#edf4ff" font-size="15"><text x="8" y="108">DC</text></g>' +
    '</svg>';
  const controls = select('network-topology', 'Connection', [['series','Series'],['parallel','Parallel']]) +
    slider('network-supply','Supply voltage',0,12,.5,6,'V') +
    slider('network-r1','Resistor R1',100,2200,100,600,'Ω') +
    slider('network-r2','Resistor R2',100,2200,100,300,'Ω');
  const metrics = metric('network-equivalent', 'Equivalent R') +
    metric('network-total-current', 'Supply current') +
    metric('network-r1-voltage', 'R1 voltage') +
    metric('network-r2-voltage', 'R2 voltage') +
    metric('network-r1-current', 'R1 current') +
    metric('network-r2-current', 'R2 current');
  return panel('Series & Parallel', 'Same components, different paths. Watch equivalent resistance, current and voltage distribution change.', diagram,
    controls, metrics, 'Series: one current through both components. Parallel: the same supply voltage across both components.');
}
function dividerBench() {
  const diagram = '<svg viewBox="0 0 480 250" role="img" aria-label="Two-resistor voltage divider with the output across the bottom resistor; optional load in parallel with R2">' +
    '<g stroke="#55e2df" stroke-width="4" fill="none"><path d="M85 35 H220 V60 M220 107 V137 M220 188 V219 H85 V35 M220 137 H354"/></g>' +
    '<rect x="198" y="60" width="44" height="47" rx="5" fill="#403629" stroke="#ffc578" stroke-width="3"/>' +
    '<rect x="198" y="143" width="44" height="45" rx="5" fill="#403629" stroke="#ffc578" stroke-width="3"/>' +
    '<g font-size="17" fill="#edf4ff"><text x="252" y="89">R1</text><text x="252" y="173">R2</text><text x="358" y="142">Vout</text><text x="50" y="126">Vin</text>' +
    '<text x="118" y="242" font-size="14">GND (reference)</text></g>' +
    '<g id="divider-load-wire" class="hidden" stroke="#55e2df" fill="none" stroke-width="4"><path d="M354 137 H408 V152 M408 194 V219 H220"/></g>' +
    '<g id="divider-load-part" class="hidden"><rect x="389" y="152" width="38" height="42" rx="5" fill="#403629" stroke="#ffc578" stroke-width="3"/>' +
    '<text x="432" y="178" font-size="15" fill="#edf4ff">RL</text></g></svg>';
  const controls = slider('divider-supply','Input voltage',0,12,.5,9,'V') +
    slider('divider-top','Top resistor (R1)',100,10000,100,2000,'Ω') +
    slider('divider-bottom','Bottom resistor (R2)',100,10000,100,1000,'Ω') +
    '<label class="option"><input type="checkbox" id="divider-use-load" data-field> Connect a load across R2</label>' +
    '<div id="divider-load-control" class="hidden">' +
    slider('divider-load','Load resistor (RL)',100,10000,100,1000,'Ω') + '</div>';
  const metrics = metric('divider-output','Output voltage') +
    metric('divider-source','Source current') +
    metric('divider-bottom-current','R2 current') +
    metric('divider-load-current','Load current');
  return panel('Voltage Divider', 'Turn one voltage into a smaller output using two resistors, then attach a load and watch what changes.',diagram,
    controls,metrics,'Vout = Vin × Rbottom / (Rtop + Rbottom). When loaded, Rbottom means the parallel equivalent of R2 and RL.');
}
function rcBench() {
  const diagram = '<svg viewBox="0 0 480 260" role="img" aria-label="Graph of normalized capacitor voltage versus elapsed time in multiples of RC time constant">' +
    '<g stroke="#49637f" stroke-width="1" fill="none"><path d="M58 18 V211 H451 M58 115 H451 M136 18 V211 M215 18 V211 M294 18 V211 M373 18 V211"/></g>' +
    '<g font-size="14" fill="#b1c0d9"><text x="10" y="24">1.0</text><text x="10" y="120">0.5</text><text x="29" y="217">0</text>' +
    '<text x="425" y="229">5τ</text><text x="59" y="229">0</text><text x="214" y="248">time / τ</text></g>' +
    '<polyline id="rc-curve" fill="none" stroke="#55e2df" stroke-width="4" stroke-linejoin="round" points=""/>' +
    '<line id="rc-time-line" x1="58" x2="58" y1="18" y2="211" stroke="#ffc578" stroke-dasharray="5 4" stroke-width="2"/>' +
    '<circle id="rc-marker" cx="58" cy="211" r="7" fill="#ffc578" stroke="#111b2c" stroke-width="2"/></svg>';
  const controls = select('rc-mode','Experiment',[['charge','Charging'],['discharge','Discharging']]) +
    slider('rc-voltage','Source / initial voltage',0,12,.5,5,'V') +
    slider('rc-resistance','Resistance',100,10000,100,1000,'Ω') +
    slider('rc-capacitance','Capacitance',10,1000,10,100,'µF') +
    slider('rc-time','Elapsed time (time constants)',0,5,.1,1,'τ');
  const metrics = metric('rc-tau','Time constant τ') +
    metric('rc-elapsed','Elapsed time') +
    metric('rc-voltage-result','Capacitor voltage') +
    metric('rc-current','Current (signed)');
  return panel('RC Timing', 'An ideal capacitor charges or discharges exponentially through a resistor. Slide through time and see the curve.',diagram,
    controls,metrics,'τ = R × C. Charging starts at 0 V; discharging starts at the selected initial voltage. Negative current denotes discharge direction.');
}
export function advancedBenchMarkup(name) {
  switch (name) {
    case 'network': return networkBench();
    case 'divider': return dividerBench();
    case 'rc': return rcBench();
    default: throw new RangeError('Unknown advanced bench');
  }
}
function set(id, value) {
  document.getElementById(id).textContent = value;
}
function value(id) { return Number(document.getElementById(id).value); }
function formatV(v) { return v.toFixed(2) + ' V'; }
function formatCurrent(a) { return (a * 1000).toFixed(2) + ' mA'; }
function updateNetwork() {
  const topology = document.getElementById('network-topology').value;
  const supply = value('network-supply'), r1 = value('network-r1'), r2 = value('network-r2');
  const x = resistorNetwork(supply,r1,r2,topology);
  set('network-supply-value',supply + ' V');
  set('network-r1-value',r1 + ' Ω'); set('network-r2-value',r2 + ' Ω');
  document.getElementById('network-series').classList.toggle('hidden',topology !== 'series');
  document.getElementById('network-parallel').classList.toggle('hidden',topology !== 'parallel');
  set('network-equivalent',x.equivalentOhms.toFixed(1) + ' Ω');
  set('network-total-current',formatCurrent(x.totalCurrentA));
  set('network-r1-voltage',formatV(x.voltage1V)); set('network-r2-voltage',formatV(x.voltage2V));
  set('network-r1-current',formatCurrent(x.current1A)); set('network-r2-current',formatCurrent(x.current2A));
  const high = x.power1W > .25 || x.power2W > .25;
  const warning = document.getElementById('advanced-warning');
  warning.classList.toggle('error',high);
  warning.textContent = high ? 'Note: modeled power exceeds 0.25 W for at least one resistor. Review component ratings before any real build.' :
    (topology === 'series' ? 'One path means equal current; each resistor has its own voltage drop.' :
      'Two branches mean equal voltage; each branch draws its own current.');
}
function updateDivider() {
  const supply = value('divider-supply'), top = value('divider-top'), bottom = value('divider-bottom');
  const loaded = document.getElementById('divider-use-load').checked;
  const load = loaded ? value('divider-load') : null;
  const x = voltageDivider(supply,top,bottom,load);
  set('divider-supply-value',supply + ' V'); set('divider-top-value',top + ' Ω');
  set('divider-bottom-value',bottom + ' Ω'); set('divider-load-value',value('divider-load') + ' Ω');
  document.getElementById('divider-load-control').classList.toggle('hidden',!loaded);
  document.getElementById('divider-load-wire').classList.toggle('hidden',!loaded);
  document.getElementById('divider-load-part').classList.toggle('hidden',!loaded);
  set('divider-output',formatV(x.outputV)); set('divider-source',formatCurrent(x.currentSourceA));
  set('divider-bottom-current',formatCurrent(x.currentBottomA));
  set('divider-load-current',formatCurrent(x.currentLoadA));
  const high = Math.max(x.topPowerW,x.bottomPowerW,x.loadPowerW) > .25;
  const warning = document.getElementById('advanced-warning');
  warning.classList.toggle('error',high);
  warning.textContent = high ? 'Modeled power exceeds 0.25 W in a resistor. Real parts require ratings checks.' :
    loaded ? 'The load shares the output voltage and usually lowers Vout. Check it against the unloaded value.' :
      'Unloaded ideal divider. Connect a load to observe the loading effect.';
}
function updateRc() {
  const mode = document.getElementById('rc-mode').value;
  const supply = value('rc-voltage'), resistance = value('rc-resistance');
  const capacitance = value('rc-capacitance'), ratio = value('rc-time');
  const tau = resistance * capacitance * 1e-6;
  const x = rcTransient(supply,resistance,capacitance,ratio*tau,mode);
  set('rc-voltage-value',supply + ' V'); set('rc-resistance-value',resistance + ' Ω');
  set('rc-capacitance-value',capacitance + ' µF');
  set('rc-time-value',ratio.toFixed(1) + ' τ');
  set('rc-tau',x.tauSeconds.toFixed(4) + ' s');
  set('rc-elapsed',x.timeSeconds.toFixed(4) + ' s');
  set('rc-voltage-result',formatV(x.capacitorV)); set('rc-current',formatCurrent(x.currentA));
  // The graph shows Vcap/Vsource, a normalized ideal response. At 0 V, this
  // is still the theoretical shape, not a claim of physical voltage.
  const fractions = Array.from({length:101},(_,i) => {
    const t = i/20;
    const f = mode === 'charge' ? 1-Math.exp(-t) : Math.exp(-t);
    return [58+t/5*393,211-f*193];
  });
  document.getElementById('rc-curve').setAttribute('points',fractions.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' '));
  const normalized = mode === 'charge' ? 1-Math.exp(-ratio) : Math.exp(-ratio);
  document.getElementById('rc-marker').setAttribute('cx',String(58+ratio/5*393));
  document.getElementById('rc-marker').setAttribute('cy',String(211-normalized*193));
  document.getElementById('rc-time-line').setAttribute('x1',String(58+ratio/5*393));
  document.getElementById('rc-time-line').setAttribute('x2',String(58+ratio/5*393));
  const warning = document.getElementById('advanced-warning');
  warning.classList.remove('error');
  warning.textContent = mode === 'charge' ?
    'After 1τ, an ideal charging capacitor reaches about 63.2% of its final voltage.' :
    'After 1τ, an ideal discharging capacitor retains about 36.8% of its initial voltage.';
}
export function updateAdvancedBench(name) {
  switch (name) {
    case 'network': updateNetwork(); break;
    case 'divider': updateDivider(); break;
    case 'rc': updateRc(); break;
    default: throw new RangeError('Unknown advanced bench');
  }
}
