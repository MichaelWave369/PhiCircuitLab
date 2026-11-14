# Φ Node-01: first virtual hardware capstone

**Status:** Proposed educational design. Not yet physically prototyped or verified.

## Mission

Design a compact, USB-powered microcontroller node that reads a button and sensor, illuminates a status LED, and exchanges data with a dashboard. PhiCircuitLab itself remains useful even if nobody ever buys the hardware.

## Requirements

| ID | Requirement | Proposed verification |
| --- | --- | --- |
| R1 | Power from a documented low-voltage USB development board | Review board documentation; inspect its regulator limits |
| R2 | Detect a pushbutton | Firmware simulation and input debounce test |
| R3 | Show state via an LED | Calculate resistor limits; validate on physical prototype later |
| R4 | Read an optional compatible sensor | Simulated firmware interface; later physical bench test |
| R5 | Publish a simple status to a local dashboard | Browser/mock test first; later embedded network test |
| R6 | Operate without cloud accounts for core functions | Architecture review |
| R7 | Keep BOM and documentation publicly reproducible | Repository review |

## Block diagram

\`\`\`text
       USB power (documented dev board)
                    |
             [ESP32-S3 module]
              |      |      |
           Button   LED   Optional I2C sensor
                    |
               Wi-Fi / HTTP
                    |
               PhiOS viewer
\`\`\`

Actual connectors, GPIO pins, operating voltages, software protocols, current limits, and protection **must** be selected from the specific board and component datasheets. The diagram is conceptual.

## Design choices

- **Prototype first:** use a development module and a solderless breadboard before any custom PCB.
- **First PCB second:** a simple carrier board for a proven dev module is more approachable than laying out a raw high-speed microcontroller or RF circuitry.
- **No battery initially:** USB powering a standard development board reduces the number of safety-critical design questions.
- **Offline-first dashboard:** local messages can be displayed without a paid cloud service.
- **No untested claims:** track unresolved electrical and mechanical assumptions explicitly.

## Proposed learning milestones

1. Calculate a resistor and simulate an LED on the in-browser bench.
2. Read a button in Wokwi or an equivalent virtual MCU environment.
3. Send a simulated status message to a local browser dashboard.
4. Draw the Node-01 schematic in KiCad.
5. Review pin compatibility, pull-ups, regulator budget, and footprints.
6. Run ERC and DRC and review board assembly clearances.
7. Only after a physical prototype works, consider board fabrication.

## Exit criteria for the virtual stage

A complete one-page specification, component datasheet links, a coherent block diagram, a simulated firmware experiment, a draft schematic, and a list of unverified assumptions.

Physical verification remains a separate future milestone.
