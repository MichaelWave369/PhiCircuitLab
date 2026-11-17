// Educational solar + storage digital twin. All energies in Wh; powers in W.
// This is not a validated reactor, biological converter, or hardware control design.
export const MODES = Object.freeze({
  eco: Object.freeze({ efficiency: 0.962, outputW: 185, idleW: 2, coolingWPerC: 1.25 }),
  balanced: Object.freeze({ efficiency: 0.943, outputW: 315, idleW: 4, coolingWPerC: 1.65 }),
  boost: Object.freeze({ efficiency: 0.908, outputW: 550, idleW: 9, coolingWPerC: 0.90 }),
  protect: Object.freeze({ efficiency: 0.925, outputW: 165, idleW: 5, coolingWPerC: 4.0 })
});
export const SCENARIOS = Object.freeze(['normal', 'heatwave', 'storm', 'surge']);
export const STEP_HOURS = 1 / 12;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const finite = (n, fallback, min, max) => Number.isFinite(Number(n)) ? clamp(Number(n), min, max) : fallback;
export function normalizeConfig(input = {}) {
  return {
    pvW: finite(input.pvW, 500, 100, 1500),
    batteryWh: finite(input.batteryWh, 950, 100, 3000),
    loadW: finite(input.loadW, 170, 50, 600),
    stress: finite(input.stress, 0.25, 0, 1),
    seed: Math.round(finite(input.seed, 369, 1, 1000000)),
    scenario: SCENARIOS.includes(input.scenario) ? input.scenario : 'normal'
  };
}
export function environmentAt(hour, config, day = 0) {
  const cfg = normalizeConfig(config);
  const sun = Math.max(0, Math.sin(Math.PI * (hour - 6) / 12));
  const sky = 0.83 + 0.1 * Math.sin(hour * 2.1 + cfg.seed * 0.19 + day * 1.7)
    + 0.06 * Math.sin(hour * 6.3 + cfg.seed * 0.03 + day * 3);
  const storm = cfg.scenario === 'storm';
  const hot = cfg.scenario === 'heatwave';
  const surge = cfg.scenario === 'surge';
  const irradiance = 1000 * sun * clamp(sky * (storm ? 0.38 : 1), 0.05, 1);
  const ambientC = 22 + 8 * sun + (hot ? 16 : 0) - (storm ? 4 : 0)
    + 1.5 * Math.sin(hour * 0.7 + day);
  const pulse = surge && hour >= 16 && hour < 21 ? 2.65 : 1;
  const loadW = cfg.loadW * (0.83 + 0.25 * (0.5 + 0.5 * Math.sin(hour * 0.9 + day * 0.8))) * pulse;
  const stress = clamp(cfg.stress + (storm ? 0.25 : 0) + (hot ? 0.16 : 0), 0, 1);
  const cellC = ambientC + irradiance * 0.024;
  // PVWatts-style first-order DC module power correction at 25 C / 1000 W/m².
  const pvW = Math.max(0, cfg.pvW * irradiance / 1000 * (1 - 0.004 * (cellC - 25)) * 0.96);
  return { hour, irradiance, ambientC, cellC, loadW, stress, pvW };
}
export function initialPlant(config) {
  const cfg = normalizeConfig(config);
  return { batteryWh: cfg.batteryWh * 0.55, coreC: 27 };
}
export function stepPlant(plant, modeName, env, config, dtHours = STEP_HOURS) {
  const cfg = normalizeConfig(config);
  const mode = MODES[modeName];
  if (!mode) throw new RangeError('Unknown converter mode');
  if (!(dtHours > 0 && Number.isFinite(dtHours))) throw new RangeError('Invalid timestep');
  const startBatteryWh = clamp(plant.batteryWh, 0, cfg.batteryWh);
  const startCoreC = finite(plant.coreC, env.ambientC, -40, 160);
  const pvW = Math.max(0, finite(env.pvW, 0, 0, cfg.pvW * 1.5));
  const loadW = Math.max(0, finite(env.loadW, 0, 0, cfg.loadW * 4));
  const ambientC = finite(env.ambientC, 25, -40, 90);
  const stress = finite(env.stress, cfg.stress, 0, 1);
  const eta = clamp(mode.efficiency - 0.045 * stress - 0.002 * Math.max(0, startCoreC - 42), 0.70, 0.98);
  const chargeEfficiency = 0.95;
  const dischargeEfficiency = 0.95;
  const batteryLimitW = Math.max(140, cfg.batteryWh * 0.42);
  const dischargeAvailableW = Math.min(batteryLimitW, startBatteryWh * dischargeEfficiency / dtHours);
  const availableW = pvW + dischargeAvailableW;
  const idleW = Math.min(mode.idleW, availableW);
  const outputW = Math.min(loadW, mode.outputW, Math.max(0, availableW - idleW) * eta);
  const dcForServiceW = idleW + outputW / eta;
  const pvToServiceW = Math.min(pvW, dcForServiceW);
  const dischargeW = Math.max(0, dcForServiceW - pvToServiceW);
  const solarSurplusW = pvW - pvToServiceW;
  const chargeW = Math.min(solarSurplusW, batteryLimitW,
    Math.max(0, (cfg.batteryWh - startBatteryWh) / (chargeEfficiency * dtHours)));
  const curtailW = Math.max(0, solarSurplusW - chargeW);
  const batteryWh = clamp(startBatteryWh + (chargeW * chargeEfficiency - dischargeW / dischargeEfficiency) * dtHours, 0, cfg.batteryWh);
  const lossW = (dcForServiceW - outputW) + dischargeW * (1 / dischargeEfficiency - 1)
    + chargeW * (1 - chargeEfficiency);
  const temperatureDelta = (lossW - (startCoreC - ambientC) * mode.coolingWPerC)
    * dtHours * 3600 / 30000;
  const coreC = clamp(startCoreC + temperatureDelta, -40, 160);
  const balanceResidualWh = (pvW - outputW - curtailW - lossW) * dtHours
    - (batteryWh - startBatteryWh);
  return {
    plant: { batteryWh, coreC },
    mode: modeName, eta, pvW, loadW, outputW,
    unservedW: Math.max(0, loadW - outputW),
    chargeW, dischargeW, curtailW, lossW, balanceResidualWh,
    thermalAlarm: coreC > 55
  };
}
export function ruleMode(plant, env, cfg) {
  if (plant.coreC > 53 || (env.ambientC > 43 && plant.coreC > 49)) return 'protect';
  if (env.loadW > 285 && plant.batteryWh > cfg.batteryWh * 0.12) return 'boost';
  if (env.loadW > 178) return 'balanced';
  return 'eco';
}
export function contextKey(plant, env, cfg) {
  return (env.loadW > 285 ? 'high' : env.loadW > 175 ? 'mid' : 'low') + '/' +
    (plant.coreC > 49 || env.ambientC > 44 ? 'hot' : 'mild') + '/' +
    (plant.batteryWh < cfg.batteryWh * 0.22 ? 'low' : 'ready');
}
const ACTIONS = Object.keys(MODES);
const hash01 = (n) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
function bestAction(scores, key) {
  const choices = scores[key];
  if (!choices) return 'balanced';
  return ACTIONS.reduce((best, next) => choices[next] > choices[best] ? next : best, ACTIONS[0]);
}
export function trainController(config, days = 8) {
  const cfg = normalizeConfig(config);
  const scores = Object.create(null);
  const count = Object.create(null);
  for (let day = 1; day <= Math.round(clamp(days, 1, 30)); day++) {
    let plant = initialPlant(cfg);
    for (let i = 0; i < 288; i++) {
      const env = environmentAt((i + 0.5) / 12, cfg, day);
      const key = contextKey(plant, env, cfg);
      if (!scores[key]) {
        scores[key] = Object.fromEntries(ACTIONS.map(a => [a, 0]));
        count[key] = Object.fromEntries(ACTIONS.map(a => [a, 0]));
      }
      const random = hash01(cfg.seed + day * 1009 + i * 41);
      const chosen = random < 0.18
        ? ACTIONS[Math.floor(hash01(cfg.seed + day * 712 + i * 73) * ACTIONS.length)]
        : bestAction(scores, key);
      const step = stepPlant(plant, chosen, env, cfg);
      const reward = (step.outputW - 1.8 * step.unservedW - 0.35 * step.lossW
        - 0.18 * step.dischargeW - (step.thermalAlarm ? 65 : 0)) * STEP_HOURS;
      const n = ++count[key][chosen];
      scores[key][chosen] += (reward - scores[key][chosen]) / Math.min(n, 20);
      plant = step.plant;
    }
  }
  return scores;
}
export function simulate(config, strategy = 'fixed', learnedScores = {}) {
  const cfg = normalizeConfig(config);
  if (!['fixed', 'rules', 'learned'].includes(strategy)) throw new RangeError('Unknown controller');
  let plant = initialPlant(cfg);
  const trace = [];
  const totals = { pvWh: 0, requestedWh: 0, servedWh: 0, unservedWh: 0,
    lossesWh: 0, curtailedWh: 0, chargeWh: 0, dischargeWh: 0, residualWh: 0, alarms: 0 };
  for (let i = 0; i < 288; i++) {
    // Held-out evaluation day is distinct from every training day.
    const env = environmentAt((i + 0.5) / 12, cfg, 97);
    const mode = strategy === 'fixed' ? 'balanced' :
      strategy === 'rules' ? ruleMode(plant, env, cfg) :
        bestAction(learnedScores, contextKey(plant, env, cfg));
    const step = stepPlant(plant, mode, env, cfg);
    totals.pvWh += step.pvW * STEP_HOURS;
    totals.requestedWh += step.loadW * STEP_HOURS;
    totals.servedWh += step.outputW * STEP_HOURS;
    totals.unservedWh += step.unservedW * STEP_HOURS;
    totals.lossesWh += step.lossW * STEP_HOURS;
    totals.curtailedWh += step.curtailW * STEP_HOURS;
    totals.chargeWh += step.chargeW * STEP_HOURS;
    totals.dischargeWh += step.dischargeW * STEP_HOURS;
    totals.residualWh += step.balanceResidualWh;
    if (step.thermalAlarm) totals.alarms++;
    plant = step.plant;
    trace.push({ hour: env.hour, irradiance: env.irradiance, pvW: step.pvW,
      demandW: env.loadW, outputW: step.outputW, soc: 100 * plant.batteryWh / cfg.batteryWh,
      coreC: plant.coreC, mode });
  }
  totals.batteryStartWh = cfg.batteryWh * 0.55;
  totals.batteryEndWh = plant.batteryWh;
  totals.reliability = totals.requestedWh ? totals.servedWh / totals.requestedWh : 1;
  return { strategy, totals, trace, finalPlant: plant };
}
export function runExperiment(input = {}) {
  const config = normalizeConfig(input);
  const policy = trainController(config);
  return { config, trainingDays: 8, evaluationDay: 97,
    runs: {
      fixed: simulate(config, 'fixed'),
      rules: simulate(config, 'rules'),
      learned: simulate(config, 'learned', policy)
    }, policy };
}
