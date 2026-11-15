/**
 * PhiCircuitLab v1.1 • Small 12-column solderless breadboard with a real
 * topology adapter to the existing educational DC resistor/switch/LED solver.
 *
 * Each column's A–E strip is internally tied. The F–J strip in the same
 * column is separate across the center trench. P and N are full-length,
 * independent power rails. Neither rail is powered until a jumper connects
 * V+/GND to it. A jumper joins copper nets; a component does NOT.
 *
 * Breadboard geometry is an education-oriented miniature, not a claim that
 * every commercial breadboard has full-length unbroken power rails.
 */
import {
  MAX_RESISTORS, MAX_SWITCHES, MAX_LEDS, MAX_WIRES,
  validateCircuit, solveCircuit
} from './wiring-solver.mjs';

export const BREADBOARD_STORAGE_KEY='phi-circuit-lab-breadboard-v1';
export const BOARD_COLS=12;
export const BOARD_ROWS='ABCDEFGHIJ';
export const BOARD_SUPPLY_TERMINALS=Object.freeze(['V+','GND']);
export const BOARD_HOLES=Object.freeze([
  ...['P','N',...BOARD_ROWS].flatMap(row=>
    Array.from({length:BOARD_COLS},(_,i)=>row+(i+1)))
]);
const CONTACTS=new Set(BOARD_HOLES);
const JACKS=new Set(BOARD_SUPPLY_TERMINALS);
const CONTACT_OR_JACK=new Set([...BOARD_HOLES,...BOARD_SUPPLY_TERMINALS]);
const LED_COLORS=new Set(['red','green','blue']);
const PART_PATTERN={resistor:/^R[1-9][0-9]?$/,switch:/^S[1-9][0-9]?$/,led:/^D[1-9][0-9]?$/};
const key=(a,b)=>[a,b].sort().join('|');
const copy=obj=>JSON.parse(JSON.stringify(obj));
const requireHole=x=>{
  if(!CONTACTS.has(x))throw new RangeError('Unknown breadboard hole');
  return x;
};
const requireContact=x=>{
  if(!CONTACT_OR_JACK.has(x))throw new RangeError('Unknown breadboard contact');
  return x;
};
const requireFinite=(v,min,max,label)=>{
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)
    throw new RangeError(label+' must be finite from '+min+' to '+max);
  return v;
};
function validatedPart(obj,kind){
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||
    !PART_PATTERN[kind].test(obj.id))
    throw new RangeError('Invalid breadboard '+kind+' identifier');
  const a=requireHole(obj.a),b=requireHole(obj.b);
  if(a===b)throw new RangeError('A component needs two distinct contact holes');
  const part={id:obj.id,a,b};
  if(kind==='resistor')part.ohms=requireFinite(obj.ohms,1,1e7,'Resistance');
  if(kind==='switch'){
    if(typeof obj.closed!=='boolean')throw new RangeError('Switch state must be true/false');
    part.closed=obj.closed;
  }
  if(kind==='led'){
    if(!LED_COLORS.has(obj.color))throw new RangeError('Unsupported LED color');
    part.color=obj.color;
  }
  return part;
}
function allParts(doc){
  return [...doc.parts,...doc.switches,...doc.leds];
}
export function blankBreadboard(){
  return {version:1,supplyV:5,parts:[],switches:[],leds:[],wires:[]};
}
export function validateBreadboard(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1)
    throw new RangeError('Unsupported breadboard document');
  const supplyV=requireFinite(raw.supplyV,0,24,'Source voltage');
  const names=[['parts','resistor',MAX_RESISTORS],
    ['switches','switch',MAX_SWITCHES],['leds','led',MAX_LEDS]];
  const out={version:1,supplyV,parts:[],switches:[],leds:[],wires:[]};
  const ids=new Set(),legHoles=new Set();
  for(const [plural,kind,limit] of names){
    const entries=raw[plural];
    if(!Array.isArray(entries)||entries.length>limit)
      throw new RangeError('Too many '+plural+' or invalid list');
    out[plural]=entries.map(entry=>{
      const p=validatedPart(entry,kind);
      if(ids.has(p.id))throw new RangeError('Duplicate component ID');
      if(legHoles.has(p.a)||legHoles.has(p.b))
        throw new RangeError('A component already occupies one of those holes');
      ids.add(p.id);legHoles.add(p.a);legHoles.add(p.b);
      return p;
    });
  }
  if(!Array.isArray(raw.wires)||raw.wires.length>MAX_WIRES)
    throw new RangeError('Maximum 40 breadboard jumpers');
  const seen=new Set();
  out.wires=raw.wires.map(w=>{
    if(!w||typeof w!=='object')throw new RangeError('Invalid jumper');
    const a=requireContact(w.a),b=requireContact(w.b);
    if(a===b||seen.has(key(a,b)))
      throw new RangeError('Duplicate or self-connected jumper');
    seen.add(key(a,b));
    return {a,b};
  });
  return out;
}
export function createBreadboardExample(kind='led'){
  const doc=blankBreadboard();
  if(kind==='blank')return doc;
  if(kind==='resistor'){
    doc.supplyV=9;
    doc.parts=[{id:'R1',a:'E3',b:'F3',ohms:1000}];
    doc.wires=[
      {a:'V+',b:'P1'},{a:'GND',b:'N1'},
      {a:'P3',b:'A3'},{a:'J3',b:'N3'}
    ];
  }else if(kind==='led'||kind==='reverse-led'){
    doc.parts=[{id:'R1',a:'E3',b:'F3',ohms:330}];
    doc.leds=[{id:'D1',a:kind==='led'?'E5':'F5',
      b:kind==='led'?'F5':'E5',color:'red'}];
    doc.wires=[
      {a:'V+',b:'P1'},{a:'GND',b:'N1'},
      {a:'P3',b:'A3'},{a:'J3',b:'A5'},{a:'J5',b:'N5'}
    ];
  }else if(kind==='switch'){
    doc.supplyV=9;
    doc.parts=[{id:'R1',a:'E6',b:'F6',ohms:1000}];
    doc.switches=[{id:'S1',a:'E3',b:'F3',closed:false}];
    doc.wires=[
      {a:'V+',b:'P1'},{a:'GND',b:'N1'},
      {a:'P3',b:'A3'},{a:'J3',b:'A6'},{a:'J6',b:'N6'}
    ];
  }else if(kind==='parallel'){
    doc.supplyV=9;
    doc.parts=[
      {id:'R1',a:'E3',b:'F3',ohms:1000},
      {id:'R2',a:'E8',b:'F8',ohms:2000}
    ];
    doc.wires=[
      {a:'V+',b:'P1'},{a:'GND',b:'N1'},
      {a:'P3',b:'A3'},{a:'P8',b:'A8'},
      {a:'J3',b:'N3'},{a:'J8',b:'N8'}
    ];
  }else throw new RangeError('Unknown breadboard example');
  return validateBreadboard(doc);
}

