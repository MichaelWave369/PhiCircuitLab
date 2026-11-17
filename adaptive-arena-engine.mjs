// PhiCircuitLab Phase 2: controller tournament, environmental faults and coating hypotheses.
// This module uses the Phase 1 DC power budget; no extra or biological energy source.
import {
  STEP_HOURS, MODES, normalizeConfig, environmentAt, initialPlant,
  stepPlant, ruleMode, contextKey, trainController
} from './adaptive-reactor-engine.mjs';

export const CHAMBERS = Object.freeze({
  baseline: 'Normal operating conditions',
  heatPulse: 'Thermal stress pulse',
  coldSnap: 'Cold ambient snap',
  clouds: 'Heavy passing cloud cover',
  pvOutage: 'Midday solar source outage',
  demandSurge: 'Evening demand surge',
  batteryFade: 'Battery capacity degraded by 40%',
  sensorDrift: 'Core temperature sensor bias +18°C'
});
export const COATINGS = Object.freeze({
  none: Object.freeze({ label: 'No hypothetical coating', thermalTransferFactor: 1 }),
  spreader: Object.freeze({ label: 'Hypothetical heat-spreading coating', thermalTransferFactor: 1.65 }),
  insulator: Object.freeze({ label: 'Hypothetical insulating coating', thermalTransferFactor: 0.58 })
});
export const CONTROLLERS = Object.freeze({
  fixed: 'Fixed balanced',
  rules: 'Threshold rules',
  learned: 'Tabular trained policy',
  reserve: 'Reserve-first heuristic'
});
export const DC_BUS_VOLTS = 48; // Explicit ideal regulated output-bus assumption.
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const finite=(x,defaultValue,a,b)=>Number.isFinite(Number(x))?clamp(Number(x),a,b):defaultValue;
const MODE_NAMES=Object.keys(MODES);

