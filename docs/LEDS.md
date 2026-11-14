# Φ Circuit Lab: LED Wiring Studio

**Version 0.5 | Hardware needed: none | Simulator type: instructional DC**

## Objective

Wire a real topology in the virtual laboratory, then learn how polarity, current limiting and forward-voltage assumptions affect an LED. Unlike a purely animated demonstration, the Wiring Lab derives its results from your actual connection graph.

## Try the three LED presets

### 1. Red LED with a current-limiting resistor

Choose **Wiring Lab → Red LED + 330 Ω**. The model uses a 5 V supply and a red LED with an approximate 2.0 V forward threshold.

A simplified first-pass calculation from the standalone LED bench is:

```text
I ≈ (5.0 − 2.0) / 330 = 0.00909 A = 9.09 mA
```

The **Wiring Lab uses a slightly different, piecewise-linear teaching model** with an additional 20 Ω model slope in the diode:

```text
I ≈ (5.0 − 2.0) / (330 + 20) = 0.008571 A ≈ 8.571 mA
LED voltage ≈ 2.0 + 20 × 0.008571 = 2.171 V
```

Both models are approximations. Neither is a component datasheet or a physical measurement. Comparing their predictions helps illustrate that a model's assumptions affect its answer.

Select the LED and change its color to green (assumed 2.2 V) or blue (assumed 3.2 V). Current should decrease as assumed forward voltage increases while supply and resistance stay fixed.

### 2. Reversed LED

Choose **Reversed LED + 330 Ω**. Observe that the LED shows zero modeled current despite having a closed connection through the resistor.

Its cathode is toward the positive supply, so it is reverse biased. The simulator assumes no reverse leakage or breakdown, **but actual LEDs have maximum reverse-voltage limits** and can be damaged. Zero simulated current does not imply a safe physical design.

### 3. LED without a resistor (virtual cautionary example)

Choose **LED without resistor (caution)**. The simplified 20 Ω slope produces a finite numerical current:

```text
I_model ≈ (5 − 2) / 20 = 0.15 A = 150 mA
```

The app must show a **missing current-limiting resistor warning** and an overcurrent warning. That 150 mA is not a reliable prediction for a real unprotected LED. Real current depends on the LED's nonlinear current-voltage curve, power source, wiring and temperature; device damage may occur.

**Never reproduce the no-resistor or short-circuit experiments using physical power supplies.**

## Build an LED circuit from a blank workspace

1. Select **Blank wiring challenge** and disconnect the existing parts if needed.
2. Keep one resistor (R1), change it to 330 Ω, and remove R2.
3. Click **+ Add LED** to place D1.
4. Join V+ → R1:a, R1:b → D1:a, and D1:b → GND.
5. Set supply to 5 V. Confirm that the model predicts forward LED current.
6. Swap the connections so the LED cathode (b) faces V+ and anode (a) faces ground through the resistor.
7. Observe the change from forward conduction to reverse blocking.

**Terminal convention:** LED terminal **a** is the anode, and terminal **b** is the cathode (identified by the bar). Current is positive in the a→b direction.

## Read the circuit table

- **ΔV (a→b)** is the anode-to-cathode voltage for an LED. It may be negative under reverse bias.
- **I (a→b)** is model current from anode to cathode, zero when the LED is off or reversed.
- **Power** is the model's electrical dissipation in watts or milliwatts, not a thermal prediction.
- **State** can be on, off, reverse, bypassed, floating or unresolved.
- **Operating-point V/I** replaces “equivalent resistance” when LEDs are present. It is a ratio measured at one chosen voltage and **does not** mean the network behaves like an ohmic resistor.

## What the solver actually does

This is a **piecewise-linear**, not fully physical diode model:

- Forward **ON** branch: `I = (V_anode − V_cathode − Vf) / 20 Ω` with nonnegative current.
- **OFF** branch: zero current when the assumed forward threshold is not exceeded.
- The solver enumerates possible LED conducting states for at most three LEDs, solves a linear nodal system for each, and accepts one consistent solution.
- It recognizes ideal wires, open/closed switches, resistors, reverse bias and powered/floating networks.
- It does not simulate avalanche breakdown, leakage, temperature, light intensity calibration, dynamic resistance curves, or transient behavior.

LED assumptions in this classroom: red Vf=2.0 V; green Vf=2.2 V; blue Vf=3.2 V; all use a **teaching-only** 20 Ω series slope, independent of actual device type. A 20 mA warning is a heuristic, **not** a guarantee that any particular LED or microcontroller pin is safe at 20 mA.

## JSON compatibility

Saved circuit documents remain `version: 1` and accept older files without a `leds` field. An LED is described as:

```json
{"id": "D1", "color": "red", "x": 635, "y": 170}
```

Maximum: eight resistors, four switches, three LEDs, forty ideal wires. Imports validate types, component identifiers, supported colors, numeric bounds and connection endpoints.

## Next experiments

Try two LEDs in series with a resistor, two separate LED branches in parallel, a switch in series with an LED, and a reversed LED. Predict branch current before revealing the readings.

For fuller device models, continue in a dedicated SPICE simulator and compare actual datasheets. See [Safety](SAFETY.md), the [Wiring Lab manual](WIRING-LAB.md), and the [lesson book](LESSONBOOK.md).
