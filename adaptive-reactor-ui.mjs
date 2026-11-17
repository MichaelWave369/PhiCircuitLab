import { runExperiment, normalizeConfig } from './adaptive-reactor-engine.mjs';

const form = document.querySelector('#reactor-form');
const status = document.querySelector('#reactor-status');
const summary = document.querySelector('#reactor-summary');
const insight = document.querySelector('#reactor-insight');
const ledger = document.querySelector('#reactor-ledger');
let latest = null;
const series = [
  { key: 'fixed', label: 'Fixed balanced', color: '#94a3b8' },
  { key: 'rules', label: 'Rule-based', color: '#55e2df' },
  { key: 'learned', label: 'Learned', color: '#ffc578' }
];
const format = n => Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
const escapeText = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function getConfig() {
  const data = new FormData(form);
  return normalizeConfig({
    scenario: data.get('scenario'),
    pvW: data.get('pvW'),
    batteryWh: data.get('batteryWh'),
    loadW: data.get('loadW'),
    stress: Number(data.get('stress')) / 100,
    seed: data.get('seed')
  });
}
function syncOutputs() {
  const ids = [
    ['reactor-pv', 'reactor-pv-value', ' W'],
    ['reactor-battery', 'reactor-battery-value', ' Wh'],
    ['reactor-load', 'reactor-load-value', ' W'],
    ['reactor-stress', 'reactor-stress-value', '%']
  ];
  for (const [inputId, outputId, suffix] of ids) {
    document.getElementById(outputId).textContent = document.getElementById(inputId).value + suffix;
  }
}
function plot(svgId, tracks, lower, upper) {
  const svg = document.getElementById(svgId);
  const x0 = 54, y0 = 14, width = 759, height = 185;
  const span = Math.max(0.0001, upper - lower);
  const x = index => x0 + width * index / 287;
  const y = value => y0 + height * (1 - (Math.min(upper, Math.max(lower, value)) - lower) / span);
  let content = '';
  for (let n = 0; n <= 4; n++) {
    const yy = y0 + height * n / 4;
    const number = upper - span * n / 4;
    content += '<line x1="' + x0 + '" x2="' + (x0 + width) + '" y1="' + yy + '" y2="' + yy + '" class="reactor-gridline"/>';
    content += '<text x="' + (x0 - 8) + '" y="' + (yy + 4) + '" text-anchor="end" class="reactor-tick">' + format(number) + '</text>';
  }
  for (let hour = 0; hour <= 24; hour += 6) {
    const xx = x0 + width * hour / 24;
    content += '<text x="' + xx + '" y="219" text-anchor="middle" class="reactor-tick">' + String(hour).padStart(2, '0') + ':00</text>';
  }
  for (const track of tracks) {
    const points = track.values.map((value, i) => (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(value).toFixed(1)).join(' ');
    content += '<path d="' + points + '" fill="none" stroke="' + track.color + '" stroke-width="' + (track.dashed ? 1.8 : 2.5) + '" stroke-linecap="round" stroke-linejoin="round"' +
      (track.dashed ? ' stroke-dasharray="6 6"' : '') + '><title>' + escapeText(track.label) + '</title></path>';
  }
  svg.innerHTML = content;
}
function render() {
  const runs = latest.runs, config = latest.config;
  const entries = series.map(({ key, label, color }) => {
    const total = runs[key].totals;
    const servicePercent = total.reliability * 100;
    return '<article class="reactor-result" style="--controller-accent:' + color + '">' +
      '<small>' + label + '</small><strong>' + format(servicePercent) + '%</strong>' +
      '<span>Demand served</span><div class="reactor-result-bar"><b style="width:' + servicePercent.toFixed(2) + '%"></b></div>' +
      '<small>' + format(total.servedWh) + ' Wh delivered • ' + format(total.alarms * 5) + ' min thermal alarm</small></article>';
  }).join('');
  summary.innerHTML = entries;
  const base = runs.fixed.totals;
  const rules = runs.rules.totals;
  const learned = runs.learned.totals;
  const improvement = t => (100 * (t.servedWh - base.servedWh) / base.requestedWh);
  const signed = n => (n > 0 ? '+' : '') + format(n);
  insight.textContent = 'Against the fixed baseline: rule-based ' + signed(improvement(rules)) +
    ' percentage points; learned ' + signed(improvement(learned)) +
    ' points of requested energy delivered. Higher is better, but neither algorithm is guaranteed to win. Learned policy: eight synthetic training days, one separate evaluation day.';
  const tracks = prop => series.map(({ key, label, color }) => ({
    label, color, values: runs[key].trace.map(t => t[prop])
  }));
  plot('reactor-power-chart', tracks('outputW').concat([{
    label: 'Requested load', color: '#a28cff', dashed: true,
    values: runs.fixed.trace.map(t => t.demandW)
  }]), 0, Math.max(200, ...runs.fixed.trace.map(t => t.demandW)) * 1.08);
  plot('reactor-soc-chart', tracks('soc'), 0, 100);
  plot('reactor-heat-chart', tracks('coreC'), 0,
    Math.max(55, ...series.flatMap(s => runs[s.key].trace.map(t => t.coreC))) * 1.07);
  const rows = [
    ['PV generated', 'pvWh', 'Wh'], ['Load requested', 'requestedWh', 'Wh'],
    ['Load served', 'servedWh', 'Wh'], ['Unserved load', 'unservedWh', 'Wh'],
    ['Conversion + storage losses', 'lossesWh', 'Wh'],
    ['Curtailed solar energy', 'curtailedWh', 'Wh'],
    ['Battery at start', 'batteryStartWh', 'Wh'],
    ['Battery at finish', 'batteryEndWh', 'Wh'],
    ['Balance residual', 'residualWh', 'Wh']
  ];
  ledger.innerHTML = rows.map(([name, key, unit]) =>
    '<tr><th scope="row">' + name + '</th>' + series.map(s =>
      '<td>' + format(runs[s.key].totals[key]) + ' ' + unit + '</td>').join('') + '</tr>').join('');
  status.textContent = config.scenario.toUpperCase() + ' • SIMULATED';
}
function execute() {
  status.textContent = 'CALCULATING';
  latest = runExperiment(getConfig());
  render();
}
function exportFile(filename, mime, contents) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.getElementById('reactor-export-json').addEventListener('click', () => {
  if (!latest) return;
  exportFile('phi-adaptive-reactor-' + latest.config.scenario + '.json',
    'application/json', JSON.stringify({ format: 'phi-reactor-digital-twin-v1', ...latest }, null, 2));
});
document.getElementById('reactor-export-csv').addEventListener('click', () => {
  if (!latest) return;
  const headers = ['hour', 'pv_W', 'requested_W',
    ...series.flatMap(s => [s.key + '_output_W', s.key + '_soc_percent', s.key + '_core_C', s.key + '_mode'])];
  const rows = [headers.join(',')];
  for (let i = 0; i < 288; i++) {
    const base = latest.runs.fixed.trace[i];
    const fields = [base.hour.toFixed(3), base.pvW.toFixed(3), base.demandW.toFixed(3)];
    for (const item of series) {
      const trace = latest.runs[item.key].trace[i];
      fields.push(trace.outputW.toFixed(3), trace.soc.toFixed(3), trace.coreC.toFixed(3), trace.mode);
    }
    rows.push(fields.join(','));
  }
  exportFile('phi-adaptive-reactor-' + latest.config.scenario + '.csv',
    'text/csv;charset=utf-8', rows.join('\n') + '\n');
});
form.addEventListener('input', syncOutputs);
form.addEventListener('submit', event => { event.preventDefault(); execute(); });
syncOutputs();
execute();
