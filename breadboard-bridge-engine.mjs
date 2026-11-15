/**
 * Φ Circuit Lab v1.2 • Auditable schematic-to-breadboard placement planner.
 *
 * Supported: one DC source; up to 12 two-terminal resistor/SPST/LED parts.
 * The miniature board has exactly 12 A–E/F–J column pairs. Each original
 * part occupies E# and F# in a different column. Source nets use independent
 * continuous P/N rails; other wire nets are connected by a jumper tree.
 *
 * The bridge never replaces one circuit model with a second simulation.
 * It verifies the COMPLETE terminal net partition AND the solved electrical
 * behavior against the existing Wiring Lab solver. A status/current match
 * alone is insufficient (two incorrect layouts can draw the same current).
 */
import {validateCircuit,solveCircuit,MAX_WIRES} from './wiring-solver.mjs';
import {
  BOARD_COLS,validateBreadboard,breadboardToCircuit,analyzeBreadboard
} from './breadboard-engine.mjs';

export const BRIDGE_SUPPORTED_PARTS=BOARD_COLS;
export const BRIDGE_STORAGE_VERSION=1;

class UnionFind {
  constructor(items){this.parent=new Map(items.map(x=>[x,x]));}
  find(x){
    if(!this.parent.has(x))throw new RangeError('Unknown schematic terminal '+x);
    let a=x;while(a!==this.parent.get(a))a=this.parent.get(a);
    let here=x;
    while(here!==a){
      const next=this.parent.get(here);this.parent.set(here,a);here=next;
    }
    return a;
  }
  union(a,b){
    const aa=this.find(a),bb=this.find(b);
    if(aa!==bb)this.parent.set(bb,aa);
  }
}
const components=doc=>[...doc.parts,...doc.switches,...doc.leds];
const terminals=doc=>['V+','GND',...components(doc).flatMap(p=>[p.id+':a',p.id+':b'])];
const asNumber=(v)=>typeof v==='number'&&Number.isFinite(v);
const approximate=(a,b)=>{
  if(a===null||b===null)return a===b;
  if(a===undefined||b===undefined)return a===b;
  if(!asNumber(a)||!asNumber(b))return a===b;
  return Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));
};
function circuitNets(doc){
  const all=terminals(doc),uf=new UnionFind(all);
  for(const w of doc.wires)uf.union(w.a,w.b);
  const groups=new Map();
  for(const t of all){
    const root=uf.find(t);
    if(!groups.has(root))groups.set(root,[]);
    groups.get(root).push(t);
  }
  return {all,uf,groups:[...groups.values()]};
}
export function verifyBreadboardEquivalence(sourceInput,boardInput){
  const source=validateCircuit(sourceInput);
  const board=validateBreadboard(boardInput);
  const converted=breadboardToCircuit(board);
  const a=circuitNets(source),b=circuitNets(converted);
  const issues=[];
  const sourceIds=components(source).map(p=>p.id).sort();
  const boardIds=components(converted).map(p=>p.id).sort();
  if(sourceIds.join('|')!==boardIds.join('|'))
    issues.push('Component identity set differs from the source schematic.');
  const compareParts=(left,right,type)=>{
    const mapped=new Map(right.map(p=>[p.id,p]));
    for(const p of left){
      const other=mapped.get(p.id);
      if(!other){issues.push(type+' '+p.id+' is missing.');continue;}
      for(const field of type==='resistor'?['ohms']:type==='switch'?['closed']:['color']){
        if(p[field]!==other[field])issues.push(type+' '+p.id+' changed '+field+'.');
      }
    }
  };
  compareParts(source.parts,converted.parts,'resistor');
  compareParts(source.switches,converted.switches,'switch');
  compareParts(source.leds,converted.leds,'led');
  if(source.supplyV!==converted.supplyV)
    issues.push('Source supply voltage changed.');
  const aKeys=a.all.slice().sort(),bKeys=b.all.slice().sort();
  const sameTerminalSet=aKeys.join('|')===bKeys.join('|');
  if(!sameTerminalSet)issues.push('Terminal sets differ.');
  let netPairsChecked=0;
  if(sameTerminalSet){
    for(let i=0;i<aKeys.length;i++){
      for(let j=i+1;j<aKeys.length;j++){
        const t=aKeys[i],u=aKeys[j];
        netPairsChecked++;
        if((a.uf.find(t)===a.uf.find(u))!==(b.uf.find(t)===b.uf.find(u)))
          issues.push('Net mismatch: '+t+' and '+u+' are not connected equivalently.');
      }
    }
  }
  const original=solveCircuit(source),rebuilt=solveCircuit(converted);
  if(original.status!==rebuilt.status)
    issues.push('Electrical status differs ('+original.status+' vs '+rebuilt.status+').');
  for(const f of ['sourceCurrentA','equivalentOhms']){
    if(!approximate(original[f],rebuilt[f]))
      issues.push('Source '+f+' differs.');
  }
  for(const group of ['parts','switches','leds']){
    const byId=new Map(rebuilt[group].map(p=>[p.id,p]));
    for(const p of original[group]){
      const found=byId.get(p.id);
      if(!found){issues.push(group+' '+p.id+' missing from solver output.');continue;}
      for(const field of ['state','currentA','voltageV','powerW']){
        if((field in p||field in found)&&!approximate(p[field],found[field]))
          issues.push(group+' '+p.id+' changed '+field+'.');
      }
    }
  }
  for(const t of a.all){
    if(!approximate(original.terminalVoltages?.[t],rebuilt.terminalVoltages?.[t]))
      issues.push('Solver terminal voltage differs at '+t+'.');
  }
  return {
    equivalent:issues.length===0,issues,netPairsChecked,
    sourceStatus:original.status,boardStatus:rebuilt.status,
    sourceCurrentA:original.sourceCurrentA,boardCurrentA:rebuilt.sourceCurrentA,
    componentCount:components(source).length,
    sourceNetCount:a.groups.length
  };
}
function holeForTerminal(t,columnById){
  const [id,side]=t.split(':');
  const col=columnById.get(id);
  if(!col||!['a','b'].includes(side))
    throw new RangeError('Cannot place schematic terminal '+t);
  return (side==='a'?'A':'J')+col;
}
export function planBreadboardFromCircuit(sourceInput){
  const source=validateCircuit(sourceInput);
  const parts=components(source);
  if(parts.length>BRIDGE_SUPPORTED_PARTS)
    throw new RangeError('This schematic uses '+parts.length+
      ' components; the 12-column training board supports only 12. Reduce the component count before planning.');
  const electrical=solveCircuit(source);
  if(electrical.status==='short')
    throw new RangeError('An ideal source short cannot be converted to a build guide. Repair the short in Wiring Lab first.');
  const groups=circuitNets(source).groups;
  const col=new Map(),steps=[],mapping=[];
  const board={version:1,supplyV:source.supplyV,parts:[],switches:[],leds:[],wires:[]};
  function step(kind,title,detail,extra={}){
    steps.push({number:steps.length+1,kind,title,detail,...extra});
  }
  step('setup','Prepare a blank 12-column board',
    'Use a continuous P1–P12 rail and separate N1–N12 rail. Set the virtual source to '+source.supplyV+' V. Nothing is powered until jumpers reach its jacks.');
  parts.forEach((p,i)=>{
    const column=i+1,a='E'+column,b='F'+column;
    col.set(p.id,column);
    const {id}=p;
    if(id.startsWith('R'))board.parts.push({id,a,b,ohms:p.ohms});
    else if(id.startsWith('S'))board.switches.push({id,a,b,closed:p.closed});
    else board.leds.push({id,a,b,color:p.color});
    mapping.push({id,column,a,b,kind:id.startsWith('R')?'resistor':id.startsWith('S')?'switch':'led'});
    const detail=id.startsWith('R')?
      p.ohms+' Ω resistor':id.startsWith('S')?
      (p.closed?'closed':'open')+' SPST switch':
      p.color+' LED, anode at '+a+' and cathode at '+b;
    step('component','Place '+id+' across center trench',
      'Insert '+id+' between '+a+' and '+b+': '+detail+'.',
      {componentId:id,from:a,to:b});
  });
  function jumper(a,b,note){
    board.wires.push({a,b});
    step('jumper','Connect '+a+' to '+b,
      'Add one ideal jumper '+a+' → '+b+'. '+note,{from:a,to:b});
  }
  jumper('V+','P1','Energize only the P rail from the source positive jack.');
  jumper('GND','N1','Connect only the N rail to the source ground jack.');
  for(const net of groups){
    const members=net.filter(t=>t!=='V+'&&t!=='GND');
    if(!members.length)continue;
    if(net.includes('V+')&&net.includes('GND'))
      throw new RangeError('Source and ground share one ideal wire net; repair this short first.');
    if(net.includes('V+')||net.includes('GND')){
      const rail=net.includes('V+')?'P':'N';
      for(const t of members){
        const endpoint=holeForTerminal(t,col);
        const column=col.get(t.split(':')[0]);
        jumper(rail+column,endpoint,
          'Connect the schematic net of '+t+' to the '+(rail==='P'?'positive':'ground')+' rail.');
      }
    }else{
      const [first,...rest]=members.map(t=>({terminal:t,hole:holeForTerminal(t,col)}));
      for(const next of rest)
        jumper(first.hole,next.hole,
          'Tie schematic terminals '+first.terminal+' and '+next.terminal+' into one non-rail copper net.');
    }
  }
  if(board.wires.length>MAX_WIRES)
    throw new RangeError('Routing would require more than 40 jumpers; simplify the schematic.');
  const layout=validateBreadboard(board);
  const check=verifyBreadboardEquivalence(source,layout);
  if(!check.equivalent)throw new Error('Electrical equivalence check failed: '+check.issues[0]);
  return {
    version:BRIDGE_STORAGE_VERSION,source,layout,steps,mapping,
    verification:check,
    warnings:[
      'Verified electrical equivalence applies to the idealized DC model and terminal nets, not physical hardware safety.',
      'This 12-column teaching board has continuous, unsplit P/N rails; commercial breadboards can differ.',
      'Every two-terminal component occupies an independent E#/F# column; jumper paths are not length-optimized.',
      ...(electrical.status!=='ok'?
        ['The input schematic is '+electrical.status+'. The mapped board faithfully retains this issue; a successful transfer does not imply a working circuit.']:[]),
      ...electrical.notices.slice(0,5)
    ]
  };
}
