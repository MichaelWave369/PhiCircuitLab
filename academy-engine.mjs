/**
 * Φ Circuit Lab v0.7: seeded troubleshooting missions and verifiable grading.
 *
 * Each run contains nine solvable fault scenarios. Values and the location
 * of certain breaks vary deterministically with a user-visible seed.
 * Never use Math.random() inside scoring. No learner data leaves the browser.
 *
 * Missions use the exact same validated circuit representation and solver as
 * the free Wiring Lab. Repair is judged by electrical behavior and retaining
 * the intended components, not by an animation or a magic "fixed" button.
 */
import { presetCircuit, validateCircuit, solveCircuit } from './wiring-solver.mjs';

export const MISSION_COUNT=9;
export const DIAGNOSES=Object.freeze([
  {id:'open',label:'Broken wire / incomplete path'},
  {id:'switch',label:'Open switch interrupts current'},
  {id:'partial',label:'One parallel branch is inactive'},
  {id:'reverse',label:'LED is wired backward'},
  {id:'overcurrent',label:'LED current is excessive'},
  {id:'threshold',label:'Supply voltage is below LED turn-on'},
  {id:'short',label:'Ideal source short through a wire or switch'},
  {id:'double',label:'Two separate interruptions in the loop'}
]);

const clone=x=>JSON.parse(JSON.stringify(x));
const between=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const close=(a,b,tol=1e-7)=>
  typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b)&&
  Math.abs(a-b)<=tol;

