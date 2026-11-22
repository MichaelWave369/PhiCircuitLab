import test from "node:test";
import assert from "node:assert/strict";
import {
  probabilityCube, analyzeDistribution, createNetwork,
  stepNetwork, simulateNetwork
} from "../relational369-engine.mjs";

const approx = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance,
    "Expected " + actual + " ≈ " + expected);

test("independent cube has no detectable pairwise or joint dependence", () => {
  const p = probabilityCube(0);
  p.forEach((v) => approx(v, 1 / 8));
  const m = analyzeDistribution(p);
  m.pairwiseMI.forEach((v) => approx(v, 0));
  approx(m.jointInformationAboutC, 0);
  approx(m.xorSynergyWitness, 0);
  approx(m.totalCorrelation, 0);
  approx(m.parityProbability, 0.5);
  approx(m.jointEntropy, 3);
});

test("XOR cube has zero pairwise MI but one bit of joint information", () => {
  const p = probabilityCube(1);
  const m = analyzeDistribution(p);
  m.pairwiseMI.forEach((v) => approx(v, 0));
  approx(m.jointInformationAboutC, 1);
  approx(m.xorSynergyWitness, 1);
  approx(m.totalCorrelation, 1);
  approx(m.jointEntropy, 2);
  approx(m.parityProbability, 1);
});

test("intermediate mixtures stay normalized with uniform marginals", () => {
  for (const strength of [0.1, 0.35, 0.7, 0.95]) {
    const p = probabilityCube(strength);
    approx(p.reduce((a, b) => a + b, 0), 1);
    const m = analyzeDistribution(p);
    m.pairwiseMI.forEach((v) => approx(v, 0));
    assert.ok(m.xorSynergyWitness > 0 && m.xorSynergyWitness < 1);
    approx(m.parityProbability, (1 + strength) / 2);
  }
});

test("invalid probability inputs are rejected", () => {
  assert.throws(() => probabilityCube(-0.01), RangeError);
  assert.throws(() => probabilityCube(1.01), RangeError);
  assert.throws(() => analyzeDistribution([1, 0]), TypeError);
  assert.throws(() => analyzeDistribution(Array(8).fill(0.2)), RangeError);
  assert.throws(() => createNetwork({ state: [2, 0, 0] }), RangeError);
});

test("triadic relation changes the third domain independently of pairwise edges", () => {
  const base = createNetwork({ triadicGain: 0 });
  const triad = createNetwork({ triadicGain: 1 });
  const a = stepNetwork(base);
  const b = stepNetwork(triad);
  approx(a.state[0], b.state[0]);
  approx(a.state[1], b.state[1]);
  assert.ok(b.state[2] > a.state[2]);
  assert.ok(b.lastReceipt.triadicDrive > 0);
  assert.equal(base.tick, 0, "step should not mutate the input");
});

test("without higher-order drive, equal retention conserves state sum", () => {
  const start = createNetwork({ triadicGain: 0 });
  const end = simulateNetwork(start, 100);
  approx(end.state.reduce((a, b) => a + b, 0),
    start.state.reduce((a, b) => a + b, 0), 1e-8);
});

test("relationship history records directed transfer and is deterministic", () => {
  const start = createNetwork({ triadicGain: 0.6, learningRate: 0.1 });
  const one = stepNetwork(start);
  assert.ok(one.M[0][1] > 0);
  assert.ok(one.hyperMemory > 0);
  assert.notDeepEqual(one.K, start.K);
  assert.deepEqual(simulateNetwork(start, 20), simulateNetwork(start, 20));
});

test("state values stay bounded through a long deterministic experiment", () => {
  const end = simulateNetwork(createNetwork({ triadicGain: 1, coupling: 1, learningRate: 1 }), 1000);
  assert.equal(end.tick, 1000);
  end.state.forEach((v) => assert.ok(v >= 0 && v <= 1 && Number.isFinite(v)));
  end.K.flat().forEach((v) => assert.ok(v >= 0 && v <= 1));
  end.M.flat().forEach((v) => assert.ok(v >= 0 && v <= 1));
});
