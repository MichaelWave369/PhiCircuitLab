# Adaptive Systems Arena — Phase 2 experimental methods

Open [Adaptive Systems Arena](../adaptive-arena.html). The original [Phase 1 lab](../adaptive-reactor.html) remains available.

This is a *hypothetical engineering control study* around an ordinary solar photovoltaic array, finite battery and power converter. It is **not** a working reactor, validated power electronics, electrical transient model, or proof of tardigrade-derived radiation shielding. It contains no biological energy generation.

## Experimental design

- Simulate a 24-hour day in 288 five-minute steps.
- Four strategies receive identical externally generated PV, load, battery capacity and thermal forcing:
  1. **Fixed balanced** converter mode.
  2. **Threshold rules** switching eco / balanced / boost / protection.
  3. **Tabular trained policy**, trained on eight separate synthetic baseline days and frozen for all evaluated scenarios. It is **not a neural network**.
  4. **Reserve-first heuristic** that tries to protect battery reserve and thermal headroom.
- Each controller begins at **55% of usable battery capacity**. The battery degradation chamber reduces rated usable capacity by 40% for *every* competitor before the experiment starts.
- Shared deterministic environment, day and seed. Evaluate out of sample. Repeat the optional tournament across **all eight** conditions and **three shared held-out trial seeds**.
- Rank controllers by **total load delivered**, then fewer above-55°C simulated thermal alarm steps, then modeled electrical losses. These rankings are only for the chosen synthetic setup; different objectives could rank them differently. Some algorithms may lose to the fixed baseline.

## Chamber experiments

| Chamber | Modeled intervention | Intentionally not modeled |
| --- | --- | --- |
| Baseline | Normal daily PV/load curves | Real location weather |
| Thermal stress pulse | +18°C ambient and cell temperature during 11:00–18:00; greater synthetic stress, PV derating | Mechanical temperature cycling/damage |
| Cold snap | -24°C ambient/cell temperature and temperature-corrected PV | Temperature-dependent battery chemistry |
| Heavy clouds | PV output and effective irradiance at 18% of modeled value during 10:00–16:00 | Detailed cloud transients |
| Solar source outage | Zero PV available 10:00–14:00 | Converter internal failure modes |
| Evening demand surge | 2.4× normal demand during 16:00–21:00 | Inrush currents |
| Degraded battery | 60% of nominal usable capacity | Battery aging/impedance/chemistry |
| Temperature sensor drift | A shared +18°C bias in observed core and ambient temperature fed to non-fixed controllers | Sensor fusion, calibrated metrology |

A sensor-bias condition changes the input **observations**, not the physical ambient temperature. Every comparator is evaluated against *true* system state.

## Biomimicry materials hypothesis

The "coating" option varies a single, entirely hypothetical **lumped cooling coefficient**:

- Baseline: 1.00×
- Heat spreading: 1.65×
- Insulating: 0.58×

These factors are **invented controllable parameters**, not measured properties of tardigrade proteins or any coating. They only adjust the heat-removal term in the model. They cannot supply power, change PV production, violate the electrical energy ledger, or establish real material performance. In particular, **Dsup** and **CAHS** biological findings do not imply an electricity-generating layer.

The modified thermal model is:

`ΔT = (loss_power - (T_core - T_ambient) × heat_transfer_coefficient × coating_factor) × Δt_seconds / 30000 J/K`

The thermal mass, heat-transfer coefficients and electrical mode efficiencies are classroom assumptions. They require real component data before hardware use.

## Energy conservation

The entire experiment uses the same Phase 1 `stepPlant` energy accounting, including 95% charging/discharging efficiency and finite capacity. No stage has a physical energy source other than PV plus initially stored battery energy.

`solar_energy_Wh + initial_battery_Wh = delivered_energy_Wh + curtailed_solar_Wh + all_electrical_losses_Wh + final_battery_Wh`

Each model result and the conservation ledger expose the residual of this equality, which must be zero within floating-point rounding.

## Instrument model

The virtual oscilloscope shows five-minute samples of:

- ideal **48 V regulated output bus** when load is served, 0 V when no power is delivered,
- derived **output current = delivered W / 48 V**,
- delivered and requested power,
- true and observed core temperature (different only with sensor bias),
- battery state of charge.

It does **not** simulate voltage droop, ripple, transient response, wave propagation, AC signals, electronic switching, or real oscilloscope bandwidth. The current is mathematically derived, not measured. Use SPICE, bench instrumentation and appropriate safety review for hardware-level claims.

## Notebook and exports

- A run is saved to localStorage only by explicitly clicking **Save this run**.
- The notebook retains at most 36 experiments under `phi-circuit-lab-arena-notebook-v1`.
- Each entry stores scenario, coating hypothesis, chosen settings, timestamp, optional note, winner and complete per-controller 24-hour totals.
- Export the notebook as JSON or the current 288-sample traces as CSV.
- Neither experiment results nor notes leave the browser; there are no accounts or analytics.

## Validation and future work

Run `npm test` and `npm run test:browser` from the repo root. Phase 2 tests verify identical inputs, deterministic scenarios, no free energy on solar outage, correct battery clipping, sensor drift separation, coating thermal-only changes, all controllers across the chamber suite and tournament reproducibility.

Future improvements: realistic measured datasets, weather/location traces, Monte Carlo parameter intervals, actual DC/MPPT/BMS dynamics, uncertainty analysis, learned-policy train/test splits across *different* climates, fault-detection sensor fusion, exportable calibration tables, and physical component testing with appropriate professional electrical safety controls.
