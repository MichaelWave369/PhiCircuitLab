# ΦREL-369 / Experiment 001: The Third Relationship

Status: **research prototype**, not a novel mathematical theorem or new physical computer.

## Goal

Make relations first-class computational objects and produce a falsifiable
demonstration of why higher-order interactions cannot always be recovered from
pairwise statistical measurements.

The 3-6-9 bookkeeping convention is deliberately modest:

- 3 domain states: Interior, Boundary, Exterior
- 6 directed cross-domain channels
- 9 channels after adding the three diagonal self-relations
- 1 *additional* hyperedge/joint update rule; it does not magically follow from 9

This follows the bookkeeping in the earlier NES-369 model, but does not assume
3-6-9 has universal or optimal significance.

## Experiment A: exact XOR information

Take independent fair bits A and B, and C=A XOR B. Each pair (A,B), (A,C),
(B,C) is independent, although the triple is constrained. The XOR case has:

- each pairwise mutual information: 0 bits
- I((A,B); C): 1 bit
- total correlation: 1 bit
- H(A,B,C): 2 bits

The browser slider mixes the XOR distribution with the fully independent
8-outcome uniform distribution:

P_s(a,b,c) = (1-s)/8 + (s/4 if c=a XOR b else 0).

All calculations use Shannon entropy and exact probabilities, not Monte Carlo.
The displayed "XOR synergy witness" is I((A,B);C)-I(A;C)-I(B;C).
This witness is sufficient for the designed test, *not* a universally valid
partial information decomposition (PID), and can be negative in redundant systems.

## Experiment B: toy relational execution

Three bounded scalar states x are updated in parallel from a snapshot:

- For each directed pair i→j: f_ij = 0.1 * K_ij * max(0, x_i-x_j)
- Every flow decreases the source and increases the destination by the same amount.
- For each domain i: x'_i = clamp(x_i + (1-K_ii) * Δ_i, 0, 1)
- Optional three-way drive on domain C:
  d = 0.1 * h * (a+b-2ab-c)
- Each relationship records an exponential moving average of its transfer.
- Optional learning updates cross-domain K from recorded memory.

With uniform retention and no drive, net state is conserved to floating-point
tolerance. With the three-way drive on, the sum can change, which is recorded in
the event receipt: this is an explicit model input, not an unaccounted violation
of physical energy conservation.

The browser runs the pairwise and higher-order cases side-by-side from the same
initial state. Default learning rate is zero so only the higher-order rule differs.

## Scope and scientific interpretation

- The XOR distribution is a classic, established higher-order information example.
- The engine and visualizer are *proposed software abstractions* executed on an
  ordinary digital computer, not a demonstration of novel physical hardware.
- Pairwise **statistics** being insufficient does not imply pairwise **dynamical
  networks** are universally insufficient: hidden nodes, time, and nonlinear
  compositions can implement XOR. This experiment is not a proof of computational
  superiority of hypergraphs.
- A successful research language needs semantics, compositionality, type safety,
  reproducible evaluation, and eventually fair workload benchmarks.
- Competing 2-, 4-, 5-, and unconstrained-N-domain architectures are mandatory
  controls before preferring the 369 scaffold.

## Reproduction

Open the static site over HTTPS or a local HTTP server at
[relational369.html](../relational369.html). No dependencies or credentials.

From the repository root:

    npm test
    node --test tests/relational369.test.mjs

Next phase: define explicit relation operators and a declarative parser;
compare dynamic networks at matched parameter and compute budgets;
introduce controlled perturbations, memory ablations, and independent
benchmarks against established graph/interaction-net systems.

Relevant foundations: Shannon information theory; XOR synergistic-information
examples; interaction nets (Yves Lafont); hypergraphs and higher-order networks;
NES-369 as a proposed architecture rather than empirical evidence.
