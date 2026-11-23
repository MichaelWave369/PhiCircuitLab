/**
 * Constrained enumerative program synthesis for ΦREL-369.
 * This is not an LLM, autonomous AI discovery, or evidence of novel physics.
 */
import { parseREL369, createRELRuntime, runREL369, jointOperator } from "./relational369-language.mjs";

const GAINS = Object.freeze([0.25, 0.5, 0.75, 1]);
const OPS = Object.freeze(["XOR", "AND", "OR", "MEAN"]);
const TRAIN = Object.freeze([[0,0],[0,1],[1,0],[1,1]]);
const HOLDOUT = Object.freeze([0.2,0.4,0.6,0.8].flatMap(a =>
  [0.2,0.4,0.6,0.8].map(b => [a,b])
));
const header = "STATE A 0\nSTATE B 0\nSTATE C 0.5\n";

function candidate(code, family, nParams) {
  return { code: header + code, family, nParams, program: parseREL369(header + code) };
}

export function candidatePrograms() {
  const all = [];
  for (const op of OPS) for (const gain of GAINS) {
    all.push(candidate("TRIAD A B -> C " + op + " " + gain, "higher-order", 1));
  }
  for (const opA of ["EXCITE", "INHIBIT"]) {
    for (const opB of ["EXCITE", "INHIBIT"]) {
      for (const gainA of GAINS) for (const gainB of GAINS) {
        all.push(candidate(
          "RELATE A -> C " + opA + " " + gainA + "\n" +
          "RELATE B -> C " + opB + " " + gainB,
          "pairwise", 2
        ));
      }
    }
  }
  return all;
}

function mse(program, target, inputs, steps) {
  let sum = 0;
  for (const [a,b] of inputs) {
    const rt = createRELRuntime(program, { states: [a,b,0.5] });
    const value = runREL369(rt, steps).states[2];
    const truth = jointOperator(target, a, b);
    sum += (value - truth) ** 2;
  }
  return sum / inputs.length;
}

export function synthesizeRelations(target = "XOR", steps = 16) {
  if (!OPS.includes(target)) throw new RangeError("Target must be XOR, AND, OR or MEAN");
  if (!Number.isInteger(steps) || steps < 1 || steps > 60) {
    throw new RangeError("Expected 1..60 simulation steps");
  }
  const pool = candidatePrograms();
  const groups = {};
  for (const family of ["higher-order", "pairwise"]) {
    const scored = pool.filter((c) => c.family === family).map((c) => ({
      code: c.code,
      family: c.family,
      nParams: c.nParams,
      program: c.program,
      trainingMSE: mse(c.program, target, TRAIN, steps)
    }));
    // Validation data never participates in candidate selection.
    scored.sort((a,b) => a.trainingMSE - b.trainingMSE || a.code.localeCompare(b.code));
    const best = scored[0];
    groups[family] = {
      candidates: scored.length,
      nParams: best.nParams,
      code: best.code,
      trainingMSE: best.trainingMSE,
      holdoutMSE: mse(best.program, target, HOLDOUT, steps)
    };
  }
  return {
    target,
    steps,
    totalCandidates: pool.length,
    trainingCases: TRAIN.length,
    holdoutCases: HOLDOUT.length,
    groups
  };
}

export const DISCOVERY_TARGETS = [...OPS];
