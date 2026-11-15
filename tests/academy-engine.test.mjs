import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_COUNT, DIAGNOSES, createMission, gradePrediction,
  evaluateRepair, calculateMissionScore, flipLedPolarity
} from '../academy-engine.mjs';
import { presetCircuit, solveCircuit, validateCircuit } from '../wiring-solver.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
const byType=(seed,type)=>Array.from({length:MISSION_COUNT},(_,i)=>createMission(seed,i))
  .find(m=>m.type===type);

test('all nine mission archetypes are unique and properly numbered',()=>{
  const missions=Array.from({length:MISSION_COUNT},(_,i)=>createMission(12345,i));
  assert.equal(missions.length,9);
  assert.equal(new Set(missions.map(m=>m.type)).size,9);
  assert.deepEqual(missions.map(m=>m.index),[0,1,2,3,4,5,6,7,8]);
  assert.ok(missions.every(m=>m.question&&m.goal&&m.hint));
});
test('seeded missions reproduce identical starting wiring and grading',()=>{
  for(const index of [0,1,3,4,5,7,8]){
    const a=createMission(369,index),b=createMission(369,index);
    assert.deepEqual(a,b);
    assert.deepEqual(evaluateRepair(a,a.reference),evaluateRepair(b,b.reference));
  }
});
test('different run seeds vary component values in a real circuit',()=>{
  const combos=new Set([0,1,2,3,4,5,6,7,8,9,10,100,369].map(s=>
    JSON.stringify(createMission(s,0).initial.parts.map(p=>p.ohms))));
  assert.ok(combos.size>=2);
});
test('seed and mission index are strictly bounded',()=>{
  for(const seed of [-1,1.5,4294967296,NaN,Infinity,'369']){
    assert.throws(()=>createMission(seed,0),RangeError);
  }
  for(const index of [-1,9,1.2,NaN]){
    assert.throws(()=>createMission(369,index),RangeError);
  }
});
test('every mission starts faulty and has an achievable healthy reference',()=>{
  for(const seed of [0,369,987654,4294967295]){
    for(let i=0;i<MISSION_COUNT;i++){
      const m=createMission(seed,i);
      assert.equal(evaluateRepair(m,m.initial).ok,false,
        'mission '+i+' seed '+seed+' started repaired');
      const good=evaluateRepair(m,m.reference);
      assert.equal(good.ok,true,'mission '+i+' seed '+seed+': '+good.feedback);
      assert.equal(solveCircuit(m.reference).status,'ok');
      assert.ok(m.expectedCurrentA>0);
    }
  }
});
test('prediction grading identifies the correct fault, never a different choice',()=>{
  for(let i=0;i<MISSION_COUNT;i++){
    const m=createMission(369,i);
    assert.equal(gradePrediction(m,m.diagnosis),true);
    for(const choice of DIAGNOSES.map(x=>x.id).filter(x=>x!==m.diagnosis))
      assert.equal(gradePrediction(m,choice),false);
  }
  assert.equal(gradePrediction(createMission(369,0),'__proto__'),false);
});
test('repair of broken supply feed requires real connectivity',()=>{
  const m=createMission(369,0);
  const x=clone(m.initial);
  x.wires.push({a:'V+',b:'R1:a'});
  assert.equal(evaluateRepair(m,x).ok,true);
  const bad=clone(x);
  bad.wires.push({a:'V+',b:'GND'});
  assert.equal(evaluateRepair(m,bad).ok,false);
});
test('repair of missing series midpoint requires both resistors active',()=>{
  const m=createMission(369,1);
  const x=clone(m.initial);
  x.wires.push({a:'R1:b',b:'R2:a'});
  assert.equal(evaluateRepair(m,x).ok,true);
  const shortcut=clone(m.initial);
  shortcut.wires.push({a:'R1:b',b:'GND'});
  assert.equal(evaluateRepair(m,shortcut).ok,false);
});
test('parallel branch repair is not solved merely because one branch already works',()=>{
  const m=createMission(369,2);
  assert.equal(solveCircuit(m.initial).status,'ok');
  assert.equal(evaluateRepair(m,m.initial).ok,false);
  const x=clone(m.initial);x.wires.push({a:'R2:b',b:'GND'});
  assert.equal(evaluateRepair(m,x).ok,true);
});
test('the switch challenge only clears after S1 closes',()=>{
  const m=createMission(369,3);
  const x=clone(m.initial);x.switches[0].closed=true;
  assert.equal(evaluateRepair(m,x).ok,true);
  x.switches[0].closed=false;
  assert.equal(evaluateRepair(m,x).ok,false);
});
test('LED polarity flip swaps wires but preserves component data',()=>{
  const m=createMission(369,4);
  const x=flipLedPolarity(m.initial,'D1');
  assert.deepEqual(x.leds,m.initial.leds);
  assert.equal(evaluateRepair(m,x).ok,true);
  assert.equal(evaluateRepair(m,flipLedPolarity(x,'D1')).ok,false);
  assert.throws(()=>flipLedPolarity(x,'D999'),RangeError);
});
test('wrong LED colors cannot be substituted to cheat the challenge',()=>{
  const m=createMission(369,4);
  const doc=clone(m.reference);doc.leds[0].color='blue';
  assert.equal(evaluateRepair(m,doc).ok,false);
});
test('overcurrent challenge requires limiting resistance and target diode current',()=>{
  const m=createMission(369,5);
  assert.ok(solveCircuit(m.initial).notices.some(n=>n.includes('20 mA')));
  const fix=clone(m.initial);fix.parts[0].ohms=330;
  assert.equal(evaluateRepair(m,fix).ok,true);
  fix.parts[0].ohms=10;
  assert.equal(evaluateRepair(m,fix).ok,false);
  fix.parts[0].ohms=1e7;
  assert.equal(evaluateRepair(m,fix).ok,false);
});
test('below-threshold LED challenge can be solved by adjusting only supply',()=>{
  const m=createMission(369,6);
  assert.equal(solveCircuit(m.initial).leds[0].state,'off');
  const x=clone(m.initial);x.supplyV=5;
  assert.equal(evaluateRepair(m,x).ok,true);
  x.supplyV=24;
  assert.equal(evaluateRepair(m,x).ok,false);
});
test('short-circuit challenge cannot be cheated by simply opening the switch',()=>{
  const m=createMission(369,7);
  assert.equal(solveCircuit(m.initial).status,'short');
  const opened=clone(m.initial);opened.switches[0].closed=false;
  assert.equal(evaluateRepair(m,opened).ok,false);
  const correct=clone(m.initial);
  correct.wires=correct.wires.filter(w=>!(w.a==='S1:b'&&w.b==='GND'));
  assert.equal(evaluateRepair(m,correct).ok,true);
});
test('final challenge requires two separate repairs',()=>{
  const m=createMission(369,8);
  const onlySw=clone(m.initial);onlySw.switches[0].closed=true;
  assert.equal(evaluateRepair(m,onlySw).ok,false);
  const onlyWire=clone(m.initial);onlyWire.wires.push({a:'R1:b',b:'GND'});
  assert.equal(evaluateRepair(m,onlyWire).ok,false);
  onlySw.wires.push({a:'R1:b',b:'GND'});
  assert.equal(evaluateRepair(m,onlySw).ok,true);
});
test('grader rejects unauthorized component removal or additions',()=>{
  const m=createMission(369,0);
  const gone=clone(m.reference);gone.parts.pop();
  assert.equal(evaluateRepair(m,gone).ok,false);
  const newPart=clone(m.reference);newPart.parts.push({id:'R3',ohms:1000,x:750,y:350});
  assert.equal(evaluateRepair(m,newPart).ok,false);
});
test('grader rejects changing parts values in wiring-only missions',()=>{
  const m=createMission(369,0);
  const doc=clone(m.reference);doc.parts[0].ohms++;
  assert.equal(evaluateRepair(m,doc).ok,false);
});
test('grader rejects invalid input and impossible current paths',()=>{
  const m=createMission(369,0);
  assert.equal(evaluateRepair(m,null).ok,false);
  const bad=clone(m.reference);bad.wires.push({a:'R1:a',b:'R999:a'});
  assert.equal(evaluateRepair(m,bad).ok,false);
});
test('scores reward prediction and repair, penalize hints and failed checks',()=>{
  assert.equal(calculateMissionScore({predictionCorrect:true}),100);
  assert.equal(calculateMissionScore({predictionCorrect:false}),75);
  assert.equal(calculateMissionScore({predictionCorrect:true,hintUsed:true}),90);
  assert.equal(calculateMissionScore({predictionCorrect:true,failedChecks:2}),90);
  assert.equal(calculateMissionScore({predictionCorrect:false,hintUsed:true,failedChecks:99}),40);
  assert.throws(()=>calculateMissionScore({failedChecks:-1}),RangeError);
});
test('free-build presets continue to round-trip through the circuit schema',()=>{
  for(const preset of ['series','parallel','divider','open','switch','led','reverse-led','led-unlimited']){
    const doc=presetCircuit(preset);
    assert.deepEqual(validateCircuit(doc),doc);
  }
});
