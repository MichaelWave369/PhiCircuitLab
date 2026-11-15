# Φ Circuit Lab: Electronics for the Curious

**Free classroom edition • Volume 1 • Foundational Electronics**

No kit? No soldering iron? No money? No problem. The first skill you need is being able to ask the right questions and check the answers. This book accompanies the interactive academy.

**How to study:** Read a chapter; predict the result before manipulating the virtual bench; try the exercise; answer the quiz in the browser. Keep notes on what surprised you. You do not need to complete a chapter in a fixed amount of time.

The classroom benches are **simplified educational models**. Physical circuits include tolerances, parasitic effects, heating, voltage variations, and limitations that these benches do not simulate.

---

## Chapter 1. Electricity 101

### What is a circuit?

A circuit is a connected arrangement that allows electrical charge to flow along a closed path. A battery or power supply creates an electrical potential difference. Wires and components connect places with different potential. When a closed path exists, current may flow.

Three measurements appear everywhere:

- **Voltage (V)** is electric potential difference.
- **Current (I)** is the flow rate of electric charge, measured in amperes (A).
- **Resistance (R)** is opposition to current, measured in ohms (Ω).

For an ideal resistor, **Ohm's law** is:

```text
I = V / R
V = I * R
R = V / I
```

Electrical power can be calculated as **P = V × I**, with units of watts (W).

### Worked example

A 5 V supply is connected across a 1,000 Ω resistor. The ideal current is 5 / 1000 = 0.005 A = **5 mA**. The resistor dissipates 5 × 0.005 = **0.025 W**.

### Virtual exercise

Open the **Ohm's Law Bench**. Set 5 V and 1,000 Ω. Change voltage to 10 V. What happens to current? Return to 5 V and double the resistance. What happens? Predict before moving each slider.

### Check yourself

If resistance stays constant, doubling voltage doubles current. If voltage stays constant, doubling resistance halves current.

---

## Chapter 2. Series and Parallel

### One path or many?

**Series** components share a single current path. The current through ideal series resistors is the same, and resistance values add.

```text
R_series = R1 + R2 + ...
```

**Parallel** components connect across the same pair of nodes. Each ideal branch sees the same voltage. For two ideal resistors:

```text
1 / R_parallel = 1 / R1 + 1 / R2
```

An **open circuit** breaks a path. A **short circuit** provides a low-resistance path, possibly allowing unsafe current. Real designs need attention to current limiting, conductors, and protection.

### Worked examples

- 100 Ω + 200 Ω in series = **300 Ω**.
- Two equal 200 Ω resistors in parallel = **100 Ω**.
- A 6 V supply with a 300 Ω equivalent resistor gives **20 mA**.

### Virtual exercise

Open the **Series & Parallel Bench**. Set 6 V, R1 = 500 Ω, and R2 = 500 Ω. Record equivalent resistance, source current, and individual resistor voltage in both modes. In series the equivalent is 1,000 Ω and each resistor gets 3 V; in parallel the equivalent is 250 Ω and each resistor gets 6 V.

Then open the **Voltage Divider Bench**, set 9 V with R1 = 2,000 Ω and R2 = 1,000 Ω. Verify the unloaded output is 3 V. Attach a 1,000 Ω load across R2 and observe that the output drops to 1.8 V. Loading matters because the lower effective resistance decreases.

### Check yourself

Parallel paths can draw more total current because equivalent resistance decreases.

---

## Chapter 3. LEDs and Resistors

### Lighting a diode

An **LED** is a light-emitting diode. Like many diodes, it conducts mainly in one direction when forward-biased. Its two leads are **anode** and **cathode**. Orientation matters.

A simple LED indicator usually has a **series current-limiting resistor**.

A useful starting estimate is:

```text
R = (V_supply - V_LED) / I_target
```

This is an approximation: LED forward voltage is not fixed in real life. It changes with current, temperature, LED chemistry, and manufacturing tolerances.

