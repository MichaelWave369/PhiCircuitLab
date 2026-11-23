/**
 * ΦREL-369 v0.2: a tiny, deterministic relational DSL.
 * This is interpreted software, not a claim about new physical computation.
 * No eval, Function, I/O, dynamically generated code, or unbounded loops.
 */
export const REL_DOMAIN_NAMES = Object.freeze(["A", "B", "C"]);
const DOMAIN_INDEX = Object.freeze({ A: 0, B: 1, C: 2 });
const TRIAD_OPERATORS = Object.freeze(["XOR", "AND", "OR", "MEAN"]);
const REL_OPERATORS = Object.freeze(["EXCITE", "INHIBIT", "SYNC", "REMEMBER", "RECALL"]);
const clamp01 = (n) => Math.max(0, Math.min(1, n));

function scalar(s, line) {
  const n = Number(s);
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(s) || !Number.isFinite(n) || n < 0 || n > 1) {
    throw new SyntaxError("Line " + line + ": expected a finite number from 0 to 1");
  }
  return n;
}
function fail(line, message) {
  throw new SyntaxError("Line " + line + ": " + message);
}
function validStates(states) {
  if (!Array.isArray(states) || states.length !== 3 ||
      states.some((s) => typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > 1)) {
    throw new RangeError("Expected exactly three finite states in [0,1]");
  }
}

