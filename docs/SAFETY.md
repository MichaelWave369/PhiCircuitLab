# Safety, scope, and scientific honesty

## What this classroom is

PhiCircuitLab offers **idealized teaching models** of resistors, a fixed-forward-voltage LED circuit, switches, logic gates and a simplified piecewise-linear LED wiring solver. It is suitable for learning and prediction exercises.

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

## v0.5 LED wiring model safety

The LED Wiring Studio approximates three LED colors using fixed forward thresholds and a shared artificial 20 Ω slope. Real LEDs have nonlinear I–V curves, reverse-voltage limits, thermal effects, and variable current ratings. The simulator warns at 20 mA only as an educational heuristic, not as a safe operating threshold for any real LED or microcontroller GPIO. The **LED without resistor** example intentionally illustrates a bad design; never reproduce it using physical power. The simulated 150 mA is not a reliable prediction of real fault current.

## v0.6 multimeter and continuity-tracing safety

The virtual meter is mathematical instrumentation, not a calibrated multimeter. Its continuity setting only traces ideal 0 Ω wires and closed switches and conceptually ignores the power source; it is not a physical resistance measurement. Never measure continuity on an energized physical circuit. A real ammeter is normally inserted in series, not placed across a supply; the app's current tool is a non-invasive solver readout. Check physical meter/probe ratings, discharge stored energy, and work only with safe low-voltage current-limited setups for beginner experiments.
