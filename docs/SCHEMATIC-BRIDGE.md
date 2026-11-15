# Φ Circuit Lab v1.2: Schematic-to-Breadboard Bridge

**Free • Offline-capable • Validated against the existing Wiring Lab DC solver**

The Bridge turns supported saved schematics into **verified, reproducible breadboard placement plans**, showing the exact holes, jumper connections, and read-only preview before asking whether to replace the currently saved Breadboard layout.

## Getting started

Open **Schematic Bridge** from the navigation, or select **Plan on Breadboard** inside Wiring Lab. The source selector accepts the current saved Wiring Lab circuit, the active Project Workstation's DC circuit, or educational examples (series, parallel, divider, LED, reverse LED, open switch, disconnected circuit). It does not attempt to convert the Workstation's independent RC oscilloscope experiment.

Choose a source and press **Generate verified placement**. Planning changes **no saved designs**. Switching sources discards the previous preview until you regenerate it.

The results page provides a component count, jumper count, total compared terminal-pair count, modeled DC source current, read-only breadboard diagram, numbered construction steps, and physics/safety notes.

## Placement algorithm: exact contact strips, no fake connections

1. Each two-terminal component is assigned its own numbered column (up to 12). The component's electrical a terminal occupies E# and b terminal occupies F#. This crosses the center trench, which separates the A–E and F–J strips.
2. Component types and values are preserved. A resistor retains its ohms, an ideal SPST switch retains its open/closed state, and a diode retains its color and anode/cathode orientation.
3. The source jack V+ gets a deliberate jumper to P1, and GND gets a separate jumper to N1. The full-length P and N rails are independent. Unlike some commercial boards, this educational miniature board has **unsplit** rails.
4. The original zero-ohm wire connections define separate electrical nets. Each source-positive net terminal gets a jumper from its P-column contact to A# or J#. Each ground net terminal gets a jumper from N# to A# or J#. Non-rail nets become direct jumper trees between their component terminal strips.
5. **Resistors and LEDs are never treated as direct wires.** A closed switch stays a component whose conduction can change. The generated layout uses the same validated low-voltage DC model as the original schematic.
6. The resulting breadboard layout passes schema/occupancy/connection checks before the verification step.

This algorithm is deterministic and easy to inspect, but **does not optimize wire length or crossings**. The generated drawing is a virtual build guide, not a manufacturing layout.

## Verified really means equivalent

The bridge checks that source and generated circuits share the exact same component IDs and values/states, original supply voltage, and terminal name set.

Then it compares every **pair** of original named terminals for the same direct zero-ohm connectivity. For N two-terminal components, it checks (2+2N)(1+2N)/2 pairs. A two-resistor example checks **15 pairs**. Two wrong circuits can draw the same source current; this deeper check prevents current-only false equivalence.

The bridge also simulates both versions with the existing Wiring Lab model and compares the circuit status, equivalent resistance, source current, individual component state/current/voltage/power, and resolved terminal voltages. Mismatch means **no verified plan**, not a partial layout.

**Equivalent does not mean functioning or physically safe.** A schematic with an open switch remains open on the breadboard, and a reversed LED stays reversed. The bridge **refuses ideal source shorts**, including a short formed by a closed switch, rather than presenting an unsafe build plan.

## Work through the examples

### Two resistors in series

Select **Demo: Two resistors in series**, then generate a plan. The original example uses a 9 V source and two 1 kΩ resistors.

Place R1 across **E1–F1** and R2 across **E2–F2**. Then add the following five jumpers:

- V+ → P1
- GND → N1
- P1 → A1
- J1 → A2
- N2 → J2

The modeled circuit draws **4.500 mA**. The last three jumpers carry source positive, the intermediate series net and ground return to the correct strips.

### Parallel resistors

Select **Demo: Two parallel resistors**. Both top terminals share the P rail through separate jumpers; both bottom terminals return to N. The branches retain their own resistances, and source current equals the sum of the two branch currents.

### LED polarity

Select **Demo: Reverse-biased LED diagnosis**. The plan retains the original reverse-biased electrical state; it does not silently flip the diode to get a glowing indicator. In the editable Breadboard, experiment with flipping the LED to investigate.

### Open switches and disconnected nets

Select **Demo: Open SPST switch** or **Demo: Disconnected resistor circuit**. The bridge preserves open or floating states and reports them as expected results, rather than pretending there is a complete current path.

## Unsupported and refused scenarios

A schematic containing **13 two-terminal parts** exceeds this miniature board's 12 trench columns. The planner explicitly refuses it rather than dropping components.

An **ideal source short** is refused even when its direct source-ground path passes through a closed switch. The schematic must be repaired before creating a construction guide.

Component/library limits remain 8 resistors, 4 switches, 3 LEDs, and 40 jumpers, in addition to the bridge's 12-total component limit. General integrated circuits, transistors, inductors, capacitors, oscilloscopes, high-energy supplies, PCB manufacturing and SPICE netlists are **not** supported by the bridge.

## Safely load the board

Once you inspect a verified preview, choose **Load this layout into Breadboard**. A confirmation explains that this action will replace the existing **Breadboard** local save, while preserving the source Wiring Lab circuit and Project Workstation data.

- **Cancel** changes nothing.
- **Confirm** recomputes the plan and checks equivalence again, then stores the verified layout using the existing Breadboard save key and opens the interactive editor.

Export a backup of an older breadboard design before replacing it.

No cloud service, account, payment or proprietary dependency is needed.

## Physical safety and engineering boundaries

This bridge verifies **ideal simulated DC electrical topology**, not a real commercial breadboard's contact integrity, rail continuity, power rating, inductance or thermal performance. Physical breadboards may have split rails and different footprints. All modelled shorts and unsafe diode examples must remain simulated. Never build this demonstration with mains power, unprotected batteries or unknown high-energy supplies.

Refer to [Breadboard](BREADBOARD.md), [Wiring Lab](WIRING-LAB.md), [Project Workstation](WORKSTATION.md), and [Safety](SAFETY.md).
