import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES, STEP_HOURS, normalizeConfig, environmentAt, initialPlant,
  stepPlant, ruleMode, trainController, simulate, runExperiment
} from '../adaptive-reactor-engine.mjs';

const config = normalizeConfig({ scenario: 'surge', pvW: 650, batteryWh: 1200, loadW: 205, stress: 0.42, seed: 369 });

test('normalization bounds external inputs and rejects invented modes', () => {
  const normalized = normalizeConfig({ pvW: -300, batteryWh: 100000, loadW: 'bad',
    stress: 200, scenario: 'fictional', seed: Infinity });
  assert.equal(normalized.pvW, 100);
  assert.equal(normalized.batteryWh, 3000);
  assert.equal(normalized.loadW, 170);
  assert.equal(normalized.stress, 1);
  assert.equal(normalized.scenario, 'normal');
  assert.equal(normalized.seed, 369);
  assert.throws(() => stepPlant(initialPlant(config), 'magic', environmentAt(12, config), config), RangeError);
});

test('nighttime solar power is zero and midday power is positive but bounded', () => {
  assert.equal(environmentAt(1, config).pvW, 0);
  const midday = environmentAt(12, config);
  assert(midday.pvW > 0);
  assert(midday.pvW < config.pvW);
});

test('each converter mode obeys energy conservation and finite battery boundaries', () => {
  for (const mode of Object.keys(MODES)) {
    const start = initialPlant(config);
    const env = environmentAt(14, config);
    const step = stepPlant(start, mode, env, config);
    assert(Math.abs(step.balanceResidualWh) < 1e-8, mode + ' energy residual ' + step.balanceResidualWh);
    assert(step.outputW <= step.loadW + 1e-9);
    assert(step.lossW >= 0);
    assert(step.curtailW >= 0);
    assert(step.plant.batteryWh <= config.batteryWh);
    assert(step.plant.batteryWh >= 0);
    assert(step.eta <= 1);
  }
});

test('empty battery and zero solar cannot serve load or generate energy', () => {
  const env = { ...environmentAt(2, config), pvW: 0, loadW: 300 };
  const step = stepPlant({ coreC: 25, batteryWh: 0 }, 'boost', env, config);
  assert.equal(step.outputW, 0);
  assert.equal(step.plant.batteryWh, 0);
  assert.equal(step.lossW, 0);
  assert.equal(step.curtailW, 0);
  assert.equal(step.balanceResidualWh, 0);
});

test('thermal conditions influence modeled converter efficiency', () => {
  const env = environmentAt(13, config);
  const cool = stepPlant({ batteryWh: 900, coreC: 30 }, 'balanced', env, config);
  const hot = stepPlant({ batteryWh: 900, coreC: 75 }, 'balanced', env, config);
  assert(hot.eta < cool.eta);
  assert.equal(ruleMode({ batteryWh: 900, coreC: 60 }, env, config), 'protect');
});

test('identical scenario and seed reproduce all three controller runs', () => {
  const first = runExperiment(config);
  const second = runExperiment(config);
  assert.deepEqual(first, second);
  assert.equal(first.trainingDays, 8);
  assert.equal(first.evaluationDay, 97);
  for (const run of Object.values(first.runs)) {
    assert.equal(run.trace.length, 288);
    assert(run.totals.servedWh >= 0);
    assert(run.totals.reliability >= 0 && run.totals.reliability <= 1);
    assert(run.totals.unservedWh >= 0);
    assert(Math.abs(run.totals.requestedWh - run.totals.servedWh - run.totals.unservedWh) < 1e-7);
    assert(Math.abs(run.totals.residualWh) < 1e-7);
    assert(Math.abs(run.totals.pvWh + run.totals.batteryStartWh - run.totals.servedWh
      - run.totals.curtailedWh - run.totals.lossesWh - run.totals.batteryEndWh) < 1e-7);
    assert(run.trace.every(t => t.soc >= 0 && t.soc <= 100));
    assert(run.trace.every(t => Number.isFinite(t.coreC) && Number.isFinite(t.outputW)));
  }
});

test('stress scenarios remain balanced for all strategies, including battery exhaustion', () => {
  const cases = [
    { scenario: 'normal', pvW: 100, batteryWh: 100, loadW: 600, stress: 1, seed: 72 },
    { scenario: 'storm', pvW: 150, batteryWh: 200, loadW: 450, stress: 1, seed: 91 },
    { scenario: 'heatwave', pvW: 800, batteryWh: 350, loadW: 250, stress: 0.9, seed: 24 },
    { scenario: 'surge', pvW: 1500, batteryWh: 3000, loadW: 600, stress: 0, seed: 99 }
  ];
  for (const input of cases) {
    const cfg = normalizeConfig(input);
    const policy = trainController(cfg);
    for (const controller of ['fixed', 'rules', 'learned']) {
      const run = simulate(cfg, controller, policy);
      assert(Math.abs(run.totals.residualWh) < 1e-6, cfg.scenario + '/' + controller);
      assert(run.totals.batteryEndWh >= 0 && run.totals.batteryEndWh <= cfg.batteryWh);
      assert(run.totals.servedWh <= run.totals.requestedWh + 1e-7);
    }
  }
});

test('integration timestep has the correct Wh units', () => {
  const cfg = normalizeConfig({ pvW: 500, batteryWh: 1000, loadW: 100 });
  const step = stepPlant({ batteryWh: 500, coreC: 25 }, 'eco',
    { ambientC: 25, pvW: 100, loadW: 100, stress: 0 }, cfg, STEP_HOURS);
  assert(Math.abs((step.pvW - step.outputW - step.curtailW - step.lossW) * STEP_HOURS
    - (step.plant.batteryWh - 500)) < 1e-8);
});
