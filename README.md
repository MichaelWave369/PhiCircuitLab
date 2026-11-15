# Φ Circuit Lab

**Learn it. Simulate it. Design it. Build it.**

A free, open-source virtual electronics academy from PHI369 Labs. Begin with no physical components, no paid subscriptions, and no account.

## What works in v1.0

- **Virtual Electronics Workstation**: twelve named offline projects, each with its own DC circuit, independent RC oscilloscope settings and measurement notebook, plus import/export of versioned JSON backups.
- **Nine guided modules** covering electricity, components, digital logic, embedded systems, communication, PCB design, and a Node-01 capstone.
- **Six interactive learning benches**: Ohm's law, LEDs, series/parallel networks, voltage dividers (including loads), RC timing, and six Boolean logic gates.
- **Wiring Sandbox**: drag and arrange up to eight resistors, four ideal switches and three direction-sensitive LEDs, click to connect terminals, and inspect calculated voltage/current/power. Includes shorts, floating parts, reverse LEDs and missing current-limiting warnings.
- **Virtual multimeter and troubleshooting**: non-invasive DC voltage probes, ideal-wire continuity tracer, signed resistor/LED current inspection, and five fault-finding missions.
- **Circuit Challenge Academy**: nine seeded hands-on fault missions with predicted diagnoses, verified repairs, replayable seeds, local scores, and a dedicated save separate from the free Wiring Lab.
- **Mystery Circuit Diagnostics**: eight sealed black-box service calls where students measure hidden circuits, record evidence, commit a diagnosis and then repair the revealed circuit in an independent workspace.
- **Virtual Oscilloscope & RC Signal Lab**: real analytic time-domain charging/discharging with step, pulse and periodic square inputs, colored traces, dual measurement cursors and local CSV export.
- **Short knowledge checks**: pass each two-question quiz to mark a module complete.
- **Local progress tracking and a saved wiring design** with browser localStorage; no sign-in, tracking, or backend.
- **JSON import/export for wiring designs**, with schema and bounds validation. No cloud required.
- **Free textbook and safety notes** in the docs folder.
- **Responsive static website**, suitable for GitHub Pages or local hosting.
- **Dependency-free calculation tests** with Node.js.

> The benches intentionally use simplified mathematical models. They do not replace SPICE, hardware measurements, component datasheets, or engineering review.

## Run locally

No install or build step is required for the website, but ES modules should be served over HTTP rather than opened with a `file://` URL.

```bash
git clone https://github.com/MichaelWave369/PhiCircuitLab.git
cd PhiCircuitLab
python -m http.server 8000
```

Open `http://localhost:8000/`.

To test the simulation math (Node.js 20+):

```bash
npm test
```

## Publish with GitHub Pages

Once the feature branch has been merged to `main`, open repository **Settings → Pages**, choose **Deploy from a branch**, then select `main` and `/(root)`. GitHub Pages will serve `index.html` as a static website.

## Curriculum

| Level | Subject | In-app experiment |
| --- | --- | --- |
| 01 | Electricity 101 | Ohm's Law Bench |
| 02 | Series & Parallel | Series & Parallel Bench; Voltage Divider exploration |
| 03 | LEDs & Resistors | LED Bench + Wiring Lab LED challenges |
| 04 | Components & Signals | RC charge/discharge timing |
| 05 | Digital Logic | Logic Gate Bench |
| 06 | Microcontrollers | External Wokwi exercise |
| 07 | Hardware Communication | Design exercise |
| 08 | PCB Design | KiCad learning exercise |
| 09 | Φ Hardware Architect | Node-01 capstone |

## Read the course

- [Complete lesson book](docs/LESSONBOOK.md)
- [Lab safety and model limitations](docs/SAFETY.md)
- [Node-01 virtual capstone brief](docs/NODE01.md)
- [Printable experiment worksheets](docs/WORKSHEETS.md)
- [Wiring Sandbox field manual](docs/WIRING-LAB.md)
- [Ideal switches: experiments and safety](docs/SWITCHES.md)
- [LED Wiring Studio: polarity, current limiting and model assumptions](docs/LEDS.md)
- [Virtual multimeter and fault-finding workbook](docs/MULTIMETER.md)
- [Circuit Challenge Academy: nine scored fault-finding missions](docs/ACADEMY.md)
- [Mystery Circuit Diagnostics: eight hidden-fault cases](docs/MYSTERY.md)
- [Virtual Oscilloscope: first-order RC time-domain laboratory](docs/OSCILLOSCOPE.md)
- [v1.0 Virtual Electronics Workstation: project portfolio and laboratory notebook](docs/WORKSTATION.md)

