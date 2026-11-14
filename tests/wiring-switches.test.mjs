import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SWITCHES, presetCircuit, solveCircuit, validateCircuit } from '../wiring-solver.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,'Expected '+a+' ≈ '+b);
const c=(sw,closed,parts=[],wires=[],supplyV=9)=>({
  version:1,supplyV,parts,wires,switches:[{id:sw,closed,x:310,y:165}]
});
const w=(a,b)=>({a,b});
const r=(id,ohms,x=575,y=165)=>({id,ohms,x,y});

test('series switch preset begins open with zero source current',()=>{
  const x=solveCircuit(presetCircuit('switch'));
  assert.equal(x.status,'open');
  close(x.sourceCurrentA,0);
  assert.deepEqual(x.switches,[{id:'S1',closed:false,state:'open'}]);
});
test('closing an inline switch restores the expected current',()=>{
  const doc=presetCircuit('switch');
  doc.switches[0].closed=true;
  const x=solveCircuit(doc);
  assert.equal(x.status,'ok');
  close(x.equivalentOhms,1000);
  close(x.sourceCurrentA,.009);
  close(x.parts[0].powerW,.081);
  assert.equal(x.switches[0].state,'closed');
});
test('reopening the switch interrupts the conductive path',()=>{
  const doc=presetCircuit('switch');
  doc.switches[0].closed=true;
  solveCircuit(doc);
  doc.switches[0].closed=false;
  assert.equal(solveCircuit(doc).status,'open');
});
test('a closed switch between source terminals is diagnosed as an ideal short',()=>{
  const doc=c('S1',true,[],[w('V+','S1:a'),w('S1:b','GND')]);
  const x=solveCircuit(doc);
  assert.equal(x.status,'short');
  assert.equal(x.sourceCurrentA,null);
  assert.ok(x.notices[0].includes('closed switches'));
});
test('the same short topology with an open switch is not shorted',()=>{
  const doc=c('S1',false,[],[w('V+','S1:a'),w('S1:b','GND')]);
  const x=solveCircuit(doc);
  assert.equal(x.status,'open');
});
test('a parallel switch can bypass one resistor without shorting the source',()=>{
  const doc=c('S1',true,[r('R1',1000),r('R2',500,350,300)],[
    w('V+','R1:a'),w('R1:b','R2:a'),w('R2:b','GND'),
    w('S1:a','R1:a'),w('S1:b','R1:b')
  ]);
  const x=solveCircuit(doc);
  assert.equal(x.status,'ok');
  close(x.equivalentOhms,500);
  assert.equal(x.parts.find(p=>p.id==='R1').state,'bypassed');
});
test('two switches in series must both be closed to conduct',()=>{
  const base={
    version:1,supplyV:10,
    parts:[r('R1',1000,600,160)],
    switches:[{id:'S1',closed:false,x:250,y:160},{id:'S2',closed:false,x:400,y:160}],
    wires:[w('V+','S1:a'),w('S1:b','S2:a'),w('S2:b','R1:a'),w('R1:b','GND')]
  };
  for(const a of [false,true])for(const b of [false,true]){
    base.switches[0].closed=a;base.switches[1].closed=b;
    const x=solveCircuit(base);
    assert.equal(x.status,a&&b?'ok':'open');
    close(x.sourceCurrentA,a&&b?.01:0);
  }
});
test('legacy documents that have no switch array are accepted',()=>{
  const doc=presetCircuit('series');
  delete doc.switches;
  const validated=validateCircuit(doc);
  assert.deepEqual(validated.switches,[]);
  assert.equal(solveCircuit(doc).status,'ok');
});
test('old circuits still reject unknown switch terminals',()=>{
  const doc=presetCircuit('series');
  doc.wires.push(w('R2:b','S1:a'));
  assert.throws(()=>validateCircuit(doc),RangeError);
});
test('validation rejects invalid state, IDs, and coordinates',()=>{
  const doc=presetCircuit('switch');
  doc.switches[0].closed='yes';
  assert.throws(()=>validateCircuit(doc),TypeError);
  doc.switches[0].closed=true;doc.switches[0].id='S1<script>';
  assert.throws(()=>validateCircuit(doc),RangeError);
  doc.switches[0].id='S1';doc.switches[0].y=Infinity;
  assert.throws(()=>validateCircuit(doc),RangeError);
});
test('validation rejects oversized switch list and duplicate IDs',()=>{
  const doc=presetCircuit('switch');
  doc.switches=Array.from({length:MAX_SWITCHES+1},(_,i)=>({id:'S'+(i+1),closed:false,x:320,y:180}));
  assert.throws(()=>validateCircuit(doc),RangeError);
  doc.switches=doc.switches.slice(0,2).map(sw=>({...sw,id:'S1'}));
  assert.throws(()=>validateCircuit(doc),RangeError);
});
test('validation drops unrecognized fields on switches',()=>{
  const doc=presetCircuit('switch');
  doc.switches[0].html='<script>alert(1)</script>';
  const valid=validateCircuit(doc);
  assert.equal(valid.switches[0].html,undefined);
});
