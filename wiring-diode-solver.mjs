/**
 * Φ Circuit Lab: limited, instructional DC solver for resistor + LED networks.
 *
 * Each LED uses a piecewise-linear forward model:
 *   ON:  I(a->b) = (Va - Vb - Vf) / Rd, with I >= 0
 *   OFF: I = 0, with Va - Vb <= Vf
 *
 * Vf is a fixed color teaching approximation, Rd is a deliberately chosen
 * 20-ohm model slope (NOT a physical part specification). The solver
 * enumerates up to 2^3 states, runs nodal analysis for each, then checks
 * consistency. No breakdown/reverse current, junction heating, capacitor,
 * timing, or datasheet-level device behavior is modeled.
 */
export const LED_FORWARD_V = Object.freeze({red:2.0,green:2.2,blue:3.2});
export const LED_SLOPE_OHMS = 20;
const SOLVE_EPSILON_A = 1e-9;
const SOLVE_EPSILON_V = 1e-5;

function linearSolve(matrix,rhs) {
  const n=rhs.length;
  if(n===0)return [];
  const rows=matrix.map((r,i)=>[...r,rhs[i]]);
  for(let j=0;j<n;j++){
    let pivot=j;
    for(let i=j+1;i<n;i++)if(Math.abs(rows[i][j])>Math.abs(rows[pivot][j]))pivot=i;
    if(Math.abs(rows[pivot][j])<1e-13)throw new RangeError('Nodal equations are singular');
    [rows[j],rows[pivot]]=[rows[pivot],rows[j]];
    const scale=rows[j][j];
    for(let k=j;k<=n;k++)rows[j][k]/=scale;
    for(let i=0;i<n;i++){
      if(i===j)continue;
      const m=rows[i][j];
      for(let k=j;k<=n;k++)rows[i][k]-=m*rows[j][k];
    }
  }
  return rows.map(r=>r[n]);
}

