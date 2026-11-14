/**
 * Φ Circuit Lab: ideal resistive-DC topology solver.
 *
 * Wires are ideal (zero resistance), resistors obey Ohm's law, and the only
 * independent source fixes V+ relative to GND. Ideal switches are either
 * open (nonconducting) or closed (zero resistance). This is NOT SPICE.
 * A source-to-ground wire is flagged as an ideal short, never simulated as
 * an infinite current value.
 *
 * Endpoints: "V+", "GND", resistor/switch terminals and "D1:a"/"D1:b".
 * The LED model uses a fixed forward threshold plus a slope resistance.
 * Input data is validated before use, including imported JSON.
 */
import { LED_FORWARD_V, solveLedNetwork } from './wiring-diode-solver.mjs';

export const MAX_RESISTORS = 8;
export const MAX_LEDS = 3;
export const MAX_SWITCHES = 4;
export const MAX_WIRES = 40;
const ID_PATTERN = /^R[1-9][0-9]?$/;
const SWITCH_ID_PATTERN = /^S[1-9][0-9]?$/;
const LED_ID_PATTERN = /^D[1-9][0-9]?$/;

function assertFinite(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(name + ' must be a finite number from ' + min + ' to ' + max);
  }
}
const connection = (a,b) => ({a,b});
const part = (id,ohms,x,y) => ({id,ohms,x,y});

export function presetCircuit(kind = 'series') {
  const supplyV = ['led','reverse-led','led-unlimited'].includes(kind)?5:9;
  let parts, wires, leds=[];
  if (kind === 'series') {
    parts = [part('R1',1000,330,165),part('R2',1000,600,165)];
    wires = [connection('V+','R1:a'),connection('R1:b','R2:a'),connection('R2:b','GND')];
  } else if (kind === 'parallel') {
    parts = [part('R1',1000,400,138),part('R2',1000,400,325)];
    wires = [connection('V+','R1:a'),connection('V+','R2:a'),
      connection('R1:b','GND'),connection('R2:b','GND')];
  } else if (kind === 'divider') {
    parts = [part('R1',2000,315,160),part('R2',1000,570,160),part('R3',1000,570,330)];
    wires = [connection('V+','R1:a'),connection('R1:b','R2:a'),
      connection('R1:b','R3:a'),connection('R2:b','GND'),connection('R3:b','GND')];
  } else if (kind === 'open') {
    parts = [part('R1',1000,365,190),part('R2',1000,625,320)];
    wires = [];
  } else if (kind === 'switch') {
    parts = [part('R1',1000,635,170)];
    wires = [connection('V+','S1:a'),connection('S1:b','R1:a'),connection('R1:b','GND')];
  } else if (kind === 'led') {
    parts=[part('R1',330,365,170)];
    leds=[{id:'D1',color:'red',x:635,y:170}];
    wires=[connection('V+','R1:a'),connection('R1:b','D1:a'),connection('D1:b','GND')];
  } else if (kind === 'reverse-led') {
    parts=[part('R1',330,635,170)];
    leds=[{id:'D1',color:'red',x:365,y:170}];
    wires=[connection('V+','D1:b'),connection('D1:a','R1:a'),connection('R1:b','GND')];
  } else if (kind === 'led-unlimited') {
    parts=[];
    leds=[{id:'D1',color:'red',x:450,y:170}];
    wires=[connection('V+','D1:a'),connection('D1:b','GND')];
  } else {
    throw new RangeError('Unknown circuit example');
  }
  return {version:1,supplyV,parts,wires,leds,
    switches:kind==='switch'?[{id:'S1',closed:false,x:345,y:170}]:[]};
}
export function validateCircuit(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Circuit document must be an object');
  if (input.version !== 1) throw new RangeError('Unsupported circuit document version');
  assertFinite(input.supplyV,'Supply',0,24);
  if (!Array.isArray(input.parts) || input.parts.length > MAX_RESISTORS) {
    throw new RangeError('A circuit must have at most ' + MAX_RESISTORS + ' resistors');
  }
  if (!Array.isArray(input.wires) || input.wires.length > MAX_WIRES) {
    throw new RangeError('A circuit must have at most ' + MAX_WIRES + ' wires');
  }
  // Pre-v0.4 documents omit switches. Preserve import compatibility.
  const inputSwitches=input.switches===undefined?[]:input.switches;
  if(!Array.isArray(inputSwitches)||inputSwitches.length>MAX_SWITCHES){
    throw new RangeError('Circuit must have at most '+MAX_SWITCHES+' switches');
  }
  // Older v0.3/v0.4 designs do not contain LEDs.
  const inputLeds=input.leds===undefined?[]:input.leds;
  if(!Array.isArray(inputLeds)||inputLeds.length>MAX_LEDS){
    throw new RangeError('Circuit must contain at most '+MAX_LEDS+' LEDs');
  }
  const ids = new Set();
  const parts = input.parts.map((p) => {
    if (!p || typeof p !== 'object' || !ID_PATTERN.test(p.id) || ids.has(p.id)) {
      throw new RangeError('Each resistor needs a unique R1–R99 identifier');
    }
    ids.add(p.id);
    assertFinite(p.ohms,p.id + ' resistance',1,1e7);
    assertFinite(p.x,p.id + ' x position',120,830);
    assertFinite(p.y,p.id + ' y position',75,425);
    return {id:p.id,ohms:p.ohms,x:p.x,y:p.y};
  });
  const switches=inputSwitches.map(sw=>{
    if(!sw||typeof sw!=='object'||!SWITCH_ID_PATTERN.test(sw.id)||ids.has(sw.id)){
      throw new RangeError('Each switch needs a unique S1–S99 identifier');
    }
    if(typeof sw.closed!=='boolean')throw new TypeError('Switch state must be a boolean');
    ids.add(sw.id);
    assertFinite(sw.x,sw.id+' x position',120,830);
    assertFinite(sw.y,sw.id+' y position',75,425);
    return {id:sw.id,closed:sw.closed,x:sw.x,y:sw.y};
  });
  const leds=inputLeds.map(d=>{
    if(!d||typeof d!=='object'||!LED_ID_PATTERN.test(d.id)||ids.has(d.id)){
      throw new RangeError('Each LED needs a unique D1–D99 identifier');
    }
    if(!Object.hasOwn(LED_FORWARD_V,d.color))throw new RangeError('Unsupported LED color');
    ids.add(d.id);
    assertFinite(d.x,d.id+' x position',120,830);
    assertFinite(d.y,d.id+' y position',75,425);
    return {id:d.id,color:d.color,x:d.x,y:d.y};
  });
  const valid = new Set(['V+','GND']);
  for (const p of [...parts,...switches,...leds]) {
    valid.add(p.id + ':a');
    valid.add(p.id + ':b');
  }
  const seen = new Set();
  const wires = input.wires.map(w => {
    if (!w || typeof w !== 'object' || !valid.has(w.a) || !valid.has(w.b) || w.a === w.b) {
      throw new RangeError('Wire references invalid, identical or missing endpoints');
    }
    const key = [w.a,w.b].sort().join('|');
    if (seen.has(key)) throw new RangeError('Duplicate wire connection');
    seen.add(key);
    return {a:w.a,b:w.b};
  });
  return {version:1,supplyV:input.supplyV,parts,switches,leds,wires};
}

