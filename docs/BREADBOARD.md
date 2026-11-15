# Φ Circuit Lab • Virtual Breadboard and Component Library

**v1.1 • 12-column solderless training board • Free • Browser only**

This release adds an interactive solderless breadboard with **real copper-contact connectivity**, real modeled component branches, and an explicit path to the standalone Wiring Lab. It is not just a drawing on a plastic rectangle.

## Where to find it

Choose **Breadboard** in the top navigation or **Build on Breadboard** on the home page. The default experiment is a red LED in series with a 330 Ω resistor on a 5 V source.

The breadboard is independent of the Project Workstation and saves under:

\`\`\`text
phi-circuit-lab-breadboard-v1
\`\`\`

It never overwrites the Workstation, free Wiring Lab, Challenge Academy, Mystery Diagnostics or oscilloscope settings merely by opening or editing the board.

## Copper strips and rails: what connects?

This is an **educational miniature breadboard** with 12 columns.

- Rows **A–E** within one numbered column share an internal metal spring strip. For example, A3, B3, C3, D3 and E3 are one ideal conductor.
- Rows **F–J** within the *same* column share a **different** internal strip. F3 and J3 connect directly.
- The horizontal **center trench** isolates E3 from F3. A resistor, closed switch or LED across the trench forms an actual component branch, **not an ideal wire**.
- All **P1–P12** contacts share one long positive-labeled *rail*. All **N1–N12** contacts share a separate negative-labeled rail.
- **P and N are never implicitly tied to V+ and GND.** Their labels are only conventions. The board is unpowered until you connect the source's left-side **V+ / GND jacks** with deliberate jumper wires.
- Rails are **continuous** across the whole miniature board. Many physical breadboards have *split* rails. Always inspect or verify actual hardware before relying on this model.

Unrelated numbered columns are electrically independent unless your jumpers or closed switches join them.

## The component library

The library uses components already covered by the validated ideal DC solver.

| Component | Default | Behavior |
| --- | --- | --- |
| Jumper | Ideal 0 Ω conductor | Connects any two holes, or a power-source jack and hole |
| Resistor | 1000 Ω, editable | Ohm's law; valid values 1 Ω–10 MΩ |
| SPST switch | Open | Two-terminal ideal switch, toggled open/closed |
| Polarized LED | Red | Anode (a), cathode (b), simplified red/green/blue current model |

The current version supports at most **8 resistors, 4 switches, 3 LEDs and 40 jumpers**. Each component lead occupies one hole, and two different component leads cannot occupy that exact same hole. Jumpers can still share holes with placed component leads, as on physical solderless strips.

To place a part, choose its tool and click **two distinct contact holes**. For an LED, the **first hole is the anode (+)** and the second hole is the cathode (−). Then choose the Select tool and click the component body to edit the value, choose the LED color, flip LED polarity or toggle a switch.

Use the jumper tool to connect two holes or to wire source jacks V+ and GND to your chosen rails. Click a jumper curve to select and remove it. The **Undo** button restores the previous validated board state.

## Four reproducible exercises

### Exercise 1: a powered resistor

Choose **Single resistor**. The saved starter board has a 1000 Ω resistor between E3 and F3, with the source at 9 V.

The source is wired to P/N rails. A jumper connects P3 to A3, and another connects J3 to N3. The current is:

\`\`\`text
I = 9 V / 1000 Ω = 9.000 mA
\`\`\`

Use the continuity tool to test A3 → E3 (CONNECTED). Test E3 → F3 (OPEN in *direct copper continuity* mode, because the resistor is not a short). Use voltage mode across A3 → J3 to read +9 V, then swap the probes to read −9 V.

### Exercise 2: LED polarity and current limiting

Choose **LED + limiting resistor**. The 5 V source supplies a 330 Ω resistor and a red LED in series across two separate center-trench columns. Both components carry the same calculated current. The educational LED model predicts approximately 8–9 mA, depending on its assumed forward-voltage and slope.

Click D1 in Select mode and choose **Flip LED polarity**. The model now predicts no forward LED current. Flip it again to restore conduction.

Do **not** wire a bare physical LED directly across a real source. The simplified model cannot establish real-world thermal or device safety.

### Exercise 3: switch interruption

Choose **Switch + resistor**. S1 initially rests open, so modeled source current is zero and the resistor is inactive.

Click S1 and choose **Close switch**. Current passes through the series resistor and reaches 9 mA for a 9 V source and 1 kΩ load. Probe E3 → F3 in copper continuity mode to see the switch's direct contact state change.

### Exercise 4: discover an actual short circuit

Choose **Single resistor**, then add a direct jumper between P6 and N6.

The underlying solver reports an **ideal source short**, and refuses to invent a numerical fault current. Remove the shorting jumper and verify the resistor-limited circuit returns to normal.

This is a virtual-only learning exercise. **Never recreate a deliberate supply short on physical equipment.**

## Live contact voltmeter and continuity tracer

The board includes a non-invasive virtual meter with two-click probing:

**DC volts:** Click the red probe location then the black probe. The meter reports V(red) − V(black) when both points' voltages can be resolved by the DC solver. Unconnected, floating or ideal-shorted nodes display unavailable readings rather than a fabricated zero.

**Copper continuity:** Click any two holes or supply jacks. The tool follows **internal strips, rails, jumpers and closed ideal switches**. It does not incorrectly claim that resistors, LEDs or open switches are zero-ohm conductors. This is a conceptual teaching tracer: real continuity measurements must be made on *de-energized and discharged* circuits.

**Select/inspect:** Click a hole to highlight every directly connected contact in its current copper/jumper net and read a resolved model voltage if available. This helps reveal hidden internal strips. The count includes physical contacts, not traversals through resistor/LED branches.

## Save, import and export

**Export breadboard JSON** downloads a complete versioned document containing source voltage, resistor/switch/LED placement, jumper endpoints and component properties. **Import breadboard JSON** checks the complete bounded schema before asking for confirmation to replace the current breadboard. Imports over 50 KB are rejected.

The board autosaves in the current browser profile. Clear browser storage only after exporting a backup.

### Transfer to the full Wiring Lab

Click **Send to Wiring Lab** to explicitly convert your connected copper topology into the equivalent validated DC Wiring Lab schematic. The operation is **one-way** and prompts for permission to replace your *existing free-build Wiring Lab save*. Declining leaves the save unchanged. Confirming opens the Wiring Lab on the electrically equivalent circuit.

The generated schematic represents electrical connectivity, not identical physical spacing. It is constrained to the electrical model already supported: resistors, switches, LEDs, ideal wires and a DC source. It is **not a PCB layout export**, **not a real Gerber**, and **not a general SPICE netlist**.

## Physical electrical limitations

The board does not model contact bounce, spring resistance, loose wires, rail splits, capacitance, inductance, true device nonlinearities, thermal behavior, real supply output impedance or breadboard current/voltage ratings. It is a small DC teaching board, not a hardware safety verifier.

Never experiment with mains voltage or unknown batteries on a solderless breadboard. Use appropriately limited low-voltage sources and confirm real component ratings and contact layouts before any physical construction.

See [Wiring Lab](WIRING-LAB.md), [Virtual Multimeter](MULTIMETER.md), [Safety](SAFETY.md), and [v1.0 Project Workstation](WORKSTATION.md).

## Follow-on milestone

The next logical step is a **schematic-to-breadboard teaching bridge**, with explicit mapping of a safe, supported circuit to physical hole placements. This must have a verified placement/routing algorithm and should not guess that all circuits can be mapped onto a miniature training board.
