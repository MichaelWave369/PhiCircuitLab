# Φ Circuit Lab • Virtual Oscilloscope and RC Signal Laboratory

**Release:** v0.9 • **Requires:** browser only • **Cost:** free

The Scope Laboratory teaches one of the most important distinctions in electronics: **DC operating points describe a moment; capacitors store energy and make circuits change over time**.

This release adds an **analytically solved first-order time-domain RC circuit**. It is a new, specialized instrument station. It does *not* quietly pretend that the resistive Wiring Lab understands general capacitors, inductors, oscilloscopes or SPICE.

## Launch

Select **Oscilloscope** in the top navigation or **Open Oscilloscope** on the home page.

The virtual circuit is an ideal voltage source → resistor R → capacitor C → reference/ground.

- The **source** jumps between constant levels for a step, pulse or square wave.
- The **capacitor** has an initial voltage and cannot instantaneously jump at the edge of an ideal finite-resistor circuit.
- The **resistor voltage** is source minus capacitor voltage.
- **Resistor current** obeys I = (Vsource − Vcapacitor)/R.
- The stored capacitor energy is E = ½CV².

An ideal RC source change creates an immediate change in resistor current, but the capacitor voltage changes continuously. The oscilloscope draws actual vertical edges for input and resistor voltage rather than visually smearing a mathematical discontinuity.

## Learn the mathematics

The capacitor's equation is:

\`\`\`
C * dVc/dt = (Vin - Vc)/R
tau = R * C
Vc(t+dt) = Vin + (Vc(t)-Vin)*exp(-dt/tau)
\`\`\`

This last equation applies whenever Vin is constant over a segment of time. The software integrates **exactly to each source-transition timestamp**, then carries the capacitor voltage continuously into the next segment. There is no arbitrary Euler-step approximation determining the circuit's physics.

For a step from 0 to V with an initially discharged capacitor:

\`\`\`
Vc(t) = V*(1-exp(-t/tau))
I(t) = (V/R)*exp(-t/tau)
\`\`\`

At t=τ, Vc is ~63.2% of V. The textbook 10–90% rise time for an *isolated* step is ln(9)×τ ≈ 2.197τ.

For discharge into 0 V from V0:

\`\`\`
Vc(t) = V0*exp(-t/tau)
I(t) = -(V0/R)*exp(-t/tau)
\`\`\`

A periodic square wave repeatedly charges and discharges the capacitor. The charge level may never reach the source voltage before the next transition.

## Four guided experiments

### 1. Charge an RC circuit

Choose **RC charging step**, R=1000 Ω, C=100 µF, V=5 V, initial capacitor voltage 0 V. Here τ = 0.100 seconds. Move cursor A to 12.5% of an 8τ scope window (0.1 seconds).

Check that capacitor voltage is ~3.161 V (5×(1−e⁻¹)). Resistor voltage is ~1.839 V, and resistor current is ~1.839 mA. Watch the capacitor approach 5 V as the time increases.

### 2. Discharge an initially charged capacitor

Choose **Initial capacitor discharge**. The source becomes 0 V while the capacitor starts at 5 V. At t=0 the resistor has −5 V across it and current is −5 mA for R=1 kΩ. This *negative* current direction represents discharge, not a failure of the solver.

At one time constant the capacitor is about 36.8% of the initial 5 V, approximately 1.839 V.

### 3. Apply a single voltage pulse

Choose **Single square pulse**. With the default 2τ pulse width, the capacitor charges toward 5 V, then the source returns to 0 V. At the falling edge, the capacitor **does not instantly reset to zero**; it begins an exponential discharge from its accumulated charge.

Use the two cursor controls to place A before and B after the edge. Compare source, capacitor and resistor voltage. The screen exposes the change in sign of resistor voltage.

### 4. Drive the RC with a periodic square wave

Choose **Periodic square wave**. Adjust **Square period (×τ)** and **Duty cycle (%)**.

A period much larger than τ allows charge/discharge closer to equilibrium. A much shorter period smooths the waveform. The source edges remain sharp in the ideal model, while the capacitor voltage rounds them.

Change R or C and notice how the physical time constant changes, even when the time axis is defined in multiples of τ. See the difference between the source's waveform and the capacitor's response.

## Oscilloscope controls

The source selection includes **DC step**, **single pulse**, and **periodic square wave**.

Controls: source amplitude (0–12 V), resistor (100 Ω–1 MΩ), capacitor (1–1000 µF), initial capacitor voltage (0–12 V), visible time window (2–24τ), pulse width (0.25–12τ), square period (1–12τ), and duty cycle (10–90%).

The screen shows Source V, Capacitor V, and optionally Resistor V as three differently colored traces. The chart is sampled at 501 evenly spaced screen positions; **source transitions are integrated at exact times regardless of screen sample spacing**, and displayed with vertical edges.

The A and B cursor sliders are independent. Their values are evaluated from the analytic model at exact selected times rather than interpolated visually. Read the signed ΔV (capacitor B minus A), elapsed Δt, resistor current and stored capacitor energy.

**Export CSV** saves 501 rows of numeric samples as a local file with seconds, source volts, capacitor volts, resistor volts, amperes and joules. No server receives the data.

Scope settings are saved to this browser using their own key, \`phi-circuit-lab-scope-v1\`. Your Wiring Lab, Challenge Academy, Mystery Diagnostics and classroom progress are not modified by the scope.

## Questions for the learner

- Why does the capacitor voltage begin at its initial voltage instead of jumping to the source level?
- What happens to current direction immediately after a falling pulse edge?
- If R doubles and C stays fixed, how does τ change?
- Why does a short square-wave period fail to let the capacitor fully charge?
- Why can two traces cross while the source is switching but capacitor voltage remains continuous?
- Which traces would an external probe load in a non-ideal real circuit?

## Scope and safety

This is **not a virtual physical oscilloscope**, not a SPICE engine and not a general capacitor branch in Wiring Lab. It models exactly one series ideal resistor, one ideal capacitor, and a piecewise-constant ideal source. There is no source impedance, capacitor ESR, leakage, inductance, temperature dependence, ripple noise, ADC quantization, real trigger jitter, probe capacitance, mains isolation, or real electrical safety certification.

The 10–90% theoretical rise-time label applies to an isolated step, not automatically to a short pulse or a periodic waveform. Sampling limitations can affect the displayed density of very narrow features even though source edges are integrated exactly.

For physical work, use appropriate low-voltage current-limited power supplies, qualified tools, protective equipment and device datasheets. **Never probe household mains or high-energy circuitry as a beginner oscilloscope exercise.** Real oscilloscopes may have earth-referenced grounds that can create a hazardous short when connected incorrectly.

See [Safety](SAFETY.md), [RC Lesson Book](LESSONBOOK.md) and the existing [Multimeter Workbook](MULTIMETER.md).
