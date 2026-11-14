# Φ Circuit Lab

**Learn it. Simulate it. Design it. Build it.**

A free, open-source virtual electronics academy from PHI369 Labs. Begin with no physical components, no paid subscriptions, and no account.

## What works in v0.1

- **Nine guided modules** covering electricity, components, digital logic, embedded systems, communication, PCB design, and a Node-01 capstone.
- **Three interactive learning benches**: Ohm's law, a resistor-and-LED model, and six Boolean logic gates.
- **Short knowledge checks**: pass each two-question quiz to mark a module complete.
- **Local progress tracking** with browser localStorage; no sign-in, tracking, or backend.
- **Free textbook and safety notes** in the docs folder.
- **Responsive static website**, suitable for GitHub Pages or local hosting.
- **Dependency-free calculation tests** with Node.js.

> The benches intentionally use simplified mathematical models. They do not replace SPICE, hardware measurements, component datasheets, or engineering review.

## Run locally

No install or build step is required for the website, but ES modules should be served over HTTP rather than opened with a \`file://\` URL.

\`\`\`bash
git clone https://github.com/MichaelWave369/PhiCircuitLab.git
cd PhiCircuitLab
python -m http.server 8000
\`\`\`

Open \`http://localhost:8000/\`.

To test the simulation math (Node.js 20+):

\`\`\`bash
npm test
\`\`\`

## Publish with GitHub Pages

Once the feature branch has been merged to \`main\`, open repository **Settings → Pages**, choose **Deploy from a branch**, then select \`main\` and \`/(root)\`. GitHub Pages will serve \`index.html\` as a static website.

## Curriculum

| Level | Subject | In-app experiment |
| --- | --- | --- |
| 01 | Electricity 101 | Ohm's Law Bench |
| 02 | Series & Parallel | Equivalent-resistance practice |
| 03 | LEDs & Resistors | LED Bench |
| 04 | Components & Signals | LED voltage exploration |
| 05 | Digital Logic | Logic Gate Bench |
| 06 | Microcontrollers | External Wokwi exercise |
| 07 | Hardware Communication | Design exercise |
| 08 | PCB Design | KiCad learning exercise |
| 09 | Φ Hardware Architect | Node-01 capstone |

## Read the course

- [Complete lesson book](docs/LESSONBOOK.md)
- [Lab safety and model limitations](docs/SAFETY.md)
- [Node-01 virtual capstone brief](docs/NODE01.md)

## Continue learning for free

- [CircuitJS / Falstad](https://falstad.com/circuit/) for larger circuit simulations.
- [Wokwi](https://wokwi.com/) for virtual microcontroller development. The hosted service has its own pricing and usage conditions; use public/free projects when applicable.
- [KiCad](https://www.kicad.org/) for free, open-source schematic and PCB design.

PhiCircuitLab does not depend on any of these services to run its three built-in benches.

## Suggested development roadmap

1. Expand interactive exercises (voltage divider, RC timing, series/parallel).
2. Add printable worksheets and downloadable progress reports.
3. Implement a visual wiring editor using a proper circuit-solver backend.
4. Import/export SPICE-friendly circuit descriptions with clear simulator limitations.
5. Add PCB lessons, BOM planning, and schematic/footprint checking.
6. Consider PhiOS/Trellis integration after the standalone academy works well.

## License

MIT. See [LICENSE](LICENSE). Educational content and code are offered freely.
