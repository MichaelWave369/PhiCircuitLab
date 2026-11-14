/**
 * Additional idealized teaching models for circuit fundamentals.
 * Positive component values, finite nonnegative supply, no physical tolerances.
 * These are steady-state resistive approximations or ideal first-order RC models,
 * not SPICE, real hardware verification, or safety certification.
 */
const nonnegative = (value, label) => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(label + ' must be finite and nonnegative');
};
const positive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(label + ' must be finite and positive');
};

/** Two ideal resistors connected to an ideal DC supply. */
export function resistorNetwork(supplyV, r1Ohms, r2Ohms, topology = 'series') {
  nonnegative(supplyV, 'Supply voltage');
  positive(r1Ohms, 'R1');
  positive(r2Ohms, 'R2');
  if (topology !== 'series' && topology !== 'parallel') {
    throw new RangeError('Topology must be series or parallel');
  }
  const series = topology === 'series';
  const equivalentOhms = series
    ? r1Ohms + r2Ohms
    : 1 / (1 / r1Ohms + 1 / r2Ohms);
  const totalCurrentA = supplyV / equivalentOhms;
  const voltage1V = series ? totalCurrentA * r1Ohms : supplyV;
  const voltage2V = series ? totalCurrentA * r2Ohms : supplyV;
  const current1A = series ? totalCurrentA : supplyV / r1Ohms;
  const current2A = series ? totalCurrentA : supplyV / r2Ohms;
  return {
    topology, supplyV, r1Ohms, r2Ohms, equivalentOhms, totalCurrentA,
    voltage1V, voltage2V, current1A, current2A,
    power1W: current1A * voltage1V, power2W: current2A * voltage2V,
    totalPowerW: supplyV * totalCurrentA
  };
}

/** Two ideal resistors, with optional third load across the bottom resistor. */
export function voltageDivider(supplyV, topOhms, bottomOhms, loadOhms = null) {
  nonnegative(supplyV, 'Supply voltage');
  positive(topOhms, 'Top resistor');
  positive(bottomOhms, 'Bottom resistor');
  if (loadOhms !== null) positive(loadOhms, 'Load resistor');
  const effectiveBottomOhms = loadOhms === null
    ? bottomOhms
    : 1 / (1 / bottomOhms + 1 / loadOhms);
  const currentSourceA = supplyV / (topOhms + effectiveBottomOhms);
  const outputV = currentSourceA * effectiveBottomOhms;
  const currentBottomA = outputV / bottomOhms;
  const currentLoadA = loadOhms === null ? 0 : outputV / loadOhms;
  return {
    supplyV, topOhms, bottomOhms, loadOhms,
    effectiveBottomOhms, outputV, currentSourceA, currentBottomA,
    currentLoadA, topDropV: supplyV - outputV,
    topPowerW: currentSourceA * (supplyV - outputV),
    bottomPowerW: outputV * currentBottomA,
    loadPowerW: outputV * currentLoadA
  };
}

/** Ideal RC charge/discharge from an initial state at t=0. */
export function rcTransient(supplyV, resistanceOhms, capacitanceMicroF, timeSeconds, mode = 'charge') {
  nonnegative(supplyV, 'Supply voltage');
  positive(resistanceOhms, 'Resistance');
  positive(capacitanceMicroF, 'Capacitance');
  nonnegative(timeSeconds, 'Time');
  if (mode !== 'charge' && mode !== 'discharge') {
    throw new RangeError('Mode must be charge or discharge');
  }
  const capacitanceF = capacitanceMicroF * 1e-6;
  const tauSeconds = resistanceOhms * capacitanceF;
  const residual = Math.exp(-timeSeconds / tauSeconds);
  const capacitorV = mode === 'charge' ? supplyV * (1 - residual) : supplyV * residual;
  const currentA = (mode === 'charge' ? 1 : -1) * (supplyV / resistanceOhms) * residual;
  const storedEnergyJ = 0.5 * capacitanceF * capacitorV ** 2;
  return { mode, supplyV, resistanceOhms, capacitanceMicroF, capacitanceF, timeSeconds,
    tauSeconds, capacitorV, currentA, storedEnergyJ };
}
