# Adaptive Reactor Lab: a falsifiable digital twin

This lab translates the **Cosmic Adaptation / HDAF / HDAC** *concept illustration* into an open, deliberately modest, testable solar-plus-storage simulation. It does **not** validate the depicted hardware, the blueprint's efficiency tables, its "biological energy conversion layer", or any claimed Hypsibius-derived reactor. The illustration is an unverified source of ideas, not an engineering specification.

Open [Adaptive Reactor Lab](../adaptive-reactor.html) from the PhiCircuitLab navigation. It runs without a server or package dependencies. The interface and all controller variants use the same deterministic evaluation environment and initial stored energy.

## Actual system modeled

`solar PV → power converter / control mode → user load`, with a bidirectional battery buffer. Radiation sensors, variable material density, neural-linked biological adaptation and genuinely living layers are **not implemented**. What is modeled is a temperature/stress-adjusted electronic converter with four illustrative operating modes.

The three strategies share the same hardware assumptions:

- **Fixed balanced**: always uses balanced conversion, fixed output ceiling and cooling properties.
- **Rule-based**: chooses eco, balanced, boost or protective state from instantaneous demand, reserve and temperature.
- **Learned**: a tiny, interpretable tabular *contextual-bandit* policy using the same four modes. It trains on eight simulated synthetic days (1–8), then is frozen and evaluated on a separate synthetic day (97). It is *not* a neural network, adaptive physical material, general AI or a validated hardware controller.

The label "State A/B/C" in the posted illustration maps loosely to steady operation / high demand / protective adaptation. The four simulated modes are our model assumptions rather than data from the image.

## Physics and accounting

Each step represents five minutes (`Δt = 1/12 h`). Instantaneous power uses **W** and integrated electrical energy uses **Wh**.

Solar follows a first-order, PVWatts-like DC temperature correction:

`P_PV = max(0, P_STC × G / 1000 × (1 - 0.004 × (T_cell - 25)) × 0.96)`

Here `G` is synthetic effective irradiance in W/m². `T_cell = T_ambient + 0.024 × G` °C is an illustrative simplification, **not** a calibrated solar module thermal model. The 0.96 factor is a chosen generic derating, not a measured efficiency. The deterministic sunrise-to-sunset irradiance, scenario clouds, heat, and electrical demand are synthetic, not weather forecasts.

Reference: [PV Performance Modeling Collaborative, PVWatts model](https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/point-value-models/pvwatts/). The original PVWatts formulation motivates the irradiance and temperature dependence. Our scenario, temperature estimate and power flow are intentionally simplified.

Each converter mode has an assumed base efficiency, maximum delivered output, fixed parasitic overhead and heat-removal coefficient. The efficiency is decreased for synthetic environmental stress and excess core temperature, clamped to **70%–98%**. Nothing can exceed a converter efficiency of 100%.

After covering parasitic overhead, power to the load is limited by:
1. requested demand,
2. the mode's output ceiling, and
3. the finite solar and battery DC bus, multiplied by converter efficiency.

Unused PV can charge the battery only within its rated energy capacity and a finite charge limit. Both charge and discharge have assumed **95% one-way energy efficiency**. Battery energy is always clamped from 0 to rated capacity. Remaining solar is recorded as curtailed energy.

The auditable balance of each timestep is:

`PV_in (Wh) + battery_before (Wh) = delivered_to_load (Wh) + curtailed (Wh) + losses (Wh) + battery_after (Wh)`

`losses` include converter inefficiency, control overhead, battery charging and discharging losses. That residual appears in the energy ledger. A physically valid run should have a residual effectively equal to zero (up to floating-point rounding).

The core temperature is updated from heat-loss power and a lumped thermal capacity of 30,000 J/°C with mode-dependent cooling. This is a toy thermal system, not a thermal safety design. A core temperature above 55°C is counted as a *model* alarm.

## Reproduce an experiment

1. Choose Normal, Heatwave, Storm, or Evening Surge.
2. Set PV nameplate wattage, battery rated energy (Wh), base load (W), stress and a repeatable seed.
3. Run the 24-hour experiment. All strategies start at 55% battery charge and are evaluated with the same synthetic day.
4. Compare fraction of demand served, lost load, losses, thermal alarms, and the ledger residual. **The learned policy can underperform**: the comparator is an experiment, not an advertised breakthrough.
5. Export per-step CSV or a complete JSON containing model inputs, training policy scores and traces. Saved exports are local only.

No browser state, accounts, APIs, network calls or cookies are needed for the simulator calculation. The site uses its existing remote font CSS import if online, but the lab works with local fallback fonts.

## Limits and next research steps

- No simulation of tardigrade proteins or speculative bio-reactive energy conversion; a biological coating contributes **zero power**.
- Solar PV and storage are well-established. Their precise efficiencies and environmental response would need real part specifications and bench measurements.
- Sensor noise, response latency, component aging, BMS protection, MPPT dynamics, electronics failure modes, real weather traces and electrical transient effects are omitted.
- The contextual-bandit rewards and bins are illustrative, not safety-reviewed. Before a meaningful performance claim, use real irradiance/load data, more test days, uncertainty bounds, held-out climates, and rigorous baselines.
- Before physical prototyping, replace toy formulas with documented electrical and thermal models, include electrical isolation and fuse/BMS protection, and seek professional review.

## Developer checks

From the repository root:

```sh
npm test
node --check adaptive-reactor-engine.mjs
node --check adaptive-reactor-ui.mjs
```

Tests check energy balance every mode and every strategy, absence of free energy at night with an empty battery, bounded state of charge, temperature derating, deterministic repeatability, scenario extremes and input bounds. Existing classroom tests remain unchanged.
