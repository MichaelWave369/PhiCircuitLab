import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_RESISTORS, presetCircuit, solveCircuit, validateCircuit } from '../wiring-solver.mjs';

const near=(actual,expected,tolerance=1e-9)=>
  assert.ok(Math.abs(actual-expected)<=tolerance,
    'Expected '+actual+' approximately '+expected);
const wire=(a,b)=>({a,b});
const resistor=(id,ohms,x=300,y=180)=>({id,ohms,x,y});
const doc=(parts,wires,supplyV=9)=>({version:1,supplyV,parts,wires});
const byId=(result,id)=>result.parts.find(p=>p.id===id);

test('series example models 2 kOhm and 4.5 mA at 9 V',()=>{
  const x=solveCircuit(presetCircuit('series'));
  assert.equal(x.status,'ok');
  near(x.equivalentOhms,2000);
  near(x.sourceCurrentA,.0045);
  near(byId(x,'R1').voltageV,4.5);
  near(byId(x,'R2').voltageV,4.5);
  near(x.parts.reduce((sum,p)=>sum+p.powerW,0),9*x.sourceCurrentA);
});
test('parallel example models 500 Ohm total and 18 mA',()=>{
  const x=solveCircuit(presetCircuit('parallel'));
  assert.equal(x.status,'ok');
  near(x.equivalentOhms,500);
  near(x.sourceCurrentA,.018);
  near(byId(x,'R1').voltageV,9);
  near(byId(x,'R2').voltageV,9);
  near(x.parts.reduce((sum,p)=>sum+p.powerW,0),9*x.sourceCurrentA);
});
test('divider example models 2000 + (1000 || 1000) ohms',()=>{
  const x=solveCircuit(presetCircuit('divider'));
  near(x.equivalentOhms,2500);
  near(x.sourceCurrentA,.0036);
  near(byId(x,'R1').voltageV,7.2);
  near(byId(x,'R2').voltageV,1.8);
  near(byId(x,'R3').voltageV,1.8);
  near(x.parts.reduce((sum,p)=>sum+p.powerW,0),9*x.sourceCurrentA);
});
test('open preset has no powered path and reports zero source draw',()=>{
  const x=solveCircuit(presetCircuit('open'));
  assert.equal(x.status,'open');
  assert.equal(x.sourceCurrentA,0);
  assert.equal(x.equivalentOhms,null);
  assert.ok(x.notices.some(n=>n.startsWith('Open circuit:')));
  assert.ok(x.parts.every(p=>p.state==='floating'));
});
test('wire directly between source and ground produces short, not Infinity',()=>{
  const x=solveCircuit(doc([], [wire('V+','GND')]));
  assert.equal(x.status,'short');
  assert.equal(x.sourceCurrentA,null);
  assert.ok(x.notices.some(n=>n.includes('short')));
});
test('short through multiple ideal wires is detected',()=>{
  const x=solveCircuit(doc([resistor('R1',1000)],[
    wire('V+','R1:a'),wire('R1:a','R1:b'),wire('R1:b','GND')]));
  assert.equal(x.status,'short');
});
test('one connected resistor only on V+ is inactive, not a complete loop',()=>{
  const x=solveCircuit(doc([resistor('R1',1000)], [wire('V+','R1:a')]));
  assert.equal(x.status,'open');
  near(x.sourceCurrentA,0);
  assert.equal(byId(x,'R1').state,'inactive');
});
test('bypassed resistor has no voltage or current',()=>{
  const x=solveCircuit(doc([resistor('R1',1000),resistor('R2',1000,550,200)],[
    wire('V+','R1:a'),wire('R1:a','R1:b'),
    wire('R1:b','R2:a'),wire('R2:b','GND')]));
  assert.equal(x.status,'ok');
  near(byId(x,'R1').powerW,0);
  assert.equal(byId(x,'R1').state,'bypassed');
  near(x.equivalentOhms,1000);
});
test('floating part does not affect powered network',()=>{
  const x=solveCircuit(doc([resistor('R1',1000),resistor('R2',2000,500,250)],[
    wire('V+','R1:a'),wire('R1:b','GND')]));
  near(x.sourceCurrentA,.009);
  assert.equal(byId(x,'R2').state,'floating');
  assert.equal(byId(x,'R2').currentA,null);
});
test('dangling branch carries zero current even when primary path powered',()=>{
  const x=solveCircuit(doc([resistor('R1',1000),resistor('R2',2000,500,250)],[
    wire('V+','R1:a'),wire('R1:b','GND'),wire('V+','R2:a')]));
  near(x.sourceCurrentA,.009);
  near(byId(x,'R2').currentA,0);
});
test('reversed resistor orientation produces negative branch current but same power',()=>{
  const x=solveCircuit(doc([resistor('R1',1000)],[wire('V+','R1:b'),wire('R1:a','GND')]));
  near(x.sourceCurrentA,.009);
  near(byId(x,'R1').currentA,-.009);
  near(byId(x,'R1').powerW,.081);
});
test('zero-voltage network solves with zero supply draw',()=>{
  const x=presetCircuit('series'); x.supplyV=0;
  const y=solveCircuit(x);
  assert.equal(y.status,'ok');near(y.sourceCurrentA,0);assert.equal(y.equivalentOhms,null);
});
test('more complex multi-node mixed network can be solved',()=>{
  const x=doc([
    resistor('R1',1000,350,100),resistor('R2',2000,550,100),
    resistor('R3',3000,350,300),resistor('R4',6000,550,300)
  ],[
    wire('V+','R1:a'),wire('R1:b','R2:a'),wire('R2:b','GND'),
    wire('V+','R3:a'),wire('R3:b','R4:a'),wire('R4:b','GND')
  ],12);
  const y=solveCircuit(x);
  near(y.equivalentOhms,1/(1/3000+1/9000));
  near(y.sourceCurrentA,.00533333333333);
});
test('imports validate and sanitize only expected properties',()=>{
  const x=presetCircuit('series');
  x.parts[0].inject='bad';x.wires[0].evil=true;x.untrusted={};
  const y=validateCircuit(x);
  assert.equal(y.parts[0].inject,undefined);
  assert.equal(y.wires[0].evil,undefined);
  assert.equal(y.untrusted,undefined);
});
test('imports reject unknown, duplicate, or degenerate wires',()=>{
  const x=presetCircuit('series');x.wires.push(wire('V+','R99:a'));
  assert.throws(()=>validateCircuit(x),RangeError);
  const y=presetCircuit('series');y.wires.push(wire('R1:a','V+'));
  assert.throws(()=>validateCircuit(y),RangeError);
  const z=presetCircuit('series');z.wires.push(wire('GND','GND'));
  assert.throws(()=>validateCircuit(z),RangeError);
});
test('imports reject invalid resistor values, count, IDs, positions and version',()=>{
  const x=presetCircuit('series');x.parts[0].ohms=0;
  assert.throws(()=>validateCircuit(x),RangeError);
  const y=presetCircuit('series');y.parts[0].id='R1" onclick="x';
  assert.throws(()=>validateCircuit(y),RangeError);
  const z=presetCircuit('series');z.parts[0].x=-500;
  assert.throws(()=>validateCircuit(z),RangeError);
  const v=presetCircuit('series');v.version=99;
  assert.throws(()=>validateCircuit(v),RangeError);
  const many=doc(Array.from({length:MAX_RESISTORS+1},(_,i)=>resistor('R'+(i+1),1000)),[]);
  assert.throws(()=>validateCircuit(many),RangeError);
});
test('resistor values must be finite, and source voltage bounded',()=>{
  const x=presetCircuit('series');x.parts[0].ohms=Infinity;
  assert.throws(()=>validateCircuit(x),RangeError);
  const y=presetCircuit('series');y.supplyV=999;
  assert.throws(()=>validateCircuit(y),RangeError);
});
