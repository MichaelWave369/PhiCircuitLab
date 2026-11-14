# Φ Circuit Lab

**Learn it. Simulate it. Design it. Build it.**

A free, open-source virtual electronics academy from PHI369 Labs. Begin with no physical components, no paid subscriptions, and no account.

## What works in v0.5

- **Nine guided modules** covering electricity, components, digital logic, embedded systems, communication, PCB design, and a Node-01 capstone.
- **Six interactive learning benches**: Ohm's law, LEDs, series/parallel networks, voltage dividers (including loads), RC timing, and six Boolean logic gates.
- **Wiring Sandbox**: drag and arrange up to eight resistors, four ideal switches and three direction-sensitive LEDs, click to connect terminals, and inspect calculated voltage/current/power. Includes shorts, floating parts, reverse LEDs and missing current-limiting warnings.
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

## Wiring Sandbox

Open **Wiring Lab** in the top navigation. Start with a series, parallel, loaded-divider, series-switch, LED, reverse-LED or blank circuit. Connect terminals by clicking them in pairs, drag resistors, inspect results, and experiment with open circuits and ideal shorts. All calculation runs locally.

See [the field manual](docs/WIRING-LAB.md) for four challenges and the model's limits. The engine performs ideal-resistor DC nodal analysis, **not full SPICE**. It models ideal open/closed switches and a simplified piecewise-linear LED with fixed forward voltage and a teaching-only 20 Ω slope. It does not simulate physical diode I–V curves, temperature, reactive parts, PCB layouts or real power-source fault behavior.

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