function gaussianSolve(matrix, rhs) {
  // Partial pivoting; the matrix is symmetric positive definite whenever
  // each solved resistor component is anchored to at least one source net.
  const n=rhs.length;
  const a=matrix.map((row,i)=>[...row,rhs[i]]);
  for (let col=0;col<n;col++){
    let pivot=col;
    for(let row=col+1;row<n;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
    if(Math.abs(a[pivot][col])<1e-15) throw new Error('Circuit equations are singular or ill-conditioned');
    [a[pivot],a[col]]=[a[col],a[pivot]];
    const div=a[col][col];
    for(let j=col;j<=n;j++)a[col][j]/=div;
    for(let row=0;row<n;row++){
      if(row===col)continue;
      const factor=a[row][col];
      for(let j=col;j<=n;j++)a[row][j]-=factor*a[col][j];
    }
  }
  return a.map(row=>row[n]);
}

/**
 * @returns {{
 *  status:'ok'|'open'|'short', sourceCurrentA:number|null,
 *  equivalentOhms:number|null, parts:Array, notices:string[], nodeVoltages:object
 * }}
 */
export function solveCircuit(document) {
  const doc=validateCircuit(document);
  if(doc.leds.length)return solveLedNetwork(doc);
  const terminals = ['V+','GND',...[...doc.parts,...doc.switches].flatMap(p=>[p.id+':a',p.id+':b'])];
  const parent=new Map(terminals.map(t=>[t,t]));
  const find=x=>{
    let a=x;
    while(parent.get(a)!==a)a=parent.get(a);
    while(parent.get(x)!==x){const next=parent.get(x);parent.set(x,a);x=next;}
    return a;
  };
  const union=(a,b)=>{const ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra);};
  for(const w of doc.wires) union(w.a,w.b);
  for(const sw of doc.switches)if(sw.closed)union(sw.id+':a',sw.id+':b');
  const source=find('V+'),ground=find('GND');
  const blank=doc.parts.map(p=>({
    id:p.id,ohms:p.ohms,currentA:null,voltageV:null,powerW:null,state:'unresolved'
  }));
  const switchResults=()=>doc.switches.map(sw=>({
    id:sw.id,closed:sw.closed,state:sw.closed?'closed':'open'
  }));
  if(source===ground){
    return {status:'short',sourceCurrentA:null,equivalentOhms:null,parts:blank,
      leds:[],switches:switchResults(),nodeVoltages:{},
      notices:['Ideal short: wires and/or closed switches join V+ directly to GND. Break that path before calculating current.']};
  }
  const edgeList=doc.parts.map((p,i)=>({partIndex:i,a:find(p.id+':a'),b:find(p.id+':b'),conductance:1/p.ohms}));
  const adjacency=new Map();
  for(const node of new Set([source,ground,...edgeList.flatMap(e=>[e.a,e.b])]))adjacency.set(node,new Set());
  for(const e of edgeList){
    if(e.a!==e.b){adjacency.get(e.a).add(e.b);adjacency.get(e.b).add(e.a);}
  }
  const voltages=new Map([[source,doc.supplyV],[ground,0]]);
  const floating=new Set();
  const visited=new Set();
  const groups=[];
  for(const initial of adjacency.keys()){
    if(visited.has(initial))continue;
    const queue=[initial],nodes=[];
    visited.add(initial);
    for(let i=0;i<queue.length;i++){
      const v=queue[i];nodes.push(v);
      for(const neighbor of adjacency.get(v)){
        if(!visited.has(neighbor)){visited.add(neighbor);queue.push(neighbor);}
      }
    }
    groups.push(nodes);
  }
  let powered=false;
  for(const nodes of groups){
    const set=new Set(nodes),hasSource=set.has(source),hasGround=set.has(ground);
    if(!hasSource&&!hasGround){
      nodes.forEach(n=>floating.add(n));
      continue;
    }
    if(hasSource&&!hasGround){nodes.forEach(n=>voltages.set(n,doc.supplyV));continue;}
    if(hasGround&&!hasSource){nodes.forEach(n=>voltages.set(n,0));continue;}
    powered=true;
    const internal=nodes.filter(n=>n!==source&&n!==ground);
    const indexes=new Map(internal.map((n,i)=>[n,i]));
    const A=Array.from({length:internal.length},()=>Array(internal.length).fill(0));
    const b=Array(internal.length).fill(0);
    for(const e of edgeList){
      if(e.a===e.b||!set.has(e.a)||!set.has(e.b))continue;
      for(const [here,there] of [[e.a,e.b],[e.b,e.a]]){
        if(!indexes.has(here))continue;
        const i=indexes.get(here),g=e.conductance;
        A[i][i]+=g;
        if(indexes.has(there))A[i][indexes.get(there)]-=g;
        else b[i]+=g*(there===source?doc.supplyV:0);
      }
    }
    const values=gaussianSolve(A,b);
    internal.forEach((n,i)=>voltages.set(n,values[i]));
  }
  const parts=edgeList.map(e=>{
    const p=doc.parts[e.partIndex];
    if(e.a===e.b)return {id:p.id,ohms:p.ohms,currentA:0,voltageV:0,powerW:0,state:'bypassed'};
    if(floating.has(e.a)||floating.has(e.b)){
      return {id:p.id,ohms:p.ohms,currentA:null,voltageV:null,powerW:null,state:'floating'};
    }
    const delta=voltages.get(e.a)-voltages.get(e.b);
    const currentA=delta/p.ohms;
    return {id:p.id,ohms:p.ohms,currentA,voltageV:delta,powerW:currentA*currentA*p.ohms,
      state:Math.abs(currentA)<1e-12?'inactive':'active'};
  });
  let sourceCurrentA=0;
  for(const e of edgeList){
    if(e.a===e.b||!voltages.has(e.a)||!voltages.has(e.b))continue;
    const pa=voltages.get(e.a),pb=voltages.get(e.b);
    if(e.a===source) sourceCurrentA+=(pa-pb)*e.conductance;
    if(e.b===source) sourceCurrentA+=(pb-pa)*e.conductance;
  }
  sourceCurrentA=Math.max(0,sourceCurrentA);
  const notices=[];
  if(!powered)notices.push('Open circuit: no resistor path connects V+ and GND through closed switches.');
  if(parts.some(p=>p.state==='bypassed'))notices.push('A resistor has both terminals connected by ideal wires and is bypassed.');
  if(parts.some(p=>p.state==='floating'))notices.push('Some components are floating: not connected to either supply terminal.');
  if(parts.some(p=>p.state==='inactive')&&powered)notices.push('Some components draw no DC current. They may be in dangling branches.');
  if(parts.some(p=>p.powerW!==null&&p.powerW>.25))notices.push('One or more resistors exceed 0.25 W in this model. Real part ratings vary.');
  const nodeVoltages=Object.fromEntries([...voltages.entries()]);
  return {status:powered?'ok':'open',sourceCurrentA,equivalentOhms:
    powered&&sourceCurrentA>1e-12&&doc.supplyV>0?doc.supplyV/sourceCurrentA:null,
    parts,leds:[],switches:switchResults(),nodeVoltages,notices};
}
