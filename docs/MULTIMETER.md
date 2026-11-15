# Φ Circuit Lab • Virtual Multimeter & Fault-Finding Workbook

**Release:** v0.6 • **Cost:** $0 • **Required hardware:** none

The Wiring Lab now has a virtual measuring instrument. It is designed to answer not only “does my circuit work?” but **“where does the expected behavior stop?”**

## Three measurement types (and one wiring tool)

Select a tool in **Wiring Lab → Virtual Multimeter**.

| Tool | What you click | What it displays | Crucial limitation |
| --- | --- | --- | --- |
| **Wire / edit** | Two component terminals | Adds an ideal wire | This is for editing, not measuring |
| **DC voltage** | Red probe terminal, then black terminal | Signed voltage difference (V) | Ideal infinite-input-impedance reading; no loading |
| **Wire continuity** | Red probe terminal, then black terminal | CONNECTED or OPEN | Only ideal wires and closed switches count; **not a full ohmmeter** |
| **Branch current** | A resistor or LED body | Signed component current (mA) | Solver inspection; **not** a physical series ammeter |

The meter remembers its selected probe terminals while you adjust components, supply voltage, or switches, so you can see how your measurement changes. Switching modes clears those selections. Press Escape or use **Clear probes** to begin again.

**Polarity matters:** a DC voltage reading equals **red voltage minus black voltage**. Swapping probes changes the sign.

### What does “floating” mean?

A component isolated from both source terminals has no defined absolute DC voltage. The meter shows **—** and explains that the reading is floating, rather than guessing 0 V.

### What happens during a short?

When ideal wires or a closed switch directly join **V+** and **GND**, the solver flags a short and refuses to invent voltage and current measurements. Use the wiring editor to remove the fault before measuring again.

## Mission 1: Verify the source

1. Choose **Two resistors in series**, supplied by the default **9 V** source.
2. Press **Probe supply V+ / GND**.
3. Confirm the meter displays **9.000 V**.
4. Click the black probe at **V+** and the red probe at **GND** by selecting a fresh pair. Verify **−9.000 V**.
5. Return to red **V+**, black **GND**. Adjust the supply voltage and watch the reading change.

A virtual voltmeter can be placed *across* two nodes without interrupting the circuit.

## Mission 2: Find voltage drops in series

At **9 V** with **R1 = 1 kΩ** and **R2 = 1 kΩ**:

1. Set mode **DC voltage probes**.
2. Probe red **R1:a**, black **R1:b**. Predict **+4.5 V**.
3. Probe red **R2:a**, black **R2:b**. Predict **+4.5 V**.
4. Probe red **R1:b**, black **R2:a**. Predict **0 V**, because a wire joins these terminals.
5. Add the resistor drops. Verify **4.5 + 4.5 = 9 V**.

This is a beginner introduction to Kirchhoff's voltage law. Later, try unequal resistors.

## Mission 3: Troubleshoot an open switch

1. Load **Series switch challenge**. S1 starts open.
2. Probe red **S1:a**, black **S1:b**. With the 9 V source and 1 kΩ R1, expect about **9 V across the open switch** in this ideal model.
3. Select S1 and press **Toggle switch**. Probe the same terminals again. Now expect **0 V**.
4. Select **Wire continuity (power off)** and probe **S1:a** to **S1:b**. When S1 is closed, the tracer displays **CONNECTED**; when open, **OPEN**.
5. Switch to **Branch current** and click **R1**. With S1 closed, expect **+9.000 mA**. With S1 open, expect **0.000 mA**.

In physical work, **never use a continuity/ohms meter on an energized circuit**. The software's continuity tracer conceptually ignores supply energy, but that is **not** a guarantee that a physical measurement is safe.

## Mission 4: Test the LED

1. Load **Red LED + 330 Ω** with its **5 V** source.
2. Choose **DC voltage probes**, red **D1:a** (anode), black **D1:b** (cathode).
3. In the v0.5+ piecewise-linear teaching model, expect about **+2.171 V** across the diode.
4. Choose **Branch current**, click **D1**, and expect about **+8.571 mA**.
5. Switch to **Reversed LED + 330 Ω**. The diode branch current should become **0.000 mA**, while its signed voltage becomes negative.

The model assumes a fixed forward threshold plus a 20 Ω artificial slope, **not** a real device's current-voltage curve or junction physics. Read the [LED study guide](LEDS.md).

## Mission 5: Trace a broken connection

1. Load **Blank wiring challenge** and connect V+ → R1:a, R1:b → R2:a, R2:b → GND.
2. Set **Wire continuity (power off)**.
3. Trace V+ → R1:a; it should be **CONNECTED**, because there is a direct wire.
4. Trace R1:a → R1:b; it should be **OPEN**. A resistor connects the terminals electrically, but it is not an ideal 0 Ω wire. This is **not** a claim that the resistor is defective!
5. Delete the wire from V+ to R1:a. Trace V+ → R1:a again. Now the result changes to **OPEN**.
6. Restore that wire and verify the connection again.

This isolates a missing *wire* without confusing it with component resistance.

## How the measurements are derived

**Voltage:** Both electrical solvers expose a terminal-indexed map that includes merged ideal-wire nodes, closed switches, source terminals, and component leads. The voltage probe computes \`Vred − Vblack\` from that map, without loading the model. If either node is floating or the entire circuit is unresolved, the reading is unavailable.

**Continuity:** A separate union-find graph groups ideal wires and closed switches. If both probes resolve to the same group, the tracer says **CONNECTED**. The graph deliberately does **not** traverse resistors, LEDs, or the source itself. This is only a direct conductor-tracing exercise.

**Current:** The inspector reports the signed \`a → b\` resistor/LED branch current already computed by the electrical solver. Ideal switch current is left unavailable because parallel ideal-wire paths do not yield a unique current allocation. A real ammeter normally must be inserted **in series**, unlike this non-invasive software readout.

## Model scope and physical safety

The virtual instrument does **not** reproduce actual multimeter input impedance, continuity-beeper thresholds, probe resistance, burden voltage, measurement ranges, calibration, protective fuses, or auto-ranging. It cannot replace real hardware testing or datasheet checks.

For physical experiments:

- Start with known low-voltage, current-limited sources and appropriate guidance.
- **Power off and discharge stored energy before using continuity or resistance modes.**
- Do not place a physical ammeter directly across a power source.
- Do not use DIY circuits, household outlets or unknown battery packs as a first measurement exercise.
- Verify correct measurement range, safe probe connections, meter ratings and component specifications.

See [Safety](SAFETY.md) and [Wiring Lab Field Manual](WIRING-LAB.md).

## Mystery mode

The [Mystery Circuit Diagnostics](MYSTERY.md) course uses the same measurement concepts with *hidden* starting wiring. Students have access to terminal labels and calculated values only until they have recorded enough evidence and committed a diagnosis. The simulated continuity tracer remains a power-off educational concept; a shorted source never returns invented numeric fault current.
