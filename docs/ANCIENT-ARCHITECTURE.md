# Ancient Architecture → Modern Circuit Lab

Open [Ancient Architecture Circuit Lab](../ancient-layouts.html) from the primary navigation, or serve the repo locally with `python -m http.server 8000` and open `http://localhost:8000/ancient-layouts.html`.

## Purpose

This is a **comparative design and electronics teaching experiment**, not a claim that any ancient structure was an electrical machine. We compare evidence-grounded architecture against a newly invented elementary LED circuit. The layout influences our **drawing**, not the predicted electrical behavior.

### Three references and their limits

| Reference | Grounding | Limitation |
| --- | --- | --- |
| Solomon's Temple | 1 Kings 6:2–3, 16–20: 60 × 20-cubit house; 10-cubit porch projection; 20 × 20-cubit inner sanctuary | Biblical description; diagram is a modern, selective reconstruction, not a recovered surveyed blueprint |
| Ezekiel's Temple | Ezekiel 40–48: 500 × 500-cubit complex in common readings; 100 × 100-cubit inner court | Visionary text; disputed dimensional interpretations; selected spaces are not at one uniform measured scale |
| Teotihuacan | INAH and the Met: Moon pyramid at northern avenue end; Sun pyramid east of avenue; Ciudadela toward south | Archaeological site, but diagram shows relationships only; no accurate aerial image, geodetic positions, or surveyed distances |

The shared social image that overlays a **motherboard** with a Teotihuacan-themed plan is not accepted here as a real archaeological photograph or an electrical blueprint. Thoth is an Egyptian deity, not an established builder of Teotihuacan.

## Hands-on test

1. In **Source plan** mode, observe the different evidence categories and read the linked references.
2. Change to **Invented PCB** mode. We choose five positions as an artistic guide: voltage source, switch, resistor, LED and ground/return terminal.
3. Our actual modeled circuit uses **four components**: `V1 (+) → SW1 → R1 → D1 → V1 (-)`. The ground marker is the source return, not another component.
4. With a 5.0 V source, 330 Ω resistor, ideal fixed 2.0 V LED drop and a closed switch:
   `I = (5 - 2) / 330 = 0.0090909 A ≈ 9.09 mA`.
5. Open the switch to get `0 mA`. Change the voltage or resistor and verify the result by calculation.
6. Change to a different architecture. **The electrical result stays the same** because the same electrical netlist is used on every plan.
7. Export an SVG illustration and a JSON *conceptual netlist* for further study.

### Boundary between artwork and real PCB fabrication

Exports are **not** KiCad PCB files, Gerbers, drill data, ground planes, or manufacturer-ready designs. Before making an actual board, a follow-on engineering task must assign real footprints and a board outline, place pads, route two-layer copper with legal trace widths and clearances, perform electrical and design-rule checks (ERC/DRC), and verify power/current limits. A fixed-drop LED teaching formula does not model the real diode IV curve, transients, thermal limits, substrate losses, or EM phenomena.

No conclusions about the ancient use of electrical power can be drawn from visual similarity. Architectural constraints and circuit constraints can both produce grids, axes, and branching geometries.

## Sources

- [1 Kings 6, Bible Gateway](https://www.biblegateway.com/passage/?search=1%20Kings%206&version=NIV)
- [Ezekiel 40–48, Bible Gateway](https://www.biblegateway.com/passage/?search=Ezekiel%2040-48&version=NIV)
- [Ezekiel structures and measurements, Peter Schmidt (2022)](https://ot-translation-aids.net/sites/www.ot-translation-aids.net/files/Ezekiel%27s%20Temple%20-%20Structures%20%26%20Measurements_0.pdf)
- [INAH: Avenue of the Dead, Teotihuacan](https://visitateotihuacan.inah.gob.mx/en/explore/avenue-of-the-dead/)
- [Metropolitan Museum of Art: Teotihuacan](https://www.metmuseum.org/essays/teotihuacan)
- [MIT Fab Academy student PCB project, Medinet Habu](https://fab.cba.mit.edu/classes/863.24/people/KareemHEl-Sisi/pcb.html)

## Automated checks

`npm test` runs the default Node test suite, including `tests/ancient-layouts.test.mjs`. Checks cover model sources, valid coordinates, an idealized LED current calculation, switch-open current, overcurrent messaging, input validation, and invariance of electrical results across all three sources.

## Next phase

- Optionally trace copyrighted/map data only with suitable licenses and attribution.
- Build **separate measured, georeferenced** Teotihuacan layers from published surveyed data, with confidence intervals and source records.
- Add a constrained KiCad PCB generator as a new, explicitly modern design layer.
- Run KiCad ERC/DRC and validate physical manufacturing outputs before considering any real hardware prototype.
