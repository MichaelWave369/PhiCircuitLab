import {
  DOMAIN_NAMES, probabilityCube, stateBits, analyzeDistribution,
  createNetwork, stepNetwork, simulateNetwork
} from "./relational369-engine.mjs";

const byId = (id) => document.getElementById(id);
const fmt = (n, d = 3) => Number(n).toFixed(d);
let pairwise;
let triadic;

function distributionView() {
  const strength = Number(byId("strength").value) / 100;
  byId("strength-value").textContent = fmt(strength, 2);
  const probabilities = probabilityCube(strength);
  const metrics = analyzeDistribution(probabilities);
  byId("metric-pair").textContent = fmt(Math.max(...metrics.pairwiseMI)) + " bits";
  byId("metric-joint").textContent = fmt(metrics.jointInformationAboutC) + " bits";
  byId("metric-synergy").textContent = fmt(metrics.xorSynergyWitness) + " bits";
  byId("metric-parity").textContent = fmt(100 * metrics.parityProbability, 1) + "%";
  byId("probability-rows").replaceChildren(...probabilities.map((p, i) => {
    const bits = stateBits(i);
    const tr = document.createElement("tr");
    const first = document.createElement("td");
    first.textContent = bits.join(" ");
    const second = document.createElement("td");
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = (p * 400) + "%";
    bar.setAttribute("aria-label", (p * 100).toFixed(1) + " percent");
    second.append(bar);
    const third = document.createElement("td");
    third.textContent = fmt(p * 100, 1) + "%";
    const fourth = document.createElement("td");
    fourth.textContent = (bits[0] ^ bits[1]) === bits[2] ? "XOR holds" : "XOR broken";
    tr.append(first, second, third, fourth);
    return tr;
  }));
}

function resetNetworks() {
  const gain = Number(byId("triad-gain").value) / 100;
  byId("triad-value").textContent = fmt(gain, 2);
  pairwise = createNetwork({ triadicGain: 0 });
  triadic = createNetwork({ triadicGain: gain });
  networkView();
}

function setStates(elementId, state) {
  const parent = byId(elementId);
  parent.replaceChildren(...state.map((value, i) => {
    const row = document.createElement("div");
    row.className = "state-row";
    const text = document.createElement("span");
    text.textContent = DOMAIN_NAMES[i] + ": " + fmt(value);
    const track = document.createElement("div");
    track.className = "track";
    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = (100 * value) + "%";
    track.append(fill);
    row.append(text, track);
    return row;
  }));
}

function networkView() {
  byId("tick").textContent = String(triadic.tick);
  setStates("pairwise-state", pairwise.state);
  setStates("triadic-state", triadic.state);
  byId("delta-c").textContent = fmt(triadic.state[2] - pairwise.state[2], 5);
  byId("hyper-memory").textContent = fmt(triadic.hyperMemory, 5);
  byId("matrix-body").replaceChildren(...triadic.K.map((row, i) => {
    const tr = document.createElement("tr");
    const head = document.createElement("th");
    head.scope = "row";
    head.textContent = DOMAIN_NAMES[i];
    tr.append(head);
    row.forEach((gain, j) => {
      const cell = document.createElement("td");
      cell.textContent = fmt(gain, 3) + " / " + fmt(triadic.M[i][j], 3);
      tr.append(cell);
    });
    return tr;
  }));
  const receipt = triadic.lastReceipt;
  byId("receipt").textContent = receipt
    ? "Tick " + receipt.tick + "; fuzzy XOR target=" + fmt(receipt.fuzzyXorTarget) +
      "; triadic drive=" + fmt(receipt.triadicDrive, 6) +
      "; total state change=" + fmt(receipt.totalAfter - receipt.totalBefore, 6)
    : "No events yet. All values use deterministic defaults.";
}

byId("strength").addEventListener("input", distributionView);
byId("triad-gain").addEventListener("input", resetNetworks);
byId("step").addEventListener("click", () => {
  pairwise = stepNetwork(pairwise);
  triadic = stepNetwork(triadic);
  networkView();
});
byId("step20").addEventListener("click", () => {
  pairwise = simulateNetwork(pairwise, 20);
  triadic = simulateNetwork(triadic, 20);
  networkView();
});
byId("reset").addEventListener("click", resetNetworks);

distributionView();
resetNetworks();
