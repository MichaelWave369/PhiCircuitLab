import {
  parseREL369, createRELRuntime, stepRELRuntime, runREL369, REL_EXAMPLES
} from "./relational369-language.mjs";
import { synthesizeRelations, DISCOVERY_TARGETS } from "./relational369-discovery.mjs";

const get = id => document.getElementById(id);
const fmt = (n, decimals = 5) => Number(n).toFixed(decimals);
let runtime = null;

function showRuntime() {
  get("rel-runtime-tick").textContent = runtime ? String(runtime.tick) : "—";
  const states = runtime?.states ?? [];
  const memory = runtime?.memory ?? [];
  get("rel-state-lines").textContent = states.map((s, i) =>
    "ABC"[i] + "  " + fmt(s) + "  " + "█".repeat(Math.round(s*16))).join("\n");
  get("rel-memory-lines").textContent = memory.map((m,i) =>
    "ABC"[i] + "  " + fmt(m)).join("\n");
  if (!runtime?.lastReceipt) {
    get("rel-runtime-receipt").textContent = "Initial state; no execution receipts yet.";
    return;
  }
  const receipt = runtime.lastReceipt;
  get("rel-runtime-receipt").textContent =
    "tick=" + receipt.tick +
    " | state-sum Δ=" + fmt(receipt.stateSumChange,7) + "\n" +
    receipt.events.map(e => "line " + e.line + " " + e.kind +
      " " + "ABC"[e.from] + "→" + "ABC"[e.to] +
      " impact=" + fmt(e.impact,7)).join("\n");
}

function compileSource() {
  try {
    const program = parseREL369(get("rel-editor").value);
    runtime = createRELRuntime(program);
    get("rel-status").textContent =
      "Compiled: " + program.rules.length + " executable relations; initial state restored.";
    showRuntime();
  } catch (error) {
    // Do not execute a partially parsed program.
    get("rel-status").textContent = "Parse error: " + error.message;
  }
}

function advance(count) {
  if (!runtime) return;
  try {
    runtime = runREL369(runtime, count);
    get("rel-status").textContent = "Executed " + count + " simultaneous update(s).";
    showRuntime();
  } catch (error) {
    get("rel-status").textContent = "Execution error: " + error.message;
  }
}

get("rel-preset").addEventListener("change", () => {
  get("rel-editor").value = REL_EXAMPLES[get("rel-preset").value];
  compileSource();
});
get("rel-editor").addEventListener("input", () => {
  get("rel-status").textContent =
    "Code changed. Compile to run the edited program; previous runtime remains unchanged.";
});
get("rel-compile").addEventListener("click", compileSource);
get("rel-step").addEventListener("click", () => advance(1));
get("rel-step20").addEventListener("click", () => advance(20));
get("rel-shock").addEventListener("click", () => {
  if (!runtime) return;
  runtime = {
    ...runtime,
    states: [...runtime.states.slice(0,2),0.05],
    lastReceipt: null
  };
  get("rel-status").textContent =
    "External perturbation applied: C=0.05, memory preserved. Not a DSL instruction.";
  showRuntime();
});

get("rel-discover").addEventListener("click", () => {
  try {
    const target = get("rel-target").value;
    const results = synthesizeRelations(target);
    const tri = results.groups["higher-order"];
    const pair = results.groups.pairwise;
    get("rel-discovery-report").textContent =
      "Target: " + target + "\n" +
      results.totalCandidates + " enumerated programs; " +
      results.trainingCases + " Boolean training cases and " +
      results.holdoutCases + " interior validation cases.\n\n" +
      "HIGHER-ORDER (1 adjustable gain, " + tri.candidates + " candidates)\n" +
      "training MSE = " + fmt(tri.trainingMSE,7) +
      "\nholdout MSE  = " + fmt(tri.holdoutMSE,7) +
      "\n" + tri.code + "\n\n" +
      "PAIRWISE (2 adjustable gains, " + pair.candidates + " candidates)\n" +
      "training MSE = " + fmt(pair.trainingMSE,7) +
      "\nholdout MSE  = " + fmt(pair.holdoutMSE,7) +
      "\n" + pair.code;
    get("rel-discovery-status").textContent =
      "Completed deterministic exhaustive search; the validation inputs were not used to choose winners.";
  } catch (error) {
    get("rel-discovery-status").textContent = "Search error: " + error.message;
  }
});

for (const target of DISCOVERY_TARGETS) {
  const option = document.createElement("option");
  option.value = target;
  option.textContent = target;
  get("rel-target").append(option);
}
get("rel-preset").value = "xor";
get("rel-editor").value = REL_EXAMPLES.xor;
compileSource();