function solveForMask(doc, find, source, ground, mask){
  const active=doc.leds.map((_,i)=>Boolean(mask&(1<<i)));
  const edges=[
    ...doc.parts.map(p=>({
      id:p.id,kind:'resistor',a:find(p.id+':a'),b:find(p.id+':b'),
      conductance:1/p.ohms,offset:0,ohms:p.ohms
    })),
    ...doc.leds.flatMap((p,i)=>active[i]?[{
      id:p.id,kind:'led',a:find(p.id+':a'),b:find(p.id+':b'),
      conductance:1/LED_SLOPE_OHMS,offset:LED_FORWARD_V[p.color],
      ohms:LED_SLOPE_OHMS
    }]:[])
  ];
  const nodes=new Set([source,ground]);
  for(const p of [...doc.parts,...doc.leds]){
    nodes.add(find(p.id+':a'));nodes.add(find(p.id+':b'));
  }
  const graph=new Map([...nodes].map(n=>[n,new Set()]));
  for(const e of edges){
    if(e.a===e.b)continue;
    graph.get(e.a).add(e.b);
    graph.get(e.b).add(e.a);
  }
  const voltages=new Map([[source,doc.supplyV],[ground,0]]);
  const visited=new Set();
  let powered=false;
  for(const initial of graph.keys()){
    if(visited.has(initial))continue;
    const stack=[initial],component=[];
    visited.add(initial);
    while(stack.length){
      const n=stack.pop();component.push(n);
      for(const neighbor of graph.get(n)){
        if(!visited.has(neighbor)){visited.add(neighbor);stack.push(neighbor);}
      }
    }
    const set=new Set(component);
    const hasPlus=set.has(source),hasGround=set.has(ground);
    if(!hasPlus&&!hasGround)continue; // Floating: potential is indeterminate
    if(!hasGround){for(const n of component)voltages.set(n,doc.supplyV);continue;}
    if(!hasPlus){for(const n of component)voltages.set(n,0);continue;}
    powered=true;
    const unknown=component.filter(n=>n!==source&&n!==ground);
    const idMap=new Map(unknown.map((n,i)=>[n,i]));
    const matrix=unknown.map(()=>Array(unknown.length).fill(0));
    const rhs=Array(unknown.length).fill(0);
    for(const e of edges){
      if(e.a===e.b||!set.has(e.a)||!set.has(e.b))continue;
      for(const [node,other,offset] of [
        [e.a,e.b,e.offset],[e.b,e.a,-e.offset]
      ]){
        if(!idMap.has(node))continue;
        const i=idMap.get(node),g=e.conductance;
        matrix[i][i]+=g;
        rhs[i]+=g*offset;
        if(idMap.has(other))matrix[i][idMap.get(other)]-=g;
        else rhs[i]+=g*(other===source?doc.supplyV:0);
      }
    }
    const values=linearSolve(matrix,rhs);
    unknown.forEach((n,i)=>voltages.set(n,values[i]));
  }
  // A forward LED must have nonnegative current; an off LED must be at
  // or below its forward threshold. Unknown floating nodes do not force
  // an ungrounded diode to conduct.
  for(let i=0;i<doc.leds.length;i++){
    const p=doc.leds[i],a=find(p.id+':a'),b=find(p.id+':b');
    const va=voltages.get(a),vb=voltages.get(b);
    const known=va!==undefined&&vb!==undefined;
    if(active[i]){
      if(!known)return null;
      const current=(va-vb-LED_FORWARD_V[p.color])/LED_SLOPE_OHMS;
      if(current<-SOLVE_EPSILON_A)return null;
    }else if(known&&va-vb>LED_FORWARD_V[p.color]+SOLVE_EPSILON_V){
      return null;
    }
  }
  const branches=edges.map(e=>{
    if(e.a===e.b){
      return {...e,currentA:0,voltageV:0,powerW:0,state:'bypassed'};
    }
    const va=voltages.get(e.a),vb=voltages.get(e.b);
    if(va===undefined||vb===undefined){
      return {...e,currentA:null,voltageV:null,powerW:null,state:'floating'};
    }
    const drop=va-vb;
    const current=(drop-e.offset)*e.conductance;
    const currentA=Math.abs(current)<1e-12?0:current;
    return {...e,currentA,voltageV:drop,powerW:currentA*drop,
      state:Math.abs(currentA)<1e-12?'inactive':'active'};
  });
  const ledResults=doc.leds.map((p,i)=>{
    const a=find(p.id+':a'),b=find(p.id+':b');
    const va=voltages.get(a),vb=voltages.get(b);
    if(a===b)return {id:p.id,color:p.color,forwardV:LED_FORWARD_V[p.color],currentA:0,voltageV:0,powerW:0,state:'bypassed'};
    if(va===undefined||vb===undefined)return {id:p.id,color:p.color,forwardV:LED_FORWARD_V[p.color],currentA:null,voltageV:null,powerW:null,state:'floating'};
    const drop=va-vb;
    const currentA=active[i]?Math.max(0,(drop-LED_FORWARD_V[p.color])/LED_SLOPE_OHMS):0;
    const state=currentA>1e-9?'on':drop<-.001?'reverse':'off';
    return {id:p.id,color:p.color,forwardV:LED_FORWARD_V[p.color],
      currentA,voltageV:drop,powerW:drop*currentA,state};
  });
  let sourceCurrentA=0;
  for(const e of branches){
    if(e.currentA===null||e.a===e.b)continue;
    if(e.a===source)sourceCurrentA+=e.currentA;
    if(e.b===source)sourceCurrentA-=e.currentA;
  }
  sourceCurrentA=Math.max(0,Math.abs(sourceCurrentA)<1e-12?0:sourceCurrentA);
  return {powered,voltages,edges,branches,ledResults,sourceCurrentA,active,find,source,ground};
}