function seeded(seed,index){
  let n=((seed>>>0)^Math.imul(index+1,0x9e3779b1))>>>0;
  return ()=>{
    n+=0x6d2b79f5;
    let t=n;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
const pick=(rng,values)=>values[Math.floor(rng()*values.length)];
const removeWire=(doc,a,b)=>{
  const i=doc.wires.findIndex(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a));
  if(i<0)throw new Error('Missing expected educational wire: '+a+' to '+b);
  doc.wires.splice(i,1);
};
const addWire=(doc,a,b)=>doc.wires.push({a,b});
export function flipLedPolarity(document,id){
  const doc=validateCircuit(document);
  if(!doc.leds.some(led=>led.id===id))throw new RangeError('Cannot flip missing LED');
  const a=id+':a',b=id+':b';
  doc.wires=doc.wires.map(w=>({
    a:w.a===a?b:w.a===b?a:w.a,
    b:w.b===a?b:w.b===b?a:w.b
  }));
  // A degenerate wire directly between a/b remains exactly one valid wire;
  // endpoint swaps preserve all contact references and IDs.
  return validateCircuit(doc);
}

export function createMission(seed,index){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)
    throw new RangeError('Run seed must be an unsigned 32-bit integer');
  if(!Number.isInteger(index)||index<0||index>=MISSION_COUNT)
    throw new RangeError('Mission index out of range');
  const rng=seeded(seed,index);
  let type,title,question,hint,goal,initial,target,diagnosis;
  if(index===0){
    type='broken-feed';
    initial=presetCircuit('series');
    const r=pick(rng,[470,680,1000,1500]);
    initial.parts[0].ohms=r;
    initial.parts[1].ohms=pick(rng,[470,680,1000]);
    target=clone(initial);
    removeWire(initial,'V+','R1:a');
    diagnosis='open';title='The Missing Feed';
    question='The meter reads zero source current. What caused the open loop?';
    hint='Check whether the positive supply has a wire reaching R1:a.';
    goal='Reconnect the positive source to the first series resistor without bypassing either resistor.';
  }else if(index===1){
    type='broken-junction';
    initial=presetCircuit('series');
    initial.parts[0].ohms=pick(rng,[470,680,1000,2200]);
    initial.parts[1].ohms=pick(rng,[470,680,1000,1500]);
    target=clone(initial);
    removeWire(initial,'R1:b','R2:a');
    diagnosis='open';title='A Silent Series Junction';
    question='Both resistors look fine, but no current flows. What is the diagnosis?';
    hint='Look at the missing conductor between R1:b and R2:a.';
    goal='Complete the series junction; keep both resistors active and preserve their values.';
  }else if(index===2){
    type='one-dead-branch';
    initial=presetCircuit('parallel');
    initial.parts[0].ohms=pick(rng,[470,680,1000,1500]);
    initial.parts[1].ohms=pick(rng,[470,680,1000,1500]);
    target=clone(initial);
    removeWire(initial,'R2:b','GND');
    diagnosis='partial';title='The Lonely Parallel Branch';
    question='The total current is nonzero but the second resistor has no branch current. Why?';
    hint='The R2 branch is missing its path back to GND.';
    goal='Restore both parallel branches without deleting or bypassing a resistor.';
  }else if(index===3){
    type='switch-open';
    initial=presetCircuit('switch');
    initial.parts[0].ohms=pick(rng,[470,680,1000,1500]);
    target=clone(initial);target.switches[0].closed=true;
    diagnosis='switch';title='The Disconnected Contact';
    question='The supply and resistor are wired correctly. What prevents current?';
    hint='Select S1 and use the Toggle switch control. An open switch breaks the loop.';
    goal='Close S1 so current flows through R1, keeping the resistor in the path.';
  }else if(index===4){
    type='led-backward';
    initial=presetCircuit('reverse-led');
    initial.parts[0].ohms=pick(rng,[220,330,470,680]);
    target=flipLedPolarity(initial,'D1');
    diagnosis='reverse';title='The Backwards Beacon';
    question='The loop contains an LED but its model current is zero. Which fault explains this?';
    hint='Click D1 and choose Flip LED polarity in its inspector. Anode a must face the positive feed.';
    goal='Reverse D1 without bypassing its limiting resistor. The LED should conduct safely.';
  }else if(index===5){
    type='led-overcurrent';
    initial=presetCircuit('led');
    initial.parts[0].ohms=pick(rng,[22,33,47,56]);
    target=clone(initial);target.parts[0].ohms=330;
    diagnosis='overcurrent';title='A Too-Bright Idea';
    question='The LED lights, but the model warns about unsafe current. What is wrong?';
    hint='The current-limiting resistor is far too small. Select R1 and try 330 Ω.';
    goal='Set a sensible series resistor so the modeled LED draws 4–15 mA, without any direct bypass.';
  }else if(index===6){
    type='led-undervoltage';
    initial=presetCircuit('led');
    initial.leds[0].color='blue';
    initial.parts[0].ohms=pick(rng,[220,270,330,390]);
    initial.supplyV=pick(rng,[2,2.5,3]);
    target=clone(initial);target.supplyV=5;
    diagnosis='threshold';title='The Dim Blue Signal';
    question='The LED is forward-connected, but it remains off. Which issue is responsible?';
    hint='Blue LEDs use a higher modeled forward threshold. Raise the virtual source toward 5 V.';
    goal='Set a suitable supply so the blue LED draws 3–12 mA through the existing resistor.';
  }else if(index===7){
    type='ideal-short';
    initial=presetCircuit('switch');
    initial.parts[0].ohms=pick(rng,[470,680,1000,1500]);
    initial.switches[0].closed=true;
    target=clone(initial);
    addWire(initial,'S1:b','GND');
    diagnosis='short';title='The Dangerous Shortcut';
    question='The simulator refuses to calculate current. What happened?';
    hint='The extra S1:b → GND wire bypasses R1 and shorts the source. Remove that wire, not the resistor.';
    goal='Remove the shorting jumper and leave S1 closed so current is limited by R1.';
  }else{
    type='double-break';
    initial=presetCircuit('switch');
    initial.parts[0].ohms=pick(rng,[470,680,1000,1500]);
    target=clone(initial);target.switches[0].closed=true;
    removeWire(initial,'R1:b','GND');
    diagnosis='double';title='Two Problems, One Circuit';
    question='Repairing only the contact still leaves zero current. What is the most complete diagnosis?';
    hint='S1 is open AND the resistor return wire to ground is missing. Fix both.';
    goal='Close S1 and restore the ground return while keeping R1 in series.';
  }
  const start=validateCircuit(initial),reference=validateCircuit(target);
  const baseline=solveCircuit(start),fixed=solveCircuit(reference);
  if(fixed.status!=='ok'||!(fixed.sourceCurrentA>0))
    throw new Error('Mission factory created an impossible target');
  return Object.freeze({
    seed,index,id:String(seed)+'-'+index,type,title,question,hint,goal,diagnosis,
    initial:start,reference,
    startStatus:baseline.status,
    expectedCurrentA:fixed.sourceCurrentA
  });
}

export function gradePrediction(mission,choice){
  return DIAGNOSES.some(d=>d.id===choice)&&choice===mission.diagnosis;
}