### Worked example

For a 5 V supply, a red LED approximated at 2 V, and desired current of 0.01 A:

```text
R = (5 - 2) / 0.01 = 300 ohms
```

A common nearby resistor value is 330 Ω. The simplified predicted current is (5 − 2) / 330 ≈ **9.09 mA**.

Check power in the resistor: I²R ≈ **0.027 W**. A real design must verify the actual part's ratings.

### Virtual exercise

Open the **LED + Resistor Bench**. Choose red, 5 V, and 330 Ω. Try blue while keeping supply and resistance fixed. Then open **Wiring Lab → Red LED + 330 Ω**. That piecewise-linear model includes a separate 20 Ω teaching slope and predicts about 8.571 mA rather than the fixed-drop estimate of 9.09 mA. Reverse the LED using the reverse preset and confirm that modeled current becomes zero. Finally, inspect the no-resistor caution preset without physically building it. See [LED Wiring Studio](LEDS.md) for details and limitations.

### Check yourself

Current limiting protects an LED; resistor power ratings protect the resistor. Reverse voltage ratings matter too. Different simplified diode models can predict different currents, and neither substitutes for a datasheet.

---

## Chapter 4. Components and Signals

### The electronics vocabulary

A **resistor** limits current and creates voltage drops. A **capacitor** stores energy in an electric field; capacitors are often used for filtering, timing, and supply decoupling. An **inductor** stores energy in a magnetic field. A **diode** mainly conducts in one direction. A **transistor** can act as a switch or amplifier. A **sensor** transforms a physical property into a signal.

Electrical components have limits: voltage, current, power, tolerance, temperature, and sometimes polarity. A part's **datasheet** documents these.

### A practical example

If a microcontroller drives a low-power LED, the GPIO output is not an infinite power source. The pin has voltage and current limitations. High-power loads typically require a suitable driver circuit, not direct connection to GPIO.

### Virtual exercise

Open **RC Timing**. The time constant is τ = R × C. For R = 1,000 Ω and C = 100 µF, τ = 0.1 seconds. Set the source to 5 V, select charging, and compare the capacitor voltage at 0τ, 1τ, and 5τ. At 1τ, the ideal capacitor is roughly 63.2% charged; at 5τ it is roughly 99.3% charged.

Switch to **Discharging**. The graph now falls exponentially. At 1τ, approximately 36.8% of the initial voltage remains. Doubling R doubles τ, so every equivalent stage of the curve takes twice as long.

The model assumes an ideal capacitor, a fixed resistor, and no parasitic losses. For real parts, consult working-voltage, polarity, tolerance and current ratings.

### Check yourself

For the RC experiment: τ = 1,000 × 100 × 10⁻⁶ = 0.1 s. The approximate ideal voltages are 0 V at 0τ, 3.16 V at 1τ charging, 4.97 V at 5τ charging, and 1.84 V at 1τ discharging. In real builds, capacitor voltage ratings and polarity are critical.

---

## Chapter 5. Digital Logic

### From voltage to information

Digital systems describe signals as logical states, often **0** and **1**. Physical hardware represents them with defined voltage ranges, not with magical perfectly precise zero- and one-volt levels.

Logic gates transform inputs into outputs:

| A | B | AND | OR | XOR |
| - | - | --- | -- | --- |
| 0 | 0 | 0 | 0 | 0 |
| 0 | 1 | 0 | 1 | 1 |
| 1 | 0 | 0 | 1 | 1 |
| 1 | 1 | 1 | 1 | 0 |

**NAND**, **NOR**, and **XNOR** invert the outputs of AND, OR, and XOR.

### Practical interpretation

An AND gate might represent "both conditions must be true." An OR gate might represent "either condition activates the output." XOR can indicate that two input states are different.

### Virtual exercise

Open the Logic Gate Bench. Select XOR and test all four input combinations. Switch to XNOR and repeat. Compare every output to your written prediction.

