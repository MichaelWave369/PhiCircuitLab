import test from 'node:test';
import assert from 'node:assert/strict';
import {presetCircuit,validateCircuit,solveCircuit} from '../wiring-solver.mjs';
import {createMission} from '../academy-engine.mjs';
import {
  createBreadboardExample,analyzeBreadboard,validateBreadboard,
  breadboardToCircuit,traceBreadboardContinuity,measureBreadboardVoltage
} from '../breadboard-engine.mjs';
import {
  BRIDGE_SUPPORTED_PARTS,BRIDGE_STORAGE_VERSION,
  planBreadboardFromCircuit,verifyBreadboardEquivalence
} from '../breadboard-bridge-engine.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
const near=(x,target,eps=1e-8)=>assert.ok(typeof x==='number'&&
  Math.abs(x-target)<=eps,'Expected '+x+' ≈ '+target);
const listed=(board,a,b)=>traceBreadboardContinuity(board,a,b).connected;

test('bridge version and physical board capacity are declared',()=>{
  assert.equal(BRIDGE_STORAGE_VERSION,1);
  assert.equal(BRIDGE_SUPPORTED_PARTS,12);
});
test('series example produces deterministic 2-component five-jumper layout',()=>{
  const plan=planBreadboardFromCircuit(presetCircuit('series'));
  assert.equal(plan.version,1);
  assert.equal(plan.layout.supplyV,9);
  assert.deepEqual(plan.mapping.map(x=>[x.id,x.a,x.b]),
    [['R1','E1','F1'],['R2','E2','F2']]);
  assert.equal(plan.layout.parts.length,2);
  assert.equal(plan.layout.wires.length,5);
  assert.equal(plan.steps.length,8);
  assert.equal(plan.steps[0].kind,'setup');
  assert.equal(plan.steps[1].kind,'component');
  assert.ok(plan.steps.some(s=>s.from==='V+'&&s.to==='P1'));
  assert.ok(plan.steps.some(s=>s.from==='GND'&&s.to==='N1'));
  assert.ok(plan.steps.some(s=>s.from==='J1'&&s.to==='A2'));
  assert.equal(plan.verification.equivalent,true);
  assert.equal(plan.verification.sourceNetCount,3);
  assert.equal(plan.verification.netPairsChecked,15);
  near(plan.verification.sourceCurrentA,.0045);
});
test('guided jumper route follows physically continuous rail and contact strips',()=>{
  const board=planBreadboardFromCircuit(presetCircuit('series')).layout;
  assert.equal(listed(board,'V+','P12'),true);
  assert.equal(listed(board,'GND','N8'),true);
  assert.equal(listed(board,'V+','A1'),true);
  assert.equal(listed(board,'F1','E2'),true);
  assert.equal(listed(board,'J1','A2'),true);
  assert.equal(listed(board,'F2','GND'),true);
  assert.equal(listed(board,'E1','F1'),false);
  assert.equal(listed(board,'V+','GND'),false);
});
test('single series resistor yields equivalent 9 mA and single-column placement',()=>{
  const source=validateCircuit({version:1,supplyV:9,
    parts:[{id:'R1',ohms:1000,x:340,y:175}],switches:[],leds:[],
    wires:[{a:'V+',b:'R1:a'},{a:'R1:b',b:'GND'}]});
  const plan=planBreadboardFromCircuit(source);
  assert.equal(plan.layout.parts.length,1);
  assert.equal(plan.layout.parts[0].a,'E1');
  assert.equal(plan.layout.parts[0].b,'F1');
  near(analyzeBreadboard(plan.layout).result.sourceCurrentA,.009);
});
test('all official supported teaching presets preserve terminal nets and solver',()=>{
  for(const preset of ['series','parallel','divider','open','switch',
    'led','reverse-led','led-unlimited']){
    const source=presetCircuit(preset);
    const plan=planBreadboardFromCircuit(source);
    assert.equal(plan.verification.equivalent,true,'Incorrect placement for '+preset);
    assert.equal(plan.verification.issues.length,0);
    assert.deepEqual(breadboardToCircuit(plan.layout),
      validateCircuit(breadboardToCircuit(plan.layout)));
    const rebuilt=solveCircuit(breadboardToCircuit(plan.layout));
    assert.equal(rebuilt.status,solveCircuit(source).status);
    assert.ok(plan.steps.length>=3);
  }
});
test('all seeded Academy cases that are not ideal shorts map correctly',()=>{
  for(const seed of [369,1776]){
    for(let i=0;i<9;i++){
      const mission=createMission(seed,i);
      if(solveCircuit(mission.initial).status==='short'){
        assert.throws(()=>planBreadboardFromCircuit(mission.initial),/source short/);
      }else{
        const plan=planBreadboardFromCircuit(mission.initial);
        assert.equal(plan.verification.equivalent,true,
          'Failed seed '+seed+' Academy case '+i);
      }
    }
  }
});
test('floating circuits remain floating instead of adding phantom source wires',()=>{
  const plan=planBreadboardFromCircuit(presetCircuit('open'));
  const original=solveCircuit(plan.source),onBoard=analyzeBreadboard(plan.layout).result;
  assert.equal(original.status,'open');
  assert.equal(onBoard.status,'open');
  assert.equal(plan.layout.wires.length,2);
  assert.equal(listed(plan.layout,'V+','E1'),false);
  assert.equal(listed(plan.layout,'GND','F2'),false);
  assert.ok(plan.warnings.some(w=>w.includes('faithfully retains')));
});
test('direct source shorts are refused before a construction plan is offered',()=>{
  const doc=presetCircuit('series');
  doc.wires.push({a:'V+',b:'GND'});
  assert.equal(solveCircuit(doc).status,'short');
  assert.throws(()=>planBreadboardFromCircuit(doc),/source short/);
});
test('source short through a closed switch is refused too',()=>{
  const doc=presetCircuit('switch');
  doc.switches[0].closed=true;
  doc.wires.push({a:'S1:b',b:'GND'});
  assert.equal(solveCircuit(doc).status,'short');
  assert.throws(()=>planBreadboardFromCircuit(doc),/source short/);
});
test('closed switch remains a component, not an unconditional jumper',()=>{
  const doc=presetCircuit('switch');doc.switches[0].closed=true;
  const plan=planBreadboardFromCircuit(doc);
  assert.equal(plan.layout.switches[0].closed,true);
  assert.equal(plan.verification.equivalent,true);
  assert.equal(listed(plan.layout,'E2','F2'),false);
  const result=analyzeBreadboard(plan.layout).result;
  near(result.sourceCurrentA,.009);
});
test('reversed LED preserves anode and cathode even if source polarity is reversed',()=>{
  const plan=planBreadboardFromCircuit(presetCircuit('reverse-led'));
  assert.equal(plan.layout.leds.length,1);
  assert.equal(plan.layout.leds[0].a,'E2');
  assert.equal(plan.layout.leds[0].b,'F2');
  assert.equal(plan.verification.equivalent,true);
  assert.equal(plan.verification.sourceStatus,
    analyzeBreadboard(plan.layout).result.status);
  assert.equal(analyzeBreadboard(plan.layout).result.leds[0].state,'reverse');
});
test('LED overcurrent warnings remain available in same simulation model',()=>{
  const doc=presetCircuit('led');doc.parts[0].ohms=22;
  const plan=planBreadboardFromCircuit(doc);
  assert.equal(plan.verification.equivalent,true);
  near(plan.layout.parts[0].ohms,22);
  assert.ok(plan.warnings.some(w=>/LED|resistor|limit|current/i.test(w)));
});
test('grounded and sourced terminal nets map to distinct rails',()=>{
  const source=presetCircuit('parallel');
  const board=planBreadboardFromCircuit(source).layout;
  assert.equal(listed(board,'V+','P7'),true);
  assert.equal(listed(board,'GND','N6'),true);
  assert.equal(listed(board,'A1','A2'),true);
  assert.equal(listed(board,'J1','J2'),true);
  assert.equal(listed(board,'A1','J1'),false);
});
test('non-rail intermediate nets use explicit jumper trees',()=>{
  const doc=presetCircuit('divider');
  const plan=planBreadboardFromCircuit(doc);
  assert.equal(plan.layout.parts.length,3);
  assert.ok(plan.steps.some(s=>s.kind==='jumper'&&s.detail.includes('non-rail')));
  assert.equal(plan.verification.equivalent,true);
  const circuit=breadboardToCircuit(plan.layout);
  assert.equal(circuit.parts.length,3);
});
test('the planner never changes the source input object',()=>{
  const doc=presetCircuit('parallel'),before=JSON.stringify(doc);
  planBreadboardFromCircuit(doc);
  assert.equal(JSON.stringify(doc),before);
});
test('reproducible mapping, steps and source circuit, with no timestamps',()=>{
  const a=planBreadboardFromCircuit(presetCircuit('divider'));
  const b=planBreadboardFromCircuit(presetCircuit('divider'));
  assert.deepEqual(a,b);
  assert.equal(JSON.stringify(a).includes('Date.now'),false);
});
test('a voltage read from a generated board matches the source supply',()=>{
  const plan=planBreadboardFromCircuit(presetCircuit('series'));
  const source=measureBreadboardVoltage(plan.layout,'P1','N12');
  assert.equal(source.status,'ok');
  near(source.voltageV,9);
});
test('source disconnected from parts does not fabricate voltage in floating nets',()=>{
  const plan=planBreadboardFromCircuit(presetCircuit('open'));
  assert.equal(measureBreadboardVoltage(plan.layout,'A1','J1').status,'unavailable');
  near(measureBreadboardVoltage(plan.layout,'P1','N1').voltageV,9);
});
test('exactly 12 two-terminal components fit across 12 columns',()=>{
  const doc={
    version:1,supplyV:9,
    parts:Array.from({length:8},(_,i)=>({id:'R'+(i+1),ohms:220+i,x:150+i*70,y:170})),
    switches:Array.from({length:4},(_,i)=>({id:'S'+(i+1),closed:false,x:170+i*145,y:285})),
    leds:[],wires:[]
  };
  const plan=planBreadboardFromCircuit(doc);
  assert.equal(plan.mapping.length,12);
  assert.equal(plan.mapping.at(-1).column,12);
  assert.equal(plan.verification.equivalent,true);
});
test('more than 12 two-terminal parts is a clear unsupported case',()=>{
  const doc={
    version:1,supplyV:9,
    parts:Array.from({length:8},(_,i)=>({id:'R'+(i+1),ohms:330,x:150+i*70,y:170})),
    switches:Array.from({length:4},(_,i)=>({id:'S'+(i+1),closed:false,x:170+i*145,y:285})),
    leds:[{id:'D1',color:'red',x:400,y:380}],wires:[]
  };
  assert.doesNotThrow(()=>validateCircuit(doc));
  assert.throws(()=>planBreadboardFromCircuit(doc),/supports only 12/);
});
test('the verification compares every terminal pair, not only source current',()=>{
  const source=presetCircuit('series');
  const valid=planBreadboardFromCircuit(source).layout;
  const tampered=clone(valid);
  tampered.wires.push({a:'A1',b:'J1'});
  const check=verifyBreadboardEquivalence(source,tampered);
  assert.equal(check.equivalent,false);
  assert.ok(check.issues.some(x=>x.includes('Net mismatch')));
  assert.equal(check.netPairsChecked,15);
});
test('structurally incorrect board rejected even if two sources read same voltage',()=>{
  const source=presetCircuit('parallel');
  const valid=planBreadboardFromCircuit(source).layout;
  const changed=clone(valid);
  [changed.parts[1].a,changed.parts[1].b]=[changed.parts[1].b,changed.parts[1].a];
  const result=verifyBreadboardEquivalence(source,changed);
  assert.equal(result.equivalent,false);
  assert.ok(result.issues.some(x=>x.includes('Net mismatch')));
  near(result.boardCurrentA,result.sourceCurrentA);
});
test('changing component values invalidates verification even with same topology',()=>{
  const source=presetCircuit('series');
  const layout=planBreadboardFromCircuit(source).layout;
  layout.parts[0].ohms=500;
  const check=verifyBreadboardEquivalence(source,layout);
  assert.equal(check.equivalent,false);
  assert.ok(check.issues.some(x=>x.includes('changed ohms')));
});
test('changing source voltage invalidates equivalence',()=>{
  const source=presetCircuit('series');
  const layout=planBreadboardFromCircuit(source).layout;
  layout.supplyV=4;
  const check=verifyBreadboardEquivalence(source,layout);
  assert.equal(check.equivalent,false);
  assert.ok(check.issues.some(x=>x.includes('voltage changed')));
});
test('removing a necessary jumper makes board nets non-equivalent',()=>{
  const doc=presetCircuit('series');
  const layout=planBreadboardFromCircuit(doc).layout;
  layout.wires=layout.wires.filter(w=>!(w.a==='J1'&&w.b==='A2'));
  const check=verifyBreadboardEquivalence(doc,layout);
  assert.equal(check.equivalent,false);
  assert.ok(check.issues.some(x=>x.includes('Net mismatch')));
});
test('extra independent copper contact wire is harmless to named circuit nets',()=>{
  const doc=presetCircuit('series');
  const layout=planBreadboardFromCircuit(doc).layout;
  layout.wires.push({a:'P8',b:'P9'});
  const check=verifyBreadboardEquivalence(doc,layout);
  assert.equal(check.equivalent,true);
});
test('verify accepts malformed documents only by throwing, never pretending verified',()=>{
  assert.throws(()=>verifyBreadboardEquivalence({},createBreadboardExample('led')));
  assert.throws(()=>verifyBreadboardEquivalence(presetCircuit('led'),null));
});
test('the bridge respects the source schematic resistor direction and sign',()=>{
  const source=presetCircuit('series');
  source.wires=[
    {a:'GND',b:'R1:a'},
    {a:'R1:b',b:'R2:a'},
    {a:'R2:b',b:'V+'}
  ];
  const plan=planBreadboardFromCircuit(source);
  const before=solveCircuit(source).parts.map(p=>p.currentA);
  const after=analyzeBreadboard(plan.layout).result.parts.map(p=>p.currentA);
  assert.deepEqual(before,after);
  assert.ok(before.every(x=>x<0));
});
test('source and layout of a generated plan can be exported as plain JSON',()=>{
  const plan=planBreadboardFromCircuit(presetCircuit('led'));
  const rehydrated=JSON.parse(JSON.stringify(plan));
  assert.equal(verifyBreadboardEquivalence(rehydrated.source,rehydrated.layout).equivalent,true);
  assert.deepEqual(validateBreadboard(rehydrated.layout),rehydrated.layout);
});