export function normalizeArenaOptions(input={}) {
  const scenario=Object.hasOwn(CHAMBERS,input.chamber)?input.chamber:'baseline';
  const coating=Object.hasOwn(COATINGS,input.coating)?input.coating:'none';
  return {
    config: normalizeConfig({
      pvW: input.pvW, batteryWh: input.batteryWh, loadW: input.loadW,
      stress: input.stress, seed: input.seed, scenario: 'normal'
    }),
    chamber: scenario,
    coating,
    trialSeed: Math.round(finite(input.trialSeed, 369, 1, 1000000))
  };
}
export function chamberEnvironment(hour, config, chamber='baseline', day=97) {
  if(!Object.hasOwn(CHAMBERS,chamber))throw new RangeError('Unknown chamber');
  const env={...environmentAt(hour,config,day)};
  const isDayHeat=hour>=11&&hour<18;
  const isAfternoon=hour>=10&&hour<16;
  if(chamber==='heatPulse'&&isDayHeat){
    env.ambientC+=18;
    env.cellC+=18;
    env.stress=clamp(env.stress+0.28,0,1);
    const normalFactor=1-0.004*(env.cellC-18-25);
    const hotFactor=Math.max(0,1-0.004*(env.cellC-25));
    env.pvW*=hotFactor/normalFactor; // finite PV derating due to higher cell temperature
  }
  if(chamber==='coldSnap'){
    env.ambientC-=24;
    env.cellC-=24;
    const normalFactor=1-0.004*(env.cellC+24-25);
    const coldFactor=Math.max(0,1-0.004*(env.cellC-25));
    env.pvW*=coldFactor/normalFactor;
  }
  if(chamber==='clouds'&&isAfternoon){
    env.pvW*=0.18;
    env.irradiance*=0.18;
  }
  if(chamber==='pvOutage'&&hour>=10&&hour<14){
    env.pvW=0;
    env.irradiance=0;
  }
  if(chamber==='demandSurge'&&hour>=16&&hour<21)env.loadW*=2.4;
  return env;
}
function observedSignals(plant,env,chamber) {
  const bias=chamber==='sensorDrift'?18:0;
  return {
    plant:{batteryWh:plant.batteryWh,coreC:plant.coreC+bias},
    env:{...env,ambientC:env.ambientC+bias}
  };
}
function learnedMode(scores,key) {
  const values=scores[key];
  if(!values)return 'balanced';
  return MODE_NAMES.reduce((best,next)=>values[next]>values[best]?next:best,MODE_NAMES[0]);
}
export function selectController(controller,plant,env,config,policy,chamber='baseline') {
  if(!Object.hasOwn(CONTROLLERS,controller))throw new RangeError('Unknown controller');
  const observed=observedSignals(plant,env,chamber);
  const p=observed.plant,e=observed.env;
  if(controller==='fixed')return 'balanced';
  if(controller==='rules')return ruleMode(p,e,config);
  if(controller==='learned')return learnedMode(policy,contextKey(p,e,config));
  if(p.coreC>51)return 'protect';
  if(p.batteryWh/config.batteryWh<0.28)return 'eco';
  if(e.loadW>315&&p.batteryWh/config.batteryWh>0.48)return 'boost';
  return e.loadW>170?'balanced':'eco';
}
export function simulateArena(input={},controller='rules',policy=null) {
  if(!Object.hasOwn(CONTROLLERS,controller))throw new RangeError('Unknown controller');
  const options=normalizeArenaOptions(input);
  const cfg=options.config;
  const effectiveConfig={...cfg,batteryWh:cfg.batteryWh*(options.chamber==='batteryFade'?0.6:1)};
  const cooling=COATINGS[options.coating].thermalTransferFactor;
  const learnedPolicy=policy??trainController(cfg);
  let plant=initialPlant(effectiveConfig);
  const startWh=plant.batteryWh;
  const totals={
    solarWh:0,demandWh:0,servedWh:0,unservedWh:0,lossWh:0,spilledWh:0,
    chargingWh:0,dischargingWh:0,residualWh:0,thermalAlarmSteps:0
  };
  const trace=[];
  for(let i=0;i<288;i++){
    const hour=(i+0.5)/12;
    const env=chamberEnvironment(hour,cfg,options.chamber,97+(options.trialSeed%83));
    const mode=selectController(controller,plant,env,effectiveConfig,learnedPolicy,options.chamber);
    const step=stepPlant(plant,mode,env,effectiveConfig,STEP_HOURS,{thermalTransferFactor:cooling});
    const deliveredWh=step.outputW*STEP_HOURS;
    totals.solarWh+=step.pvW*STEP_HOURS;
    totals.demandWh+=env.loadW*STEP_HOURS;
    totals.servedWh+=deliveredWh;
    totals.unservedWh+=step.unservedW*STEP_HOURS;
    totals.lossWh+=step.lossW*STEP_HOURS;
    totals.spilledWh+=step.curtailW*STEP_HOURS;
    totals.chargingWh+=step.chargeW*STEP_HOURS;
    totals.dischargingWh+=step.dischargeW*STEP_HOURS;
    totals.residualWh+=step.balanceResidualWh;
    if(step.thermalAlarm)totals.thermalAlarmSteps++;
    plant=step.plant;
    const busV=step.outputW>0?DC_BUS_VOLTS:0;
    const busA=busV>0?step.outputW/busV:0;
    trace.push({
      hour,pvW:step.pvW,demandW:env.loadW,deliveredW:step.outputW,
      busV,busA,socPercent:100*plant.batteryWh/effectiveConfig.batteryWh,
      batteryWh:plant.batteryWh,coreC:plant.coreC,ambientC:env.ambientC,
      observedCoreC:plant.coreC+(options.chamber==='sensorDrift'?18:0),
      irradiance:env.irradiance,mode
    });
  }
  totals.batteryStartWh=startWh;
  totals.batteryEndWh=plant.batteryWh;
  totals.reliability=totals.demandWh?totals.servedWh/totals.demandWh:1;
  totals.thermalAlarmMinutes=totals.thermalAlarmSteps*5;
  totals.energyResidualWh=totals.solarWh+totals.batteryStartWh
    -totals.servedWh-totals.spilledWh-totals.lossWh-totals.batteryEndWh;
  return {controller,options,totals,trace,model:'phi-adaptive-arena-v2'};
}
export function runArena(input={}) {
  const options=normalizeArenaOptions(input);
  // Each competitor uses the exact same frozen policy trained on eight baseline
  // synthetic days. Chamber faults only occur during held-out evaluation.
  const policy=trainController(options.config);
  const runs=Object.fromEntries(Object.keys(CONTROLLERS).map(controller=>
    [controller,simulateArena({...options.config,chamber:options.chamber,
      coating:options.coating,trialSeed:options.trialSeed},controller,policy)]));
  const rankings=Object.keys(CONTROLLERS).sort((a,b)=>{
    const ta=runs[a].totals,tb=runs[b].totals;
    return tb.servedWh-ta.servedWh || ta.thermalAlarmSteps-tb.thermalAlarmSteps ||
      ta.lossWh-tb.lossWh || a.localeCompare(b);
  });
  return {options,trainingDays:8,runs,rankings,policy};
}
export function runTournament(input={},seeds=3) {
  const options=normalizeArenaOptions(input);
  const sampleCount=Math.round(finite(seeds,3,1,9));
  const cases=Object.keys(CHAMBERS);
  const totals=Object.fromEntries(Object.keys(CONTROLLERS).map(c=>[c,{
    servedWh:0,demandWh:0,lossWh:0,alarms:0,residualWh:0
  }]));
  const rows=[];
  for(const chamber of cases){
    const scores=Object.fromEntries(Object.keys(CONTROLLERS).map(c=>[c,{
      servedWh:0,demandWh:0,lossWh:0,alarms:0
    }]));
    for(let offset=0;offset<sampleCount;offset++){
      const trialSeed=options.trialSeed+offset;
      const trial=runArena({...options.config,chamber,coating:options.coating,trialSeed});
      for(const controller of Object.keys(CONTROLLERS)){
        const t=trial.runs[controller].totals,s=scores[controller],overall=totals[controller];
        s.servedWh+=t.servedWh;s.demandWh+=t.demandWh;s.lossWh+=t.lossWh;s.alarms+=t.thermalAlarmSteps;
        overall.servedWh+=t.servedWh;overall.demandWh+=t.demandWh;
        overall.lossWh+=t.lossWh;overall.alarms+=t.thermalAlarmSteps;
        overall.residualWh+=t.energyResidualWh;
      }
    }
    const sorted=Object.keys(CONTROLLERS).sort((a,b)=>scores[b].servedWh-scores[a].servedWh||
      scores[a].alarms-scores[b].alarms||scores[a].lossWh-scores[b].lossWh||a.localeCompare(b));
    rows.push({chamber,winner:sorted[0],scores});
  }
  const ranking=Object.keys(CONTROLLERS).sort((a,b)=>totals[b].servedWh-totals[a].servedWh||
    totals[a].alarms-totals[b].alarms||totals[a].lossWh-totals[b].lossWh||a.localeCompare(b));
  return {options,cases:rows,seeds:sampleCount,totals,ranking};
}