class UnionFind {
  constructor(items){this.parent=new Map(items.map(x=>[x,x]));}
  find(x){
    if(!this.parent.has(x))throw new RangeError('Unknown node '+x);
    let a=x;while(a!==this.parent.get(a))a=this.parent.get(a);
    let v=x;while(v!==a){const next=this.parent.get(v);this.parent.set(v,a);v=next;}
    return a;
  }
  union(a,b){const ra=this.find(a),rb=this.find(b);if(ra!==rb)this.parent.set(rb,ra);}
}
function copperTopology(doc){
  const terminals=['V+','GND',...allParts(doc).flatMap(p=>[p.id+':a',p.id+':b'])];
  const nodes=[...CONTACT_OR_JACK,...terminals.filter(t=>!JACKS.has(t))];
  const uf=new UnionFind(nodes);
  for(let col=1;col<=BOARD_COLS;col++){
    for(const row of 'BCDE')uf.union('A'+col,row+col);
    for(const row of 'GHIJ')uf.union('F'+col,row+col);
    if(col>1){
      uf.union('P1','P'+col);
      uf.union('N1','N'+col);
    }
  }
  for(const w of doc.wires)uf.union(w.a,w.b);
  for(const p of allParts(doc)){
    uf.union(p.a,p.id+':a');
    uf.union(p.b,p.id+':b');
  }
  return {uf,terminals};
}
function resultCircuit(doc,topology){
  const {uf,terminals}=topology;
  const byNet=new Map();
  for(const t of terminals){
    const net=uf.find(t);
    if(!byNet.has(net))byNet.set(net,[]);
    byNet.get(net).push(t);
  }
  const wires=[];
  for(const group of byNet.values()){
    for(let j=1;j<group.length;j++)wires.push({a:group[0],b:group[j]});
  }
  if(wires.length>MAX_WIRES)
    throw new RangeError('Too many underlying solver connection edges');
  const components=doc.parts.map((p,i)=>({id:p.id,ohms:p.ohms,x:260+(i%4)*125,y:148+Math.floor(i/4)*155}));
  const switches=doc.switches.map((p,i)=>({id:p.id,closed:p.closed,x:300+i*120,y:265}));
  const leds=doc.leds.map((p,i)=>({id:p.id,color:p.color,x:350+i*130,y:355}));
  return validateCircuit({version:1,supplyV:doc.supplyV,parts:components,switches,leds,wires});
}
export function breadboardToCircuit(input){
  const doc=validateBreadboard(input);
  return resultCircuit(doc,copperTopology(doc));
}
export function analyzeBreadboard(input){
  const doc=validateBreadboard(input),topology=copperTopology(doc);
  const circuit=resultCircuit(doc,topology);
  const result=solveCircuit(circuit);
  const terminalsByNet=new Map();
  for(const t of topology.terminals){
    const net=topology.uf.find(t);
    if(!terminalsByNet.has(net))terminalsByNet.set(net,[]);
    terminalsByNet.get(net).push(t);
  }
  function voltageAt(contact){
    requireContact(contact);
    const group=terminalsByNet.get(topology.uf.find(contact))||[];
    for(const t of group){
      const value=result.terminalVoltages?.[t];
      if(typeof value==='number'&&Number.isFinite(value))return value;
    }
    return null;
  }
  function netMembers(contact){
    requireContact(contact);
    const representative=topology.uf.find(contact);
    return [...CONTACT_OR_JACK].filter(h=>topology.uf.find(h)===representative);
  }
  return {document:doc,circuit,result,voltageAt,netMembers};
}
export function measureBreadboardVoltage(doc,red,black){
  const analysis=analyzeBreadboard(doc);
  const rv=analysis.voltageAt(red),bv=analysis.voltageAt(black);
  if(rv===null||bv===null)return {status:'unavailable',voltageV:null,
    message:'At least one point is floating or the DC solver could not resolve the voltage.'};
  return {status:'ok',voltageV:rv-bv,
    message:'Ideal high-impedance virtual voltmeter: red minus black.'};
}
export function traceBreadboardContinuity(input,a,b){
  const doc=validateBreadboard(input);
  requireContact(a);requireContact(b);
  const {uf}=copperTopology(doc);
  for(const sw of doc.switches)if(sw.closed)uf.union(sw.id+':a',sw.id+':b');
  const connected=uf.find(a)===uf.find(b);
  return {status:connected?'connected':'open',connected,
    message:'Ideal direct copper/jumper path including closed switches only. Resistors and LEDs do not count as wires.'};
}