function sameIdentity(a,b,key){
  return a.length===b.length&&a.every(item=>b.some(x=>x.id===item.id&&
    (key===null||x[key]===item[key])));
}

export function evaluateRepair(mission,proposal){
  let doc,solved;
  try{doc=validateCircuit(proposal);solved=solveCircuit(doc);}
  catch(err){return {ok:false,feedback:'Invalid circuit document: '+err.message};}
  const ref=mission.reference;
  if(!sameIdentity(doc.parts,ref.parts,null)||
      !sameIdentity(doc.switches,ref.switches,null)||
      !sameIdentity(doc.leds,ref.leds,'color')){
    return {ok:false,feedback:'Keep the original parts and their IDs. Repair the fault instead of deleting components.'};
  }
  if(mission.type!=='led-overcurrent'&&
      doc.parts.some(p=>p.ohms!==ref.parts.find(x=>x.id===p.id).ohms)){
    return {ok:false,feedback:'Keep the original resistor values; this mission is about the wiring, switch, or supply.'};
  }
  if(mission.type!=='led-undervoltage'&&doc.supplyV!==ref.supplyV)
    return {ok:false,feedback:'Restore the original supply voltage. Fix the intended fault.'};
  if(mission.type==='led-undervoltage'&&!between(doc.supplyV,4.5,7))
    return {ok:false,feedback:'The blue LED needs an appropriate supply, around 5 V for this exercise.'};
  if(doc.switches.some(sw=>sw.closed!==ref.switches.find(x=>x.id===sw.id).closed)){
    return {ok:false,feedback:'Check the required switch state; a disconnected contact can keep the circuit open.'};
  }
  if(solved.status==='short')
    return {ok:false,feedback:'An ideal short is still present. Remove the direct path from V+ to GND.'};
  if(solved.status!=='ok')
    return {ok:false,feedback:'The circuit is still open or unresolved. Use the meter to trace the missing path.'};
  if(solved.parts.some(p=>p.state!=='active'))
    return {ok:false,feedback:'Every original resistor must carry current. Do not bypass or abandon a component.'};
  if(solved.leds.some(l=>l.state!=='on'))
    return {ok:false,feedback:'The LED is not conducting in the intended direction. Check its anode and cathode.'};
  if(mission.type==='led-overcurrent'||mission.type==='led-undervoltage'){
    const value=solved.leds[0]?.currentA;
    if(!between(value,mission.type==='led-overcurrent'?.004:.003,
      mission.type==='led-overcurrent'?.015:.012)){
      return {ok:false,feedback:'The modeled LED current is outside this mission’s safe teaching target. Adjust the '+(mission.type==='led-overcurrent'?'resistor':'supply')+'.'};
    }
  }else{
    const expected=solveCircuit(ref);
    if(!close(solved.sourceCurrentA,expected.sourceCurrentA))
      return {ok:false,feedback:'A conductive path exists, but the source current is incorrect. Look for bypasses or a wrong branch.'};
    for(const p of expected.parts){
      const current=solved.parts.find(x=>x.id===p.id);
      if(!current||!close(current.currentA,p.currentA)||
        !close(current.voltageV,p.voltageV)){
        return {ok:false,feedback:'The branch currents or voltage drops do not yet match the intended healthy circuit.'};
      }
    }
    for(const p of expected.leds){
      const current=solved.leds.find(x=>x.id===p.id);
      if(!current||!close(current.currentA,p.currentA)||
        !close(current.voltageV,p.voltageV)){
        return {ok:false,feedback:'The LED still differs electrically from the healthy reference.'};
      }
    }
  }
  if(solved.notices.some(n=>/No resistor limits|overcurrent|short/i.test(n))){
    return {ok:false,feedback:'An unsafe-model warning remains. Keep all required current limits in place.'};
  }
  return {
    ok:true,
    feedback:'Circuit repaired! The modeled current and components are behaving as intended.',
    sourceCurrentA:solved.sourceCurrentA
  };
}

export function calculateMissionScore({predictionCorrect=false,hintUsed=false,failedChecks=0}={}){
  if(!Number.isInteger(failedChecks)||failedChecks<0)throw new RangeError('Invalid check count');
  return Math.max(30,75+(predictionCorrect?25:0)-(hintUsed?10:0)-Math.min(25,failedChecks*5));
}