export function parseREL369(source) {
  if (typeof source !== "string" || source.length > 4096) {
    throw new TypeError("Program must be text with at most 4096 characters");
  }
  const lines = source.split(/\r?\n/);
  if (lines.length > 48) throw new SyntaxError("Program exceeds 48 lines");
  const initial = [null, null, null];
  const rules = [];
  const remembering = new Set();
  lines.forEach((original, i) => {
    const line = i + 1;
    const text = original.replace(/#.*/, "").trim();
    if (!text) return;
    let m = text.match(/^STATE\s+([ABC])\s+([^\s]+)$/i);
    if (m) {
      const index = DOMAIN_INDEX[m[1].toUpperCase()];
      if (initial[index] !== null) fail(line, "duplicate STATE " + m[1].toUpperCase());
      initial[index] = scalar(m[2], line);
      return;
    }
    m = text.match(/^RELATE\s+([ABC])\s*(<->|->)\s*([ABC])\s+(EXCITE|INHIBIT|SYNC|REMEMBER|RECALL)\s+([^\s]+)$/i);
    if (m) {
      const from = DOMAIN_INDEX[m[1].toUpperCase()];
      const to = DOMAIN_INDEX[m[3].toUpperCase()];
      const kind = m[4].toUpperCase();
      const gain = scalar(m[5], line);
      if (kind === "SYNC" && (m[2] !== "<->" || from === to)) {
        fail(line, "SYNC requires different domains and <->");
      }
      if (kind !== "SYNC" && m[2] !== "->") fail(line, kind + " requires ->");
      if ((kind === "REMEMBER" || kind === "RECALL") && from !== to) {
        fail(line, kind + " requires a self-relation");
      }
      if ((kind === "EXCITE" || kind === "INHIBIT") && from === to) {
        fail(line, kind + " requires distinct domains");
      }
      if (kind === "REMEMBER") {
        if (remembering.has(from)) fail(line, "one REMEMBER update per domain");
        remembering.add(from);
      }
      rules.push({ type: "relation", kind, from, to, gain, line });
    } else {
      m = text.match(/^TRIAD\s+([ABC])\s+([ABC])\s*->\s*([ABC])\s+(XOR|AND|OR|MEAN)\s+([^\s]+)$/i);
      if (!m) fail(line, "unrecognized instruction");
      const from = DOMAIN_INDEX[m[1].toUpperCase()];
      const via = DOMAIN_INDEX[m[2].toUpperCase()];
      const to = DOMAIN_INDEX[m[3].toUpperCase()];
      if (new Set([from, via, to]).size !== 3) fail(line, "TRIAD requires three distinct domains");
      rules.push({
        type: "triad", kind: m[4].toUpperCase(), from, via, to,
        gain: scalar(m[5], line), line
      });
    }
    if (rules.length > 24) fail(line, "maximum 24 rules");
  });
  if (initial.some((v) => v === null)) {
    throw new SyntaxError("Program must declare each of STATE A, STATE B, STATE C exactly once");
  }
  return {
    schema: "phi-rel-369/v1",
    initial,
    rules
  };
}

export function jointOperator(kind, a, b) {
  if (!TRIAD_OPERATORS.includes(kind)) throw new RangeError("Unknown joint operator: " + kind);
  if (![a, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
    throw new RangeError("Joint inputs must be in [0,1]");
  }
  if (kind === "XOR") return a + b - 2 * a * b;
  if (kind === "AND") return a * b;
  if (kind === "OR") return a + b - a * b;
  return (a + b) / 2;
}

export function createRELRuntime(program, { states } = {}) {
  if (!program || program.schema !== "phi-rel-369/v1" || !Array.isArray(program.rules)) {
    throw new TypeError("Expected a parsed ΦREL-369 program");
  }
  const initial = states ? [...states] : [...program.initial];
  validStates(initial);
  return {
    program,
    tick: 0,
    states: initial,
    memory: [...initial],
    lastReceipt: null
  };
}

export function stepRELRuntime(runtime) {
  if (!runtime || !runtime.program || runtime.program.schema !== "phi-rel-369/v1") {
    throw new TypeError("Expected a ΦREL-369 runtime");
  }
  validStates(runtime.states);
  validStates(runtime.memory);
  const x = runtime.states;
  const oldMemory = runtime.memory;
  const memory = [...oldMemory];
  const delta = [0, 0, 0];
  const events = [];
  for (const rule of runtime.program.rules) {
    const { type, kind, gain, from, to, line } = rule;
    let impact = 0;
    if (type === "triad") {
      const target = jointOperator(kind, x[from], x[rule.via]);
      impact = 0.25 * gain * (target - x[to]);
      delta[to] += impact;
    } else if (kind === "EXCITE") {
      impact = 0.25 * gain * x[from] * (1 - x[to]);
      delta[to] += impact;
    } else if (kind === "INHIBIT") {
      impact = -0.25 * gain * x[from] * x[to];
      delta[to] += impact;
    } else if (kind === "SYNC") {
      impact = 0.25 * gain * (x[to] - x[from]);
      delta[from] += impact;
      delta[to] -= impact;
    } else if (kind === "REMEMBER") {
      impact = gain * (x[from] - oldMemory[from]);
      memory[from] = clamp01(oldMemory[from] + impact);
    } else if (kind === "RECALL") {
      impact = 0.25 * gain * (oldMemory[from] - x[to]);
      delta[to] += impact;
    } else {
      throw new TypeError("Unknown operator " + kind + " on line " + line);
    }
    events.push({ kind, from, to, line, impact });
  }
  const states = x.map((v, i) => clamp01(v + delta[i]));
  const receipt = {
    tick: runtime.tick + 1,
    before: [...x],
    after: [...states],
    memoryBefore: [...oldMemory],
    memoryAfter: [...memory],
    events,
    stateSumChange: states.reduce((a, b) => a + b, 0) - x.reduce((a, b) => a + b, 0)
  };
  return { ...runtime, tick: runtime.tick + 1, states, memory, lastReceipt: receipt };
}

export function runREL369(runtime, steps = 1) {
  if (!Number.isInteger(steps) || steps < 0 || steps > 1000) {
    throw new RangeError("steps must be an integer from 0 to 1000");
  }
  let result = runtime;
  for (let t = 0; t < steps; t++) result = stepRELRuntime(result);
  return result;
}

export const REL_EXAMPLES = Object.freeze({
  xor: [
    "# A three-way constraint as the program",
    "STATE A 0.8",
    "STATE B 0.2",
    "STATE C 0.5",
    "TRIAD A B -> C XOR 1",
    "RELATE C -> C REMEMBER 0.2"
  ].join("\n"),
  synchronize: [
    "# Connections pull entities toward one another",
    "STATE A 1",
    "STATE B 0.1",
    "STATE C 0",
    "RELATE A <-> B SYNC 0.9",
    "RELATE B <-> C SYNC 0.9",
    "RELATE A <-> C SYNC 0.9"
  ].join("\n"),
  memory: [
    "# Shock C after several steps, observe historical pull",
    "STATE A 0.1",
    "STATE B 0.3",
    "STATE C 0.9",
    "RELATE C -> C REMEMBER 0.08",
    "RELATE C -> C RECALL 1",
    "RELATE A -> C INHIBIT 0.4"
  ].join("\n")
});

export const REL_OPERATOR_NAMES = Object.freeze([...REL_OPERATORS, ...TRIAD_OPERATORS]);
