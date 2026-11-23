// PhiCircuitLab / ΦREL-369 research prototype.
// Logical relations are modeled explicitly; this runs on ordinary JavaScript hardware.
export const DOMAIN_NAMES = Object.freeze(["Interior", "Boundary", "Exterior"]);

function finite(value, name, min = -Infinity, max = Infinity) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(name + " must be finite and between " + min + " and " + max);
  }
  return value;
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function probabilityCube(strength = 1) {
  finite(strength, "strength", 0, 1);
  // Convex mixture: uniform independence and even-parity/XOR distribution.
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i >> 2) & 1;
    const b = (i >> 1) & 1;
    const c = i & 1;
    return (1 - strength) / 8 + ((a ^ b) === c ? strength / 4 : 0);
  });
}

export function stateBits(i) {
  if (!Number.isInteger(i) || i < 0 || i > 7) throw new RangeError("state index 0..7");
  return [(i >> 2) & 1, (i >> 1) & 1, i & 1];
}

function subsetEntropy(probabilities, indices) {
  const bins = new Map();
  probabilities.forEach((p, i) => {
    const bits = stateBits(i);
    const key = indices.map((j) => bits[j]).join("");
    bins.set(key, (bins.get(key) ?? 0) + p);
  });
  let result = 0;
  for (const p of bins.values()) if (p > 0) result -= p * Math.log2(p);
  return result;
}

export function analyzeDistribution(probabilities) {
  if (!Array.isArray(probabilities) || probabilities.length !== 8) {
    throw new TypeError("Expected eight probabilities for A,B,C");
  }
  probabilities.forEach((p, i) => finite(p, "probability " + i, 0, 1));
  if (Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) > 1e-9) {
    throw new RangeError("Probabilities must sum to one");
  }
  const H = (indices) => subsetEntropy(probabilities, indices);
  const mi = (a, b) => H([a]) + H([b]) - H([a, b]);
  const pairwiseMI = [mi(0, 1), mi(0, 2), mi(1, 2)];
  const jointInformationAboutC = H([0, 1]) + H([2]) - H([0, 1, 2]);
  // XOR synergy witness, not a general-purpose partial information decomposition.
  const xorSynergyWitness = jointInformationAboutC - pairwiseMI[1] - pairwiseMI[2];
  const parityProbability = probabilities.reduce((sum, p, i) => {
    const [a, b, c] = stateBits(i);
    return sum + ((a ^ b) === c ? p : 0);
  }, 0);
  const nearZero = (v) => Math.abs(v) < 1e-11 ? 0 : v;
  return {
    pairwiseMI: pairwiseMI.map(nearZero),
    jointInformationAboutC: nearZero(jointInformationAboutC),
    xorSynergyWitness: nearZero(xorSynergyWitness),
    totalCorrelation: nearZero(H([0]) + H([1]) + H([2]) - H([0, 1, 2])),
    jointEntropy: H([0, 1, 2]),
    parityProbability
  };
}

export function createNetwork(options = {}) {
  const {
    state = [0.8, 0.2, 0.1],
    coupling = 0.5,
    retention = 0.15,
    triadicGain = 0.65,
    memoryRate = 0.25,
    learningRate = 0
  } = options;
  if (!Array.isArray(state) || state.length !== 3) throw new TypeError("Three domain states required");
  state.forEach((x, i) => finite(x, "state " + i, 0, 1));
  for (const [name, v] of Object.entries({ coupling, retention, triadicGain, memoryRate, learningRate })) {
    finite(v, name, 0, 1);
  }
  return {
    tick: 0,
    state: [...state],
    K: Array.from({ length: 3 }, (_, i) =>
      Array.from({ length: 3 }, (_, j) => i === j ? retention : coupling)),
    M: Array.from({ length: 3 }, () => [0, 0, 0]),
    triadicGain,
    hyperMemory: 0,
    memoryRate,
    learningRate,
    lastReceipt: null
  };
}

export function stepNetwork(network) {
  if (!network || !Array.isArray(network.state) || network.state.length !== 3) {
    throw new TypeError("Invalid relational network");
  }
  network.state.forEach((v, i) => finite(v, "state " + i, 0, 1));
  for (const field of ["K", "M"]) {
    if (!Array.isArray(network[field]) || network[field].length !== 3) {
      throw new TypeError(field + " must be a 3x3 matrix");
    }
    network[field].forEach((row, i) => {
      if (!Array.isArray(row) || row.length !== 3) throw new TypeError(field + " must be 3x3");
      row.forEach((v, j) => finite(v, field + i + j, 0, 1));
    });
  }
  finite(network.triadicGain, "triadicGain", 0, 1);
  finite(network.memoryRate, "memoryRate", 0, 1);
  finite(network.learningRate, "learningRate", 0, 1);
  finite(network.hyperMemory, "hyperMemory", 0, 1);
  const x = network.state;
  const delta = [0, 0, 0];
  const flows = Array.from({ length: 3 }, () => [0, 0, 0]);
  // All flows are calculated from the same snapshot, then committed simultaneously.
  for (let src = 0; src < 3; src++) {
    for (let dst = 0; dst < 3; dst++) {
      if (src === dst) continue;
      const flow = 0.1 * network.K[src][dst] * Math.max(0, x[src] - x[dst]);
      flows[src][dst] = flow;
      delta[src] -= flow;
      delta[dst] += flow;
    }
  }
  // This nonlinear triad cannot be inferred from pairwise marginals alone.
  // It represents a joint update rule, not a physical conservation law.
  const fuzzyXor = x[0] + x[1] - 2 * x[0] * x[1];
  const triadicDrive = 0.1 * network.triadicGain * (fuzzyXor - x[2]);
  delta[2] += triadicDrive;
  const state = x.map((value, i) => clamp01(value + (1 - network.K[i][i]) * delta[i]));
  const M = network.M.map((row, i) => row.map((old, j) => {
    const signal = i === j ? Math.abs(state[i] - x[i]) : flows[i][j];
    return clamp01((1 - network.memoryRate) * old + network.memoryRate * signal);
  }));
  const K = network.K.map((row, i) => row.map((old, j) => {
    if (i === j) return old;
    return clamp01(old + network.learningRate * (M[i][j] - 0.01 * old));
  }));
  const hyperMemory = clamp01((1 - network.memoryRate) * network.hyperMemory +
    network.memoryRate * Math.abs(triadicDrive));
  const receipt = {
    tick: network.tick + 1,
    statesBefore: [...x],
    statesAfter: [...state],
    flows,
    fuzzyXorTarget: fuzzyXor,
    triadicDrive,
    totalBefore: x.reduce((a, b) => a + b, 0),
    totalAfter: state.reduce((a, b) => a + b, 0)
  };
  return {
    ...network, tick: network.tick + 1, state, K, M, hyperMemory,
    lastReceipt: receipt
  };
}

export function simulateNetwork(network, steps) {
  if (!Number.isInteger(steps) || steps < 0 || steps > 10000) {
    throw new RangeError("steps must be an integer from 0 to 10000");
  }
  let current = network;
  for (let i = 0; i < steps; i++) current = stepNetwork(current);
  return current;
}
