import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAMBERS, COATINGS, CONTROLLERS, DC_BUS_VOLTS,
  normalizeArenaOptions, chamberEnvironment, selectController,
  simulateArena, runArena, runTournament
} from '../adaptive-arena-engine.mjs';
import { environmentAt, initialPlant, normalizeConfig, stepPlant } from '../adaptive-reactor-engine.mjs';

const base={pvW:620,batteryWh:1200,loadW:210,stress:0.36,seed:369,trialSeed:135};

test('invalid chamber and coating input are safely normalized',()=>{
  const a=normalizeArenaOptions({...base,chamber:'free-power',coating:'quantum-magic'});
  assert.equal(a.chamber,'baseline');
  assert.equal(a.coating,'none');
  assert.throws(()=>chamberEnvironment(12,a.config,'unknown'),RangeError);
  assert.throws(()=>selectController('unknown',initialPlant(a.config),
    environmentAt(12,a.config),a.config,{}),RangeError);
});

test('all chamber inputs are reproducible, and interventions are isolated',()=>{
  const cfg=normalizeConfig(base);
  const normal=chamberEnvironment(12,cfg,'baseline');
  assert.deepEqual(chamberEnvironment(12,cfg,'baseline'),normal);
  const cloud=chamberEnvironment(12,cfg,'clouds');
  const outage=chamberEnvironment(12,cfg,'pvOutage');
  const heat=chamberEnvironment(12,cfg,'heatPulse');
  const cold=chamberEnvironment(12,cfg,'coldSnap');
  assert(cloud.pvW<normal.pvW);
  assert.equal(outage.pvW,0);
  assert(heat.ambientC>normal.ambientC);
  assert(heat.pvW<normal.pvW);
  assert(cold.ambientC<normal.ambientC);
  assert(cold.pvW>normal.pvW);
  assert(chamberEnvironment(18,cfg,'demandSurge').loadW>
    chamberEnvironment(18,cfg,'baseline').loadW);
});

test('a hypothetical coating only changes thermal transfer and not electric energy',()=>{
  const cfg=normalizeConfig(base);
  const plant={batteryWh:800,coreC:61};
  const env={...environmentAt(12,cfg),ambientC:24,pvW:150};
  const insulated=stepPlant(plant,'balanced',env,cfg,1/12,{thermalTransferFactor:COATINGS.insulator.thermalTransferFactor});
  const spread=stepPlant(plant,'balanced',env,cfg,1/12,{thermalTransferFactor:COATINGS.spreader.thermalTransferFactor});
  assert(spread.plant.coreC<insulated.plant.coreC);
  assert.equal(spread.outputW,insulated.outputW);
  assert.equal(spread.plant.batteryWh,insulated.plant.batteryWh);
  assert(Math.abs(spread.balanceResidualWh)<1e-8);
  assert(Math.abs(insulated.balanceResidualWh)<1e-8);
});

test('all controllers are deterministic and conserve energy in every chamber',()=>{
  for(const chamber of Object.keys(CHAMBERS)){
    const trial=runArena({...base,chamber,coating:'spreader'});
    assert.equal(trial.rankings.length,Object.keys(CONTROLLERS).length);
    for(const controller of Object.keys(CONTROLLERS)){
      const run=trial.runs[controller];
      assert.equal(run.trace.length,288);
      const t=run.totals;
      assert(t.servedWh<=t.demandWh+1e-7);
      assert(t.unservedWh>=0);
      assert(t.reliability>=0&&t.reliability<=1);
      assert(Math.abs(t.demandWh-t.servedWh-t.unservedWh)<1e-7,
        chamber+'/'+controller+' served plus unserved matches demand');
      assert(Math.abs(t.energyResidualWh)<1e-6,chamber+'/'+controller+' energy ledger');
      assert(Math.abs(t.residualWh)<1e-6,chamber+'/'+controller+' per-step residual');
      assert(run.trace.every(x=>x.socPercent>=0&&x.socPercent<=100));
      assert(run.trace.every(x=>Number.isFinite(x.busA)&&Number.isFinite(x.coreC)));
      assert(run.trace.every(x=>x.busV===DC_BUS_VOLTS||x.busV===0));
      assert(run.trace.every(x=>Math.abs(x.busV*x.busA-x.deliveredW)<1e-8));
    }
    const replay=runArena({...base,chamber,coating:'spreader'});
    assert.deepEqual(trial,replay,'deterministic '+chamber);
  }
});

test('battery aging reduces usable storage for everyone, not just one controller',()=>{
  const withFade=runArena({...base,chamber:'batteryFade'});
  for(const controller of Object.keys(CONTROLLERS)){
    const run=withFade.runs[controller];
    assert.equal(run.totals.batteryStartWh,base.batteryWh*0.6*0.55);
    assert(run.totals.batteryEndWh<=base.batteryWh*0.6+1e-8);
  }
});

test('sensor bias changes observations but not physical source or ambient weather',()=>{
  const drift=runArena({...base,chamber:'sensorDrift'});
  const baseline=runArena({...base,chamber:'baseline'});
  const a=drift.runs.fixed.trace,b=baseline.runs.fixed.trace;
  for(let i=0;i<288;i++){
    assert.equal(a[i].pvW,b[i].pvW);
    assert.equal(a[i].ambientC,b[i].ambientC);
    assert.equal(a[i].observedCoreC-a[i].coreC,18);
    assert.equal(b[i].observedCoreC,b[i].coreC);
  }
});

test('full 8-chamber 3-seed tournament is deterministic with shared budgets',()=>{
  const first=runTournament(base,3);
  assert.equal(first.seeds,3);
  assert.equal(first.cases.length,Object.keys(CHAMBERS).length);
  assert.deepEqual(first,runTournament(base,3));
  for(const key of Object.keys(CONTROLLERS)){
    const total=first.totals[key];
    assert(total.demandWh>0);
    assert(total.servedWh>=0);
    assert(Math.abs(total.residualWh)<1e-5);
  }
});

test('no new electricity from outage or no battery supply',()=>{
  const cfg=normalizeConfig(base);
  const outage=chamberEnvironment(12,cfg,'pvOutage');
  const plant={coreC:25,batteryWh:0};
  const step=stepPlant(plant,'boost',outage,cfg);
  assert.equal(step.outputW,0);
  assert.equal(step.plant.batteryWh,0);
  assert.equal(step.balanceResidualWh,0);
});

test('all possible coating modes retain bounded energy accounting',()=>{
  for(const coating of Object.keys(COATINGS)){
    const result=simulateArena({...base,chamber:'heatPulse',coating},'rules');
    assert(Math.abs(result.totals.energyResidualWh)<1e-6);
    assert(result.trace.every(v=>Number.isFinite(v.coreC)));
  }
});
