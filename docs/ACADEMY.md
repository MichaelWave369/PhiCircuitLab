# Φ Circuit Lab • Circuit Challenge Academy

**Release v0.7 • Nine repair missions • Free • Browser only • No hardware required**

Circuit Challenge Academy turns the Wiring Lab and its virtual multimeter into a structured troubleshooting game. You must **diagnose a fault, repair the real electrical connections or component parameters, and verify the solution**. The grading engine uses the same idealized DC solver as the free Wiring Lab.

## Start playing

1. Open the **Challenge Academy** navigation tab (or choose **Play Challenge Academy** on Home).
2. See your reproducible run seed and nine mission cards.
3. Read the symptom and **lock your predicted fault** before making changes. A correct prediction adds 25 points.
4. Repair the circuit in the embedded Wiring Lab. The multimeter, connection editor, switch toggle and LED polarity control work there, just as they do in free-build mode.
5. Select **Check my repair** to run the independent electrical grade. A correct fix earns 75 base points; every extra failed check costs five, up to a 25-point cap.
6. Request a hint if necessary for a ten-point deduction. The score cannot be negative and is not affected by how long you take.
7. Continue to the next mission or revisit any mission card. A completed mission cannot be scored twice in the same run.
8. For a fresh randomized variation, choose **New random run**. Enter a numeric seed to replay the exact same variant of all nine challenges.

A perfect nine-mission run earns **900 points**. The run is saved in this browser under its own Academy key, independent of free-builder circuit storage and course lesson completion.

## All nine missions

| Mission | Symptom | Repair skill | Fault diagnosis |
| --- | --- | --- | --- |
| 01 — The Missing Feed | Zero current in a resistor loop | Restore positive supply wire | Broken wire |
| 02 — A Silent Series Junction | Two resistors but no conducting path | Reconnect their shared junction | Broken wire |
| 03 — The Lonely Parallel Branch | A working supply but an inactive branch | Complete missing ground return | One parallel branch inactive |
| 04 — The Disconnected Contact | All wires present, no loop current | Toggle an open switch closed | Open switch |
| 05 — The Backwards Beacon | A resistor-limited LED does not conduct | Flip LED anode/cathode wiring | Reversed LED |
| 06 — A Too-Bright Idea | LED warning for excessive current | Increase series resistor value | Overcurrent |
| 07 — The Dim Blue Signal | Forward LED still remains off | Raise low source voltage appropriately | Below forward threshold |
| 08 — The Dangerous Shortcut | Ideal source short | Remove bypassing jumper | Direct short |
| 09 — Two Problems, One Circuit | Repairing the switch alone does not restore current | Fix both the switch and missing return | Two interruptions |

The numeric resistor values and, for some missions, supply conditions are varied with a **seeded pseudo-random generator**. The nine categories remain stable so the curriculum progresses from simple wire breaks to compound faults. A known seed makes classroom demonstrations and bug reports reproducible.

### Mission 05: Flip an LED's wiring

In the challenge circuit, click **D1** and choose **Flip LED polarity** in the component inspector. This swaps which external wire attaches to D1:a and D1:b, while preserving its location, color and part ID. It does not magically turn a reversed LED into a conducting LED: the circuit must still have a physically plausible modeled path with a current-limiting resistor.

### Mission 08: Fixing an ideal source short

The simulator deliberately refuses to compute an infinite fault current. Find the extra bypassing wire, select that wire, and choose **Delete selected**. Simply opening S1 will interrupt everything and **will not** satisfy this mission. The repaired circuit must still have a resistor-limited conductive path.

## How repairs are graded

Every candidate circuit is schema-validated and solved again. The grader checks, as appropriate:

- The correct electrical status, with no direct source short.
- Preservation of the original resistor, switch, and LED part IDs.
- Correct switch state, required supply level, and unchanged values except when the mission specifically teaches adjustment.
- Modeled source current and branch currents or voltage drops consistent with the healthy circuit.
- No bypassing or abandoning required resistors.
- Proper forward LED conduction where expected, with current inside the mission's **teaching ranges**, not claimed universal safe device ratings.
- No missing current-limiting path or simulator warning.

A disconnected circuit is not repaired merely because the UI draws a line. A direct short, bypass, or component deletion is not an acceptable solution.

## Scoring

A mission starts at **75 repair points**. The correct diagnosis earns another **25 prediction points**. Using a hint subtracts **10 points**. Each unsuccessful **Check my repair** subtracts **5 points**, up to **25 points** total. A correctly repaired mission always earns at least 40 points under these rules.

Hints and unsuccessful-check counts survive a reset. This prevents repeatedly resetting a mission to erase deductions. Once scored, a mission is locked against additional point farming for that run.

**No scores are uploaded or submitted to an external leaderboard.** The student is competing against their own progress.

## Save isolation and privacy

Academy and free-build are deliberately separate:

- Free Wiring Lab circuit: \`phi-circuit-lab-wiring-v1\`
- Challenge Academy run and circuit snapshots: \`phi-circuit-lab-academy-v1\`
- Lesson completion: its pre-existing independent key remains untouched.

The Academy mounts the exact Wiring Lab editor with an **in-memory challenge circuit**, disables its normal free-build persistence, and saves its own validated snapshots. Import/export and adding unrelated parts are hidden during Academy missions, while wire editing, meter tools, undo, switch toggles, resistor editing, supply adjustment, and LED polarity flipping remain available.

Progress persists only in the **same browser profile**. If local browser storage is disabled or cleared, run progress cannot be guaranteed. Run seeds reproduce generated missions, not completed scores.

## Scope and safety

These are **idealized low-voltage educational simulations**. The simulator still does not reproduce physical semiconductor curves, temperature, short-circuit energy, calibrated meter readings, component ratings, or electrical compliance testing.

**Do not reproduce intentionally shorted sources, overcurrent LEDs, or reverse-bias examples using real power supplies.** For real equipment, use appropriately limited low-voltage supplies and confirm voltage/current/power specifications from datasheets. Continuity mode in the virtual meter is a mathematical direct-wire tracer; real continuity/ohmmeter measurements require a de-energized and safely discharged circuit.

See the [Virtual Multimeter workbook](MULTIMETER.md), [LED lesson](LEDS.md), [Safety guide](SAFETY.md), and [Wiring Lab manual](WIRING-LAB.md).

## Future Academy expansions

Add more fault families only when the underlying electrical models exist and are tested. Potential follow-on skills include node voltage prediction, meter-assisted circuit diagnosis with a partially obscured fault, diode load lines, RC transient timing, and ultimately true schematic/PCB workflows.