function edit(input,mutate){
  const doc=validateBreadboard(input);
  mutate(doc);
  return validateBreadboard(doc);
}
export function addBoardJumper(input,a,b){
  requireContact(a);requireContact(b);
  return edit(input,doc=>{doc.wires.push({a,b});});
}
export function addBoardPart(input,kind,a,b){
  requireHole(a);requireHole(b);
  if(!['resistor','switch','led'].includes(kind))throw new RangeError('Unknown component type');
  return edit(input,doc=>{
    const [collection,prefix]=kind==='resistor'?['parts','R']:
      kind==='switch'?['switches','S']:['leds','D'];
    let n=1;while(doc[collection].some(p=>p.id===prefix+n))n++;
    const part={id:prefix+n,a,b};
    if(kind==='resistor')part.ohms=1000;
    if(kind==='switch')part.closed=false;
    if(kind==='led')part.color='red';
    doc[collection].push(part);
  });
}
export function removeBoardItem(input,kind,id){
  return edit(input,doc=>{
    if(kind==='wire'){
      if(!Number.isInteger(id)||id<0||id>=doc.wires.length)
        throw new RangeError('Unknown jumper');
      doc.wires.splice(id,1);return;
    }
    if(!['part','switch','led'].includes(kind))throw new RangeError('Unknown selected component');
    const collection=kind==='part'?'parts':kind==='switch'?'switches':'leds';
    const idx=doc[collection].findIndex(p=>p.id===id);
    if(idx<0)throw new RangeError('Unknown component');
    doc[collection].splice(idx,1);
  });
}
export function editBoardPart(input,id,changes){
  if(!changes||typeof changes!=='object'||Array.isArray(changes))
    throw new TypeError('Component changes required');
  return edit(input,doc=>{
    const part=allParts(doc).find(p=>p.id===id);
    if(!part)throw new RangeError('Unknown component');
    for(const name of Object.keys(changes)){
      if(!['ohms','color','closed','flip'].includes(name))
        throw new RangeError('Unsupported component parameter');
      if(name==='flip'){if(changes.flip!==true)throw new RangeError('Flip must be true');[part.a,part.b]=[part.b,part.a];}
      else if(!Object.prototype.hasOwnProperty.call(part,name))
        throw new RangeError('This component does not have parameter '+name);
      else part[name]=changes[name];
    }
  });
}
export function setBoardSupply(input,supplyV){
  return edit(input,doc=>{doc.supplyV=supplyV;});
}
