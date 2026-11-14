# Φ Circuit Lab • Virtual Experiment Worksheets

**Free • No equipment • No account • Reusable**

These worksheets are meant to accompany the six in-browser benches. Copy the tables into your notebook, print this page, or fill them in electronically. Predictions matter more than getting the number right on the first try.

## Experiment 1 — Same resistors, different wiring

**Open:** Workbench → **Series & Parallel**

Set the supply to **6 V** with **R1 = 500 Ω** and **R2 = 500 Ω**. Fill in your predictions before switching topology.

| Topology | Predicted equivalent R | Predicted supply current | Predicted voltage across R1 | Simulated result |
| --- | --- | --- | --- | --- |
| Series | | | | |
| Parallel | | | | |

1. In which topology is total resistance larger?
2. Why do both resistors carry the same current in series?
3. Why do both resistors have the same voltage in parallel?
4. How does supply current change when total resistance decreases at the same supply voltage?

**Bonus:** Keep both resistors equal and halve the supply voltage. Predict whether total current halves.

## Experiment 2 — A voltage divider under load

**Open:** Workbench → **Voltage Divider**

Set **Vin = 9 V**, **R1 = 2,000 Ω**, **R2 = 1,000 Ω**.

| Condition | Predicted Vout | Measured Vout | Source current | Load current |
| --- | --- | --- | --- | --- |
| No load | | | | 0 |
| RL = 1,000 Ω | | | | |
| RL = 500 Ω | | | | |
| RL = 5,000 Ω | | | | |

1. Which load produces the greatest voltage drop from the unloaded case?
2. Why does a load connected in parallel with R2 reduce its equivalent resistance?
3. Would you trust a bare divider to power an arbitrary motor or radio? Why not?

**Safety idea:** A voltage divider is useful as a signal source under known loading conditions. It is not a universal voltage regulator.

## Experiment 3 — The RC clock

**Open:** Workbench → **RC Timing**

Set **V = 5 V**, **R = 1,000 Ω**, **C = 100 µF**.

Calculate \`τ = R × C = __________ seconds\`.

| Time | Predicted charging voltage | Simulated charging voltage | Simulated discharging voltage |
| --- | --- | --- | --- |
| 0τ | | | |
| 1τ | | | |
| 2τ | | | |
| 3τ | | | |
| 5τ | | | |

1. At 1τ, roughly what percentage of the final voltage has been reached when charging?
2. At 1τ, roughly what percentage remains during discharge?
3. Keep C constant but double R. How does τ change?
4. Does doubling resistance change the *normalized* curve, or only the real time required?

**Extension:** Explain one use for an RC circuit, such as a timing delay or simple filtering.

## Experiment 4 — The engineering sanity check

Choose one of the virtual benches. Record:

- The assumptions of the mathematical model.
- One real-world effect omitted by that model.
- A component specification you would need for a physical build.
- A measurement you would perform with a multimeter if hardware were available.
- The way you would protect the circuit from an accidental short.

## Instructor answer key (read after attempting the experiments)

**1. Series/parallel with 500 Ω and 500 Ω at 6 V:** Series = 1,000 Ω, supply current = 6 mA, R1 drop = 3 V. Parallel = 250 Ω, supply current = 24 mA, R1 drop = 6 V. At constant resistance, halving the supply voltage halves current.

**2. Divider with 9 V, R1=2 kΩ, R2=1 kΩ:** No load gives 3 V. A 1 kΩ load makes the effective lower resistance 500 Ω, producing 1.8 V. Lower-resistance loads cause greater loading.

**3. RC with R=1 kΩ, C=100 µF:** τ = 0.1 s. Charging at 1τ ≈ 63.2%, discharging at 1τ ≈ 36.8%. Doubling R doubles τ. The normalized ideal first-order curve is unchanged, but time stretches.

## Scope note

The built-in labs use ideal component formulas. They do **not** certify that a proposed circuit is safe to assemble or operate. For physical builds, review individual component datasheets, power ratings, and the [safety guide](SAFETY.md).