## Wiring Sandbox

Open **Wiring Lab** in the top navigation. Start with a series, parallel, loaded-divider, series-switch, LED, reverse-LED or blank circuit. Connect terminals by clicking them in pairs, drag resistors, inspect results, and experiment with open circuits and ideal shorts. All calculation runs locally.

Use the **Virtual Multimeter** directly below the wiring canvas to probe two terminals for voltage or wire connectivity, or select a resistor/LED to inspect branch current. This is ideal-model instrumentation, not physical hardware emulation; continuity traces only ideal wires and closed switches.

See [the field manual](docs/WIRING-LAB.md) for four challenges and the model's limits. The engine performs ideal-resistor DC nodal analysis, **not full SPICE**. It models ideal open/closed switches and a simplified piecewise-linear LED with fixed forward voltage and a teaching-only 20 Ω slope. It does not simulate physical diode I–V curves, temperature, reactive parts, PCB layouts or real power-source fault behavior.

## Circuit Challenge Academy

Open **Challenge Academy** in the navigation or choose **Play Challenge Academy** on Home. Diagnose a seeded fault, repair the circuit with the actual Wiring Lab tools, then submit a solver-verified repair for points. Nine missions cover wire breaks, switch faults, incomplete parallel branches, reversed LEDs, overcurrent, undervoltage, shorts and multiple failures. The Academy never overwrites free-builder circuits or lesson completion. See the [complete Academy workbook](docs/ACADEMY.md).

## Mystery Circuit Diagnostics

Open **Mystery Diagnostics** from navigation or the Home shortcut. Before you can see the circuit, use the virtual meter's labeled test points to collect at least two distinct readings. Lock your prediction to reveal the faulted wiring, then repair the actual circuit for a modeled grade. Eight seeded cases support reproducible classroom practice and save progress separately from both free-build and Challenge Academy. See the [Mystery Workbook](docs/MYSTERY.md).

## Virtual Oscilloscope and RC Signal Lab

Open **Oscilloscope** from the navigation or **Open Oscilloscope** on Home. Adjust an ideal resistor/capacitor, source amplitude and initial voltage; observe charging, discharging, voltage pulses and periodic square waves over time with dual measurement cursors. The physics uses exact first-order solutions across every source transition, not fake animation. Save 501 trace samples as a local CSV. This is a **specialized** RC station, not full SPICE nor capacitors inside the Wiring Lab topology solver. See the [scope workbook](docs/OSCILLOSCOPE.md).

## Virtual Electronics Workstation v1.0

Use **Project Workstation** in the top navigation to keep a DC wiring design, an independent RC scope experiment, and typed evidence together in one named project. Create or duplicate projects, capture actual virtual meter and scope readings into a private notebook, and export/import portable JSON backups. Project data never overwrites free-build designs or game progress. This is an integrated **workflow**, not a claim that both electrical models share one SPICE circuit. See the [Workstation manual](docs/WORKSTATION.md).

## Continue learning for free

- [CircuitJS / Falstad](https://falstad.com/circuit/) for larger circuit simulations.
- [Wokwi](https://wokwi.com/) for virtual microcontroller development. The hosted service has its own pricing and usage conditions; use public/free projects when applicable.
- [KiCad](https://www.kicad.org/) for free, open-source schematic and PCB design.

PhiCircuitLab does not depend on any external service to run its six built-in benches.

## Suggested development roadmap

1. Expand the LED Wiring Studio with prediction exercises and a circuit notebook.
2. Add printable worksheets and downloadable progress reports.
3. Implement a visual wiring editor using a proper circuit-solver backend.
4. Import/export SPICE-friendly circuit descriptions with clear simulator limitations.
5. Add PCB lessons, BOM planning, and schematic/footprint checking.
6. Consider PhiOS/Trellis integration after the standalone academy works well.

## License

MIT. See [LICENSE](LICENSE). Educational content and code are offered freely.

> **Important:** the two LED models differ intentionally. The standalone LED bench uses a fixed forward-voltage estimate; Wiring Lab adds a teaching-only 20 Ω diode slope. Neither is SPICE or a real part specification. [Details](docs/LEDS.md).