### Check yourself

XOR outputs 1 for (0,1) and (1,0). XNOR outputs 1 for (0,0) and (1,1).

---

## Chapter 6. Microcontrollers

### A computer on a chip

A **microcontroller** integrates a processor, memory, and hardware peripherals for controlling physical systems. Examples include ESP32 and various Arduino-compatible boards (Arduino is an ecosystem, not one particular chip).

Microcontroller firmware typically performs an initialization step, then repeatedly responds to input, timing, and events.

Common peripherals include:

- **GPIO:** general-purpose digital input/output.
- **ADC:** analog-to-digital converter for reading suitable analog signals.
- **PWM:** pulse-width modulation for controlling things like perceived LED brightness.
- **Timers, UART, I²C, SPI:** hardware features used by firmware.

### Pseudocode

```text
configure LED output
configure button input
repeat:
    read button
    if pressed:
        LED on
    else:
        LED off
```

### Virtual exercise

Use a free/public project in [Wokwi](https://wokwi.com/) to blink a virtual ESP32 LED. Then add a simulated button and change the firmware so the light depends on button state. Follow Wokwi's current free-tier terms.

### Check yourself

A microcontroller reads and drives electrical signals through defined pins. Code alone does not remove their electrical limits.

---

## Chapter 7. Hardware Communication

### When chips talk

Some communication protocols are electrical-level interfaces inside a device; others carry information across larger networks.

- **UART:** asynchronous serial data. Devices agree on baud rate and framing. TX normally connects to the other's RX, with compatible levels and a common ground.
- **I²C:** a shared two-wire bus (SDA and SCL) commonly supporting multiple addressed devices; pull-ups and voltage compatibility matter.
- **SPI:** synchronous serial bus commonly using clock, data-out, data-in, and select signals.

A device may read a sensor through I²C and publish the result via Wi-Fi using an application protocol. These are different layers of the system.

### Virtual exercise

Draw a system block diagram:

```text
[Temperature Sensor] -- I2C --> [ESP32] -- Wi-Fi --> [PhiOS Dashboard]
                                      |
                                  [Status LED]
```

Label power, ground, input/output, and data direction. Identify which portions are conceptual and which would require actual pin selection.

### Check yourself

Before wiring real devices, confirm compatible voltage levels, direction, shared reference, pull-ups when needed, and datasheet pin requirements.

---

## Chapter 8. PCB Design

### From diagram to manufactured board

A **schematic** represents electrical connectivity. A **PCB layout** represents physical parts, pads, holes, and copper. The two need to agree.

Learn the following vocabulary:

- **Net:** a named electrical connection.
- **Symbol:** schematic representation of a component.
- **Footprint:** a component's actual PCB pad pattern.
- **Trace:** conductive copper routing.
- **Via:** connection between PCB copper layers.
- **ERC:** electrical rules check.
- **DRC:** design rules check.
- **Gerber/drill files:** common fabrication outputs.

### Virtual exercise

Open the [KiCad documentation](https://docs.kicad.org/) and walk through the idea of drawing a schematic with a power source, resistor, and LED. Draw it on paper or in a text note if you cannot install KiCad yet.

Practice matching the schematic to a simple block diagram, even before a full PCB layout.

### Check yourself

A schematic can be logically connected while the PCB is physically wrong. Board layout requires its own checks and reviews.

---

## Chapter 9. Φ Hardware Architect

### Capstone: Phi Node-01

The proposed **Node-01** is a small, USB-powered learning device that eventually provides:

- A microcontroller, such as an ESP32-S3 development module.
- A user button.
- A status LED with appropriate current limiting.
- An optional display and environmental sensor.
- A network path to a PhiOS dashboard.

At this stage, it is a **design exercise**, not a tested hardware product.

### Your design brief

Produce one page with:

1. What the device must do.
2. Voltage and power source assumptions.
3. Microcontroller module and required peripherals.
4. Inputs and outputs.
5. Communications architecture.
6. A conceptual bill of materials (no purchase required).
7. Safety checks and unanswered questions.
8. How you would test a breadboard prototype before ordering a PCB.

See [NODE01.md](NODE01.md) for a complete starter design framework.

### Graduation reflection

Which assumptions remain unverified? What can be simulated? What needs a datasheet? What ultimately needs measurement on physical hardware?

**The skill is not guessing perfectly. The skill is designing a way to find out.**

---

## Answer key

1. A 5 V / 1,000 Ω resistor draws 5 mA and dissipates 0.025 W.
2. Series resistances add; equal parallel resistors have half their individual resistance.
3. For 5 V, red 2 V, 330 Ω: about 9.09 mA in this simplified model.
4. Capacitors store energy in an electric field; transistors can act as switches.
5. XOR is 1 when inputs differ.
6. GPIO is general-purpose input/output; ADC converts an analog measurement into digital form.
7. I²C uses SDA and SCL; protocol-level details do not guarantee electrical compatibility.
8. Footprints define physical pads; ERC and DRC check different classes of errors.
9. Verify assumptions before treating a virtual design as hardware-ready.

## Further reading

- [Adafruit Learning System](https://learn.adafruit.com/)
- [CircuitJS / Falstad](https://falstad.com/circuit/)
- [KiCad documentation](https://docs.kicad.org/)
- [Wokwi](https://wokwi.com/)

Use the [safety guide](SAFETY.md) before any physical construction.

## Bonus practice: Learn to measure before you build

Use the integrated **Wiring Lab → Virtual Multimeter** to verify voltage drops, spot floating terminals, and trace open wires. The [multimeter field workbook](MULTIMETER.md) contains five no-hardware diagnostic exercises. Voltage probes are ideal non-loading calculations; wire continuity is not a real ohmmeter, and current inspection is not a physical series ammeter.

## Practice course: Circuit Challenge Academy

The nine-mission [Circuit Challenge Academy](ACADEMY.md) provides seeded troubleshooting after the core labs. Predict a fault, use the embedded Wiring Lab and virtual meter to diagnose it, and submit a modeled repair. The final mission has two distinct faults. Progress and scores are locally stored separately from free-build circuits.

## Advanced practice: Mystery Circuit Diagnostics

Complete the [Mystery Diagnostics workbook](MYSTERY.md) for eight sealed service cases. The initial faulty wiring is withheld: gather two distinct virtual meter observations, lock a diagnosis, then reveal and repair the circuit. This combines voltage polarity, ideal-wire continuity, branch currents, open networks and short detection without physical equipment or paid services.

## Bonus lab: Time-domain oscilloscope and RC signals

The [Virtual Oscilloscope workbook](OSCILLOSCOPE.md) provides a specialized first-order circuit with R, C and a step, pulse or square-wave source. Compare the existing standalone RC charge/discharge bench to exact time-dependent plots. Measure τ, verify 63.2% charging at t=τ, and explore capacitor voltage continuity through source transitions. This does not add general capacitors to the Wiring Lab solver.

## v1.0 capstone: Project Workstation

Use the [Virtual Electronics Workstation manual](WORKSTATION.md) to organize one complete experiment. Build and test a DC circuit; capture a modeled meter reading. Run a separate RC scope experiment; record its cursor measurement. Write an explanation and export the resulting project portfolio as JSON. These two model types remain independent, but the shared notebook provides a complete lab record.

## v1.1 hands-on solderless breadboard workshop

Use the [Virtual Breadboard workbook](BREADBOARD.md) to learn actual contact topology: five holes per strip, a center-trench break, and separate power rails that need deliberate source-jack wires. Verify a 9 V/1 kΩ resistor, a current-limited LED, an open/closed switch, and the difference between modeled source current and direct copper continuity. A validated schematic can be sent to Wiring Lab only with explicit confirmation.
