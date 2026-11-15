# Φ Circuit Lab • Virtual Electronics Workstation

**v1.0 • Free • No physical components, payments, accounts, telemetry or backend**

The **Project Workstation** brings together the existing Wiring Lab and RC Oscilloscope as separate, scientifically honest experiments under one **named, offline project**, with a notebook that can save measurements from both.

This release is a project workflow and learning environment, **not a claim that the arbitrary DC circuit solver and the specialized RC transient model have become one SPICE engine**.

## Start a project

1. Open **Project Workstation** in the top navigation or from the Home page.
2. The first visit creates **My Electronics Bench** with a default two-resistor series circuit, an independent step-driven RC scope, and an empty notebook.
3. Choose **Circuit designer** to wire resistors, switches and LEDs, measure with virtual meter probes, or import/export the *circuit's* JSON using the existing Wiring Lab controls.
4. Choose **RC oscilloscope** to examine an independent time-domain signal, set pulse or square-wave parameters and move its two scope cursors.
5. Choose **Lab notebook** for hypotheses, results, explanations, or captured instrument readings.
6. Choose **Project overview** for a quick summary and links to the original lessons, Fundamentals Workbench, Challenge Academy and Mystery Diagnostics.

The circuit and RC experiment share **project context and notebook evidence**, not one electrical topology.

## Capture actual readings

### From the virtual multimeter

In the project **Circuit designer** tab, switch the built-in multimeter into DC volts, continuity, or branch current.

Choose valid probes, or select a resistor/LED for current. When a real simulated reading appears, **Capture meter reading** becomes available. Press it to save the mode, probes, result, source voltage and its explanation as a typed notebook entry.

An unavailable or undefined reading cannot be captured as a valid result. Floating voltage does not silently become 0 V, and a source short does not create a fictional numerical current.

### From the RC oscilloscope

In **RC oscilloscope**, adjust circuit values and move cursors A and B. Select **Capture scope cursors** to record the actual waveform type, RC time constant, capacitor voltages at both cursors, time difference, voltage difference and modeled current at A.

Scope settings remain with **that project**. The normal independent Oscilloscope app keeps its own separate settings.

### Manual observations

Enter up to **500 characters per note** and press **Save observation**. Up to **60 notes per project** are supported. A notebook entry is saved with a source label: MANUAL, METER or SCOPE. Remove an unwanted entry with its **Remove** button.

Notes are plain text only. Imported text is displayed as escaped text, never executed as HTML.

## Project portfolio

You can maintain up to **12 independent projects** within the Workstation.

- **New project:** creates a new default circuit, fresh RC experiment and empty notebook, without modifying any existing project.
- **Rename:** updates only the active project's display name.
- **Duplicate:** makes a complete separate copy of the selected circuit, scope settings and notebook, with a new project ID.
- **Switch:** changes the active project and its loaded circuit, scope and notes together.
- **Delete:** after a confirmation, deletes only the selected Workstation project. At least one project must remain.

Project IDs are stable and never reused when projects are deleted. No changes are made to the user's original free-build Wiring Lab, independent oscilloscope, course quiz progress, Challenge Academy scores, or Mystery Diagnostics runs.

## Backups, offline portability and data privacy

Press **Export projects JSON** to download the whole validated Workstation portfolio, including all named projects, circuits, scope configurations and notebook text.

Press **Import projects JSON** to validate a versioned JSON bundle, then explicitly confirm whether it should **replace the Workstation portfolio**. Invalid formats, unknown IDs, duplicate IDs, missing active projects, out-of-range component values, malformed notes or oversized files are rejected. Import does not run code, and it **never touches other labs' local saves**.

The Workstation browser storage key is:

\`\`\`text
phi-circuit-lab-workstation-v1
\`\`\`

The saved bundle uses **version 1**. The project limit is 12; notes are capped at 60 entries and 500 characters each. The import file limit is **750 KB**.

Your work is local to the browser profile. Clearing browser data can erase it. **Export a JSON backup before clearing storage, switching computers or reinstalling a browser.** A JSON backup is portable across supported browsers with this application.

For truly offline use, serve the repository's static files from an offline-compatible local HTTP server (or a locally cached static hosting setup). The project manager itself requires no external APIs. Online fonts may not load while disconnected, but the application uses fallback fonts.

## Educational limits

The integrated **Circuit designer** is still a bounded idealized DC resistive/switch/LED solver. The integrated **RC oscilloscope** is still one analytic first-order R-C network with independent step, pulse and square-wave sources. Project grouping does not turn them into one transferable schematic or live hardware bench.

Neither model contains physical meter input loading, calibrated measurement ranges, realistic junction curves, capacitor parasitics, grounding protection or electrical safety certification. In real hardware, never connect an ammeter across a source or use continuity mode on an energized circuit. Real oscilloscopes may be earth-referenced and can short equipment if clipped incorrectly.

See [Wiring Lab](WIRING-LAB.md), [Virtual Multimeter](MULTIMETER.md), [Oscilloscope and RC experiments](OSCILLOSCOPE.md), [Safety](SAFETY.md), [Challenge Academy](ACADEMY.md), and [Mystery Diagnostics](MYSTERY.md).

## v1.0 acceptance checklist

- Create two named projects. Change one circuit to the LED preset and leave the other project unchanged.
- Change one project's RC waveform to square and its resistor to 2 kΩ; the other project remains on the original default.
- Capture a 9 V supply measurement with the virtual multimeter and a time-constant cursor measurement from the RC scope.
- Verify both entries are visible in the correct project's notebook.
- Duplicate a project; edit the duplicate and verify the original is unchanged.
- Export and import a valid portfolio; malformed or oversized imports must be rejected without deleting existing project data.
- Navigate away and return. The selected project's validated circuit, scope and notes should be restored.
- Verify existing Wiring Lab, Challenge Academy, Mystery Diagnostics and independent Oscilloscope saves remain unchanged.

No cloud accounts, subscriptions, advertisements, proprietary hardware or paid learning materials are necessary.
