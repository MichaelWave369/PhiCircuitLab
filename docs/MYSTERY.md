# Φ Circuit Lab • Mystery Circuit Diagnostics

**Release v0.8 • Eight sealed diagnostic cases • Free • No physical hardware**

Mystery Circuit Diagnostics is an investigative companion to the v0.7 Circuit Challenge Academy. Instead of displaying the broken circuit immediately, the **initial wiring and exact fault are hidden**. Learners have a service report, a set of named terminals and components, and virtual measurement tools. Only after gathering evidence and committing a diagnosis can they open the actual circuit and attempt a repair.

## How to play

1. Open **Mystery Diagnostics** from the main navigation.
2. Select one of eight sealed service work orders.
3. Choose a meter mode and two test points, or a component for modeled current inspection.
4. Press **Take measurement**. The result is recorded in the evidence notebook, alongside meter-model limitations.
5. Collect at least **two distinct measurements**, including one component or internal test point. Reversing red/black probe order does not count as an additional location.
6. Choose the likely fault and select **Lock diagnosis & reveal circuit**. After that, the hidden schematic and repair tools become available.
7. Fix the actual circuit using the embedded Wiring Lab and check the result. The existing electrical grader verifies safe-model currents, the intended component paths, and the mission-specific repair behavior.
8. Earn points, progress through all cases, and replay a known seed for an identical fault setup.

**No circuit drawing, underlying wire list, component values, grader notices or solution reference are shown before diagnosis** through the Academy interface. The learning exercise is not a security boundary against someone inspecting the open-source JavaScript with developer tools.

## Eight black-box cases

| Case | Initial service report | Diagnostic approach |
| --- | --- | --- |
| A • Silent Control Panel | No useful output from a resistor circuit | Probe source and internal path |
| B • Uneven Module | Only part of a two-channel system works | Compare resistor branch currents |
| C • Unexpected Standby | System remains inactive when powered | Measure switch terminals and continuity |
| D • Dark Status Lamp | The LED remains off | Measure anode/cathode voltage polarity |
| E • Warning on Indicator | A lit LED has an operating-limit warning | Measure LED and resistor current |
| F • Blue Indicator Offline | Blue LED remains off with source attached | Compare source with LED model threshold |
| G • Safety Shutdown | Solver refuses a normal DC solution | Trace direct ideal-wire continuity |
| H • Last Shift Service Call | One attempted fix does not restore power | Search for multiple interruptions |

Cases are based on reproducible **seeded circuit variations**, not hardcoded success screens. The fixture is hidden before diagnosis, but the voltage, continuity and current instruments still use the same electrical solvers as free-build mode.

## The measurement station

**Voltage:** Select red and black terminals. The ideal non-loading voltmeter reports \`V_red − V_black\`. Reversing the probes flips the sign but doesn't earn an extra evidence location.

**Continuity:** Select two terminals and read CONNECTED or OPEN for an ideal 0 Ω route through wires and closed switches. This is *not* a real physical ohmmeter. A resistor between terminals is **not** counted as a direct wire.

**Current:** Select a resistor or LED by identifier to inspect its model current in mA. Individual ideal switch currents may be unavailable. This is a solver branch inspection, not an inserted physical ammeter.

For shorted or unresolved networks, the virtual voltmeter/current readings display **—** instead of fabricated values. A continuity trace can still provide useful evidence in a shorted network. Floating terminals likewise produce unavailable voltages.

A notebook entry includes the measurement mode, chosen test points, value/status, and explanatory notes. Duplicate measurement locations do not count toward evidence points.

## Scoring

Every successfully repaired case is worth a **50-point base**. A correct initial diagnosis earns **30 points**. Collecting three distinct measurements before locking the diagnosis earns **20 points**. A hint costs **10 points**, and each failed repair check costs **5 points**, up to 25 points total. The minimum completed-case score is 25 points.

**Maximum: 800 points across eight cases.**

There is no countdown, leaderboard, paid tier, or external account. Practice and debugging matter more than competitive speed. Once a case is completed, its awarded score is locked for that run.

## Why repair scoring is not based on appearance

The repaired document is schema-validated and passed to the same electrical grading engine introduced in v0.7. It checks that the modeled source and component currents agree with the healthy reference, original parts remain, and the learner hasn't merely bypassed a resistor or shorted the supply to get a different success signal. Overcurrent and short-circuit hazards prevent passing.

### Separate storage

- Regular Wiring Lab: \`phi-circuit-lab-wiring-v1\`
- Challenge Academy: \`phi-circuit-lab-academy-v1\`
- Mystery Circuit Diagnostics: \`phi-circuit-lab-mystery-v1\`

The sealed case is derived from the run seed. Before diagnosis, Mystery saves only a sanitized list of measurement requests/results and learner progress, **not a displayed hidden schematic**. After reveal, the validated repair circuit is persisted in Mystery's own local save. Existing free-build circuits, Academy scores, and classroom lesson completion are untouched.

The initial state and scoring are reproduced with the run seed. Browser storage must be enabled for persistence.

## Scientific and physical safety

This is an **educational DC simulator**, not a physical test bench. The resistor/switch/LED models are simplified, and a no-resistor LED is deliberately hazardous as a learning example.

- Never attempt an intentionally shorted circuit with real supplies.
- Use actual continuity meters only on de-energized and safely discharged circuits.
- A physical ammeter requires the correct range, protection, and normally a series insertion; never connect one directly across a supply.
- Verify device voltage, current, reverse bias, thermal ratings and power-supply protection using real datasheets and appropriate expertise.
- Do not use virtual diagnostic success as evidence that any physical device is safe.

See [Multimeter Workbook](MULTIMETER.md), [Challenge Academy](ACADEMY.md), [LED Model](LEDS.md), and [Safety Guide](SAFETY.md).

## What's next

Future versions could add a partially disclosed schematic with accessible labeled test points and a genuine resistance-measurement model. Such features should wait for reliable simulator support, careful safety documentation, and automated tests.
