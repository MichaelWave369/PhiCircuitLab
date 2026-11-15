/**
 * Φ Circuit Lab v0.8: sealed diagnostic cases.
 *
 * The student sees a work order and may take only simulated instrument
 * measurements until they have collected evidence and locked a diagnosis.
 * A sealed faulty circuit is never exposed by the presentation API.
 * All measurements use the same validated electrical solvers as Wiring Lab.
 */
import {createMission, evaluateRepair, gradePrediction} from './academy-engine.mjs';
import {solveCircuit} from './wiring-solver.mjs';
import {
  meterTerminals, measureVoltage, traceContinuity, inspectBranchCurrent
} from './wiring-meter.mjs';

const CASE_DEFS=[
  {sourceIndex:0,id:'A',title:'Silent Control Panel',
    report:'A control panel should complete a simple resistor circuit, but its indicator reports no useful output.',
    task:'Investigate its supply and internal test points. Identify the likely cause of the loss of current.'},
  {sourceIndex:2,id:'B',title:'Uneven Module',
    report:'A two-channel module still draws some current, but its outputs are uneven.',
    task:'Measure both branches before deciding which connection or component needs attention.'},
  {sourceIndex:3,id:'C',title:'Unexpected Standby',
    report:'An operator reports the output remains inactive after the module is connected to its source.',
    task:'Check the switch contacts and the modeled resistor path.'},
  {sourceIndex:4,id:'D',title:'Dark Status Lamp',
    report:'The status LED is not lighting, despite a supplied DC network.',
    task:'Compare the voltage polarity and modeled current across the LED.'},
  {sourceIndex:5,id:'E',title:'Warning on Indicator',
    report:'A status LED lights but the bench reports a possible operating-limit problem.',
    task:'Examine the branch current and the series resistor drop.'},
  {sourceIndex:6,id:'F',title:'Blue Indicator Offline',
    report:'A blue indicator has power connected but remains dark.',
    task:'Probe the supply and LED before judging its component or source.'},
  {sourceIndex:7,id:'G',title:'Safety Shutdown',
    report:'The measurement solver refuses ordinary DC readings from this module.',
    task:'Use non-powered continuity tracing to check whether an ideal conductor bypasses a load.'},
  {sourceIndex:8,id:'H',title:'Last Shift Service Call',
    report:'An operator tried one simple fix but the module still does not produce current.',
    task:'Use measurements to test more than one possible interruption.'}
];
export const MYSTERY_CASE_COUNT=CASE_DEFS.length;
export const MYSTERY_CATALOG=Object.freeze(CASE_DEFS.map(({sourceIndex,...publicFields})=>Object.freeze(publicFields)));
export const MIN_UNIQUE_MEASUREMENTS=2;

function requireCase(seed,index){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('Mystery run seed must be uint32');
  if(!Number.isInteger(index)||index<0||index>=MYSTERY_CASE_COUNT)
    throw new RangeError('Mystery case index out of range');
  const def=CASE_DEFS[index];
  const mission=createMission(seed,def.sourceIndex);
  return {seed,index,mission,def};
}
export function createMysteryCase(seed,index){
  const {mission,def}=requireCase(seed,index);
  return {seed,index,id:def.id,title:def.title,report:def.report,task:def.task,
    // These terminal/part names describe test points, not their connectivity.
    terminals:meterTerminals(mission.initial),
    parts:[...mission.initial.parts.map(p=>p.id),...mission.initial.leds.map(p=>p.id),
      ...mission.initial.switches.map(p=>p.id)]};
}
export function getFaultedRepairDocument(seed,index){
  return structuredClone(requireCase(seed,index).mission.initial);
}
export function getCaseDiagnosis(seed,index){
  const mission=requireCase(seed,index).mission;
  return {correctId:mission.diagnosis,goal:mission.goal,
    hint:mission.hint,reference:structuredClone(mission.reference)};
}
const formatVolt=value=>value.toFixed(3)+' V';
const formatCurrent=value=>(value*1000).toFixed(3)+' mA';
const token=(mode,red,black,part)=>{
  if(mode==='current')return 'current:'+part;
  // Different probe order creates a different signed reading but NOT
  // a new diagnostic location; swapping leads cannot farm evidence points.
  return mode+':'+[red,black].sort().join('|');
};
export function takeMysteryMeasurement(seed,index,request){
  const {mission}=requireCase(seed,index);
  if(!request||typeof request!=='object')throw new TypeError('Measurement request required');
  const {mode,red,black,part}=request;
  const result=solveCircuit(mission.initial);
  let reading;
  if(mode==='voltage')reading=measureVoltage(mission.initial,result,red,black);
  else if(mode==='continuity')reading=traceContinuity(mission.initial,red,black);
  else if(mode==='current')reading=inspectBranchCurrent(mission.initial,result,part);
  else throw new RangeError('Unknown diagnostic meter mode');
  const key=token(mode,red,black,part);
  const readout=mode==='voltage'?
    (reading.status==='ok'?formatVolt(reading.value):'—'):
    mode==='current'?
    (reading.status==='ok'?formatCurrent(reading.value):'—'):
    (reading.value?'CONNECTED':'OPEN');
  const nonSource=mode==='current'||![red,black].every(t=>t==='V+'||t==='GND');
  return Object.freeze({
    key,mode,red:mode==='current'?null:red,black:mode==='current'?null:black,
    part:mode==='current'?part:null,
    status:reading.status,readout,details:reading.details,nonSource
  });
}
export function evidenceProgress(notes){
  if(!Array.isArray(notes))throw new TypeError('Evidence must be an array');
  const unique=new Map();
  for(const note of notes){
    if(!note||typeof note.key!=='string'||typeof note.nonSource!=='boolean')continue;
    if(!unique.has(note.key))unique.set(note.key,note);
  }
  return {count:unique.size,distinctNonSource:[...unique.values()].filter(n=>n.nonSource).length,
    ready:unique.size>=MIN_UNIQUE_MEASUREMENTS&&
      [...unique.values()].some(n=>n.nonSource)};
}
export function judgeMysteryDiagnosis(seed,index,choice,notes){
  const progress=evidenceProgress(notes);
  if(!progress.ready)return {allowed:false,correct:false,
    message:'Record two distinct test-point measurements, including one beyond the supply terminals.'};
  const mission=requireCase(seed,index).mission;
  if(typeof choice!=='string'||!choice)return {allowed:false,correct:false,
    message:'Select a fault diagnosis before opening the repair bench.'};
  return {allowed:true,correct:gradePrediction(mission,choice),
    message:'Diagnosis locked. The circuit is now unsealed for repair.'};
}
export function gradeMysteryRepair(seed,index,doc){
  return evaluateRepair(requireCase(seed,index).mission,doc);
}
export function mysteryScore({correctDiagnosis=false,evidenceCount=0,
  hintUsed=false,failedChecks=0}={}){
  if(!Number.isInteger(evidenceCount)||evidenceCount<0||
    !Number.isInteger(failedChecks)||failedChecks<0)throw new RangeError('Invalid scoring counts');
  // 50 for repair, 30 for correct diagnosis, 20 for >=3 distinct real
  // measurements. Two unique readings are required even to diagnose.
  return Math.max(25,50+(correctDiagnosis?30:0)+(evidenceCount>=3?20:0)-
    (hintUsed?10:0)-Math.min(25,failedChecks*5));
}