export function solveLedNetwork(doc) {
  const terminals=['V+','GND',...[...doc.parts,...doc.switches,...doc.leds].flatMap(p=>[p.id+':a',p.id+':b'])];
  const parent=new Map(terminals.map(t=>[t,t]));
  const find=x=>{
    let root=x;
    while(parent.get(root)!==root)root=parent.get(root);
    while(parent.get(x)!==x){const next=parent.get(x);parent.set(x,root);x=next;}
    return root;
  };
  const union=(a,b)=>{const x=find(a),y=find(b);if(x!==y)parent.set(y,x);};
  doc.wires.forEach(w=>union(w.a,w.b));
  doc.switches.filter(s=>s.closed).forEach(s=>union(s.id+':a',s.id+':b'));
  const source=find('V+'),ground=find('GND');
  const switchResults=doc.switches.map(sw=>({id:sw.id,closed:sw.closed,state:sw.closed?'closed':'open'}));
  if(source===ground){
    return {
      status:'short',sourceCurrentA:null,equivalentOhms:null,parts:doc.parts.map(p=>({
        id:p.id,ohms:p.ohms,currentA:null,voltageV:null,powerW:null,state:'unresolved'
      })),
      leds:doc.leds.map(p=>({id:p.id,color:p.color,forwardV:LED_FORWARD_V[p.color],
        currentA:null,voltageV:null,powerW:null,state:'unresolved'})),
      switches:switchResults,nodeVoltages:{},
      notices:['Ideal short: a wire or closed switch joins V+ to GND without a limiting component.']
    };
  }
  for(let mask=0;mask<(1<<doc.leds.length);mask++){
    const solved=solveForMask(doc,find,source,ground,mask);
    if(!solved)continue;
    const parts=doc.parts.map(p=>{
      const b=solved.branches.find(e=>e.id===p.id);
      return {id:p.id,ohms:p.ohms,currentA:b.currentA,voltageV:b.voltageV,
        powerW:b.powerW,state:b.state};
    });
    const leds=solved.ledResults;
    const notices=[];
    if(!solved.powered)notices.push('Open circuit: no conductive path joins V+ to GND.');
    if(parts.some(p=>p.state==='bypassed'))notices.push('A resistor is bypassed by ideal wires or closed switches.');
    if([...parts,...leds].some(p=>p.state==='floating'))notices.push('Some components are floating, so their voltage cannot be defined.');
    if(leds.some(l=>l.state==='reverse'))notices.push('Reverse-biased LED: the model blocks current but real LEDs have reverse-voltage limits.');
    if(leds.some(l=>l.state==='bypassed'))notices.push('An LED is bypassed by an ideal connection; its terminals share a node.');
    if(leds.some(l=>l.currentA!==null&&l.currentA>.02))notices.push('LED model current exceeds 20 mA: likely overcurrent. Actual LED limits depend on its datasheet.');
    if(leds.some(l=>l.powerW!==null&&l.powerW>.1))notices.push('Modeled LED dissipation exceeds 100 mW. Check real thermal and current ratings.');
    if(parts.some(p=>p.powerW!==null&&p.powerW>.25))notices.push('Modeled resistor power exceeds 0.25 W. Check its actual rating.');
    // If the source reaches GND using active LEDs only, no resistor
    // limits current. The 20-ohm model slope must not be mistaken
    // for safe, real-world current limiting.
    const ledGraph=new Map([[source,new Set()],[ground,new Set()]]);
    for(const [i,led] of doc.leds.entries()){
      if(!solved.active[i])continue;
      const a=find(led.id+':a'),b=find(led.id+':b');
      if(!ledGraph.has(a))ledGraph.set(a,new Set());
      if(!ledGraph.has(b))ledGraph.set(b,new Set());
      ledGraph.get(a).add(b);ledGraph.get(b).add(a);
    }
    const visited=new Set([source]),stack=[source];
    while(stack.length){
      const node=stack.pop();
      for(const n of ledGraph.get(node)||[]){
        if(!visited.has(n)){visited.add(n);stack.push(n);}
      }
    }
    if(visited.has(ground))notices.unshift('No resistor limits at least one LED-only path. A real LED can be damaged by excessive current.');
    const nodeVoltages=Object.fromEntries(solved.voltages);
    return {
      status:solved.powered?'ok':'open',
      sourceCurrentA:solved.sourceCurrentA,
      // With nonlinear LEDs, this is V / I at one operating point, not an
      // ohmic, supply-independent network equivalent resistance.
      equivalentOhms:solved.powered&&solved.sourceCurrentA>1e-12&&doc.supplyV>0
        ?doc.supplyV/solved.sourceCurrentA:null,
      parts,leds,switches:switchResults,nodeVoltages,notices
    };
  }
  return {
    status:'unsolved',sourceCurrentA:null,equivalentOhms:null,
    parts:doc.parts.map(p=>({id:p.id,ohms:p.ohms,currentA:null,voltageV:null,powerW:null,state:'unresolved'})),
    leds:doc.leds.map(p=>({id:p.id,color:p.color,forwardV:LED_FORWARD_V[p.color],
      currentA:null,voltageV:null,powerW:null,state:'unresolved'})),
    switches:switchResults,nodeVoltages:{},
    notices:['This simplified LED model cannot resolve the circuit. Try a simpler connected path or use a specialized SPICE simulator.']
  };
}
