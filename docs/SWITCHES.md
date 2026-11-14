# Φ Circuit Lab: Ideal Switches in the Wiring Sandbox

**Classroom module:** Circuit Fundamentals • **Release:** v0.4 • **Hardware required:** none

## What is a switch?

A switch is a component that changes whether there is a conductive path between two terminals.

- **Open** means the idealized contacts are separated and carry no DC current.
- **Closed** means they are joined with zero resistance in our simulator.
- **A real switch is different.** Physical contacts have ratings, finite resistance, bounce, wear, and failure conditions. Never use this simulation to select a mains-rated switch.

The sandbox supports up to **four ideal switches** alongside eight resistors and forty wires. Switch IDs look like `S1`, `S2`, and so on.

## Experiment A: break and complete a loop

1. Open **Wiring Lab** from the top navigation.
2. Under presets choose **Series switch challenge**.
3. Observe that S1 is initially **OPEN**. The network status is **Open circuit** and source current is zero.
4. Click the S1 component. In the Parts & Power panel, choose **Toggle switch**.
5. The switch should become **CLOSED**, the network should read **Connected circuit**, and the current should be 9 mA at 9 V through a 1,000 Ω resistor.
6. Toggle it open again, then use Undo to restore the closed state.

**Why?** The resistor is the current-limiting component. Closing the switch completes a conductive path; it does not itself replace the resistor.

## Experiment B: switches in series

1. Start from a blank wiring challenge.
2. Remove the unused R2, then add switches S1 and S2.
3. Connect `V+ → S1:a`, `S1:b → S2:a`, `S2:b → R1:a`, `R1:b → GND`.
4. Toggle the switches through the four input combinations.

| S1 | S2 | Full conductive path? |
| --- | --- | --- |
| Open | Open | No |
| Open | Closed | No |
| Closed | Open | No |
| Closed | Closed | Yes |

This is the electrical version of the Boolean **AND** relationship. Both switches must be closed.

## Experiment C: a short-circuit diagnosis

1. In the switch challenge, add a **second wire path** that connects `V+` to `S1:a` and `S1:b` to `GND` without a resistor, leaving the existing R1 branch in place.
2. With S1 open, there is no ideal-wire short.
3. When S1 closes, the switch connects supply to ground without any resistance. The app reports **Ideal source short detected**, and it does not invent a numeric current.

**Never recreate a direct short across a real power source.** Real supplies can deliver hazardous current and heat.

## About switch currents

Closed switches are modeled as perfect conductors. When several ideal wires or switches share paths, the individual current carried by a particular ideal wire or switch is not always mathematically unique. The app therefore shows each switch's **state**, not a fabricated switch-current measurement. Source and resistor currents remain computable where the network is well-defined.

## About LEDs

The standalone **LED + Resistor Bench** remains the recommended place for learning forward voltage and current limiting. The wiring graph does **not yet** support LEDs as nonlinear electrical devices. The next iteration can add a diode-aware numerical solver, with separate reverse-polarity and overcurrent validation. We will not depict a lit LED unless the electrical model genuinely supports it.

## JSON and backwards compatibility

The v0.4 circuit document keeps `version: 1` and accepts older v0.3 designs that have no `switches` array.

Example switch:

```json
{"id":"S1","closed":false,"x":345,"y":170}
```

Each switch has two terminals: `S1:a` and `S1:b`. The switch state must be an actual boolean, not a string. Imports also verify IDs, positions, duplicate connections, and maximum part counts.

## Simulation limits

Ideal DC resistor networks and simple on/off switches only. No transient response, AC, electromechanical contact bounce, component heating, nonzero switch resistance, semiconductors, battery charging, or power-source fault dynamics. See [the safety guide](SAFETY.md) and [Wiring Lab manual](WIRING-LAB.md).
