# Safety, scope, and scientific honesty

## What this classroom is

PhiCircuitLab v0.1 offers **idealized mathematical demonstrations** of Ohm's law, a fixed-forward-voltage LED circuit, and Boolean logic gates. It is suitable for learning and prediction exercises.

It does **not** simulate transient circuit behavior, semiconductor curves, voltage regulator dynamics, electromagnetic compatibility, PCB trace heating, fault protection, or physical device hazards.

## Beginner physical projects: boundaries

If you later try a physical build:

1. Start with a known, low-voltage, current-limited, commercially supplied USB setup.
2. Do not experiment with household mains power, wall outlets, or mains-connected circuitry.
3. Avoid homemade lithium-ion charging circuits and unknown battery packs.
4. Check all pin voltage/current limits and component polarity in their datasheets.
5. Use appropriate insulated tools and adult/supervised workshop guidance where necessary.
6. Never assume the virtual LED's nominal 20 mA threshold suits every LED or GPIO. It is only a teaching heuristic.
7. An enclosure, wiring plan, and PCB still need review even after simulation.
8. Do not connect a physical load directly to a GPIO pin without verifying the allowed pin drive and protection needed.

## On numerical results

- The Ohm's law bench calculates an **ideal resistive circuit**, with no source impedance or wire losses.
- The LED bench uses a **constant forward-voltage approximation** and warns above either 20 mA modeled current or 0.25 W modeled resistor dissipation. Real LED limits and resistor ratings vary widely.
- The logic bench evaluates abstract Boolean truth tables, not propagation delays, signal edges, metastability, or electrical thresholds.

**Learning begins with models. Engineering requires identifying what the model leaves out.**

## Ideal-switch warning

The Wiring Sandbox now supports ideal open/closed switches. A closed switch is mathematically identical to a zero-resistance connection. Real switches have voltage/current ratings and imperfect contacts. The solver flags a direct V+ to GND path through wires and closed switches as a short but cannot predict safe fault current or heating. Never build or test an intentional short on a real power source.
