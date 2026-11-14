/**
 * PhiCircuitLab focused educational models.
 * These approximate ideal circuits. They are not a substitute for a SPICE
 * simulator, component datasheets, or electrical safety testing.
 */
function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(name + " must be positive and finite");
}
function finiteNonnegative(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(name + " must be nonnegative and finite");
}
export function simulateOhms(voltageV, resistanceOhms) {
  finiteNonnegative(voltageV, "Voltage");
  positiveFinite(resistanceOhms, "Resistance");
  const currentA = voltageV / resistanceOhms;
  return { voltageV, resistanceOhms, currentA, currentMa: currentA * 1000, powerW: voltageV * currentA };
}
export function simulateLed(supplyV, resistanceOhms, forwardV = 2) {
  finiteNonnegative(supplyV, "Supply voltage");
  positiveFinite(resistanceOhms, "Resistance");
  positiveFinite(forwardV, "LED forward voltage");
  // Piecewise constant Vf educational model; real LEDs are nonlinear.
  const currentA = Math.max(0, supplyV - forwardV) / resistanceOhms;
  const currentMa = currentA * 1000;
  const resistorW = currentA ** 2 * resistanceOhms;
  const ledW = currentA * forwardV;
  let status = "nominal";
  if (currentMa < 1) status = "off";
  if (currentMa > 20 || resistorW > 0.25) status = "caution";
  return { currentA, currentMa, resistorW, ledW, status, supplyV, resistanceOhms, forwardV };
}
export function logicGate(gate, a, b) {
  if (![0, 1].includes(a) || ![0, 1].includes(b)) throw new RangeError("Inputs must be 0 or 1");
  switch (gate) {
    case "AND": return a & b;
    case "OR": return a | b;
    case "XOR": return a ^ b;
    case "NAND": return 1 - (a & b);
    case "NOR": return 1 - (a | b);
    case "XNOR": return 1 - (a ^ b);
    default: throw new RangeError("Unknown gate");
  }
}
