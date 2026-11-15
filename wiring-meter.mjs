/**
 * Φ Circuit Lab v0.6: independent virtual meter readings.
 *
 * Voltage mode is a hypothetical infinite-input-impedance DC voltmeter:
 * it observes, but never changes, the solved circuit.
 *
 * Continuity mode intentionally traces ONLY ideal wires and closed switches.
 * It represents a de-energized connection check, NOT an ohmmeter that
 * measures resistor networks or real-world buzzer thresholds.
 *
 * Current mode inspects a resistor/LED branch result from the solver.
 * It is NOT a series-inserted physical ammeter. Individual ideal-wire
 * and ideal-switch currents are intentionally unavailable.
 */
import { validateCircuit } from './wiring-solver.mjs';

export const METER_MODES=Object.freeze(['voltage','continuity','current']);

export function meterTerminals(document) {
  const doc=validateCircuit(document);
  return ['V+','GND',...[...doc.parts,...doc.switches,...doc.leds].flatMap(p=>[p.id+':a',p.id+':b'])];
}

function verifyTerminalList(doc,red,black) {
  const possible=new Set(meterTerminals(doc));
  if(!possible.has(red)||!possible.has(black)){
    throw new RangeError('Meter probe references unknown circuit terminal');
  }
}
function response(mode,status,value,unit,details) {
  return {mode,status,value,unit,details};
}

export function measureVoltage(document,result,red,black) {
  const doc=validateCircuit(document);
  verifyTerminalList(doc,red,black);
  if(!result||result.status==='short'||result.status==='unsolved'){
    return response('voltage','unavailable',null,'V','Circuit is shorted or unresolved; voltage probes have no reliable reading.');
  }
  if(!result.terminalVoltages) {
    return response('voltage','unavailable',null,'V','The circuit result contains no terminal voltage readings.');
  }
  const a=result.terminalVoltages[red],b=result.terminalVoltages[black];
  if(typeof a!=='number'||!Number.isFinite(a)||typeof b!=='number'||!Number.isFinite(b)){
    return response('voltage','floating',null,'V','At least one probe is on an electrically floating terminal. Absolute voltage is undefined.');
  }
  const difference=a-b;
  return response('voltage','ok',Math.abs(difference)<1e-12?0:difference,'V',
    'Ideal DC difference: red ('+red+') minus black ('+black+'). The probe does not load the circuit.');
}

export function traceContinuity(document,red,black) {
  const doc=validateCircuit(document);
  verifyTerminalList(doc,red,black);
  const all=meterTerminals(doc);
  const parent=new Map(all.map(t=>[t,t]));
  function find(v){
    let a=v;
    while(parent.get(a)!==a)a=parent.get(a);
    while(parent.get(v)!==v){const n=parent.get(v);parent.set(v,a);v=n;}
    return a;
  }
  const join=(a,b)=>{const x=find(a),y=find(b);if(x!==y)parent.set(y,x);};
  for(const w of doc.wires)join(w.a,w.b);
  for(const sw of doc.switches)if(sw.closed)join(sw.id+':a',sw.id+':b');
  const connected=find(red)===find(black);
  return response('continuity',connected?'connected':'disconnected',connected, 'boolean',
    connected?
      'Ideal 0 Ω path through wires and closed switches only. The voltage source and components do not count.':
      'No ideal 0 Ω path between these terminals. A resistor or LED between them is NOT treated as a wire.');
}

export function inspectBranchCurrent(document,result,id) {
  const doc=validateCircuit(document);
  const resistor=doc.parts.some(p=>p.id===id);
  const led=doc.leds.some(p=>p.id===id);
  const sw=doc.switches.some(p=>p.id===id);
  if(!resistor&&!led&&!sw)throw new RangeError('Unknown current inspection component');
  if(sw){
    return response('current','unavailable',null,'A',
      'An ideal switch has no uniquely determined branch current when parallel ideal paths exist. Inspect resistor or LED current instead.');
  }
  if(!result||result.status==='short'||result.status==='unsolved'){
    return response('current','unavailable',null,'A','This circuit has no reliable branch-current solution.');
  }
  const p=(resistor?result.parts:result.leds)?.find(x=>x.id===id);
  if(!p||typeof p.currentA!=='number'||!Number.isFinite(p.currentA)){
    return response('current','floating',null,'A','This part has no well-defined DC current in the solved model.');
  }
  return response('current','ok',Math.abs(p.currentA)<1e-12?0:p.currentA,'A',
    'Signed branch current from '+id+':a to '+id+':b. This is a solver inspection, not an inserted physical ammeter.');
}
