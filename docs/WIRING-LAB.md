# Φ Circuit Lab • Wiring Sandbox Field Manual

**Release:** v0.5 • **Price:** free • **Hardware:** none required

This lab lets you experiment with *arbitrary connections among resistors, ideal open/closed switches, and simplified polarized LEDs* and a single ideal DC supply. It solves the resistor network numerically based on the wires you draw. It does not simulate all electronics, and it is not a circuit-board CAD editor.

## Your first run

1. Open the app and choose **Wiring Lab**.
2. Start with the **Two resistors in series** preset.
3. Click a terminal circle, then another terminal. The wiring engine adds an ideal wire.
4. Click a resistor body to select it; change its resistance in the **Parts & power** panel.
5. Drag a resistor body to reposition it. Its connections follow.
6. Click a wire to select it, then press **Delete selected** to disconnect.
7. Use **Undo** to return to the previous connection, part edit, or movement.
8. Adjust the supply voltage and observe the calculated source current and individual resistor voltage/current/power.
9. Add a switch to the circuit or open the **Series switch challenge** preset. Select S1 and press **Toggle switch** to open and close the path.
10. Export a JSON copy of your design; import it later, subject to size and schema limits.

The app saves your wiring document in this browser's localStorage; changing devices or browsers does not sync it. Use JSON export for portable backups.

## Terminal and connection rules

- **V+** means the positive terminal of an ideal DC voltage supply.
- **GND** is the reference terminal (0 V).
- A resistor's left terminal is **a**; the right terminal is **b**.
- Wire connections treat their two endpoints as the **same electrical node** (ideal 0 Ω wire).
- Resistor current readings are **signed from a to b**. A negative value means flow in the opposite direction.
- If you connect a supply terminal directly to the other supply terminal through wires, the software flags an **ideal short**. It does *not* calculate an infinite current.

## Challenge A: complete the series loop

1. Choose **Blank wiring challenge** (two unconnected 1 kΩ resistors).
2. Connect V+ → R1:a.
3. Connect R1:b → R2:a.
4. Connect R2:b → GND.
5. Confirm the circuit status changes from **Open circuit** to **Connected circuit**.

At 9 V with two 1 kΩ resistors, the expected total resistance is **2,000 Ω**, source current is **4.5 mA**, and each resistor has **4.5 V** across it. Total resistor power should equal ideal source output power.

Now remove the wire between R1:b and R2:a. The source current should return to **0 mA**.

## Challenge B: build parallel branches

1. Choose **Two parallel branches** to study the starting connections.
2. Confirm that both resistor left terminals connect to V+, and both right terminals connect to GND.
3. The resistors are 1,000 Ω each, yielding **500 Ω** effective resistance.
4. At 9 V, each branch draws **9 mA**, for **18 mA** source current.
5. Delete one branch's GND wire and predict what happens to total current.

A dangling resistor branch does not draw steady-state current under this ideal model.

## Challenge C: loaded divider

1. Choose **Loaded voltage divider**.
2. R1 is 2 kΩ from V+ to a junction. R2 and R3 are each 1 kΩ between that junction and GND.
3. The two lower resistors form a 500 Ω parallel equivalent.
4. Combined with R1, total resistance is **2.5 kΩ**.
5. At 9 V, total current is **3.6 mA**, and the junction sits at **1.8 V** above GND.
6. Disconnect R3 from GND and watch the output change to **3 V** in the ideal model.

Think about what this means for sensors, pull-up/pull-down resistors, and circuit loading.

## Challenge D: deliberately trigger an electrical fault

1. Start with a blank challenge.
2. Connect V+ directly to GND.
3. Observe **Ideal source short detected**.
4. Delete the fault wire before proceeding.

This is an exercise about recognizing dangerous topology, **not** something you should reproduce on physical equipment. A real short can generate excessive current, heat and damage.

## What the solver actually computes

1. **Union of ideal-wire nodes:** endpoints linked by wires become the same electrical node.
2. **Fault check:** if V+ and GND collapse to the same node, report an ideal short.
3. **Resistor graph:** group electrically connected resistor networks.
4. **Boundary conditions:** impose V+ and GND voltages on the ideal source.
5. **Nodal analysis:** solve `Σ conductance × voltage difference = 0` at internal nodes with Gaussian elimination.
6. **Derived readings:** individual resistor voltage, signed current (Ohm's law), power, source current, and equivalent resistance when measurable.

An unconnected (floating) resistor network has no defined absolute DC potential. The app does not invent one. An unpowered one-terminal-connected branch has zero ideal steady-state current.

## Important limitations

This is a **DC resistor-only** solver. It does not model:

- LEDs and nonlinear semiconductors
- Capacitors and inductors or time-domain phenomena
- Actual wiring resistance, grounding impedance, fault current limits, or thermal dynamics
- Source internal resistance or regulation
- Component tolerance, heating, maximum ratings, or voltage breakdown
- PCB routing, layouts, trace widths, clearance, or electromagnetic compatibility

For real hardware, verify datasheets, low-voltage limits, wiring, resistor power ratings, and physical measurements. Never test a short across a real power source.

## Document format

A circuit is a JSON object with `version: 1`, a supply voltage, resistor parts, optional switches, and wires. Older designs that omit switches or LEDs still load.

```json
{
  "version": 1,
  "supplyV": 9,
  "parts": [
    {"id":"R1","ohms":1000,"x":330,"y":165},
    {"id":"R2","ohms":1000,"x":600,"y":165}
  ],
  "wires": [
    {"a":"V+","b":"R1:a"},
    {"a":"R1:b","b":"R2:a"},
    {"a":"R2:b","b":"GND"}
  ]
}
```

Import validation rejects unknown terminals, duplicate wires, nonfinite electrical values, malformed IDs, and oversized designs. Only safe, defined fields are retained.

## What comes next

A true schematic editor would add a richer component palette (diodes, sensors), multi-step simulation, connection validation, symbol libraries, and eventually KiCad-friendly exports. The v0.5 sandbox includes a piecewise-linear LED model and overcurrent warnings. For its assumptions, see [LED Wiring Studio](LEDS.md).

## Experiment E: a switched series circuit

See the [switch lesson](SWITCHES.md). Open the switch preset, select S1, and toggle it. The open state should yield zero source current; the closed state should yield 9 mA through the 1 kΩ resistor at 9 V.

## Experiment F: an LED with correct polarity

Open **Red LED + 330 Ω**. At 5 V the classroom piecewise-linear model gives about 8.571 mA. Change the LED color, reverse its wiring, and compare with the no-resistor caution preset. See the [complete LED lesson](LEDS.md) for model differences and safety.
