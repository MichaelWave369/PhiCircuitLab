import test from 'node:test';
import assert from 'node:assert/strict';
import { presetCircuit, solveCircuit } from '../wiring-solver.mjs';
import { meterTerminals, measureVoltage, traceContinuity, inspectBranchCurrent } from '../wiring-meter.mjs';

const near=(actual,expected,eps=1e-8)=>assert.ok(Math.abs(actual-expected)<=eps,actual+' is not near '+expected);
const reading=(doc,red,black)=>measureVoltage(doc,solveCircuit(doc),red,black);

test('named terminals exist for resistor and LED solvers',()=>{
  const resistor=presetCircuit('series');
  const result=solveCircuit(resistor);
  assert.equal(result.terminalVoltages['V+'],9);
  assert.equal(result.terminalVoltages.GND,0);
  near(result.terminalVoltages['R1:b'],4.5);
  near(result.terminalVoltages['R2:a'],4.5);
  const led=presetCircuit('led');
  const diode=solveCircuit(led);
  near(diode.terminalVoltages['R1:b'],2+20*3/350);
  near(diode.terminalVoltages['D1:a'],diode.terminalVoltages['R1:b']);
  near(diode.terminalVoltages['D1:b'],0);
});
test('voltage meter measures source potential with red and black polarity',()=>{
  const doc=presetCircuit('series');
  const positive=reading(doc,'V+','GND');
  assert.equal(positive.status,'ok');near(positive.value,9);
  const negative=reading(doc,'GND','V+');
  near(negative.value,-9);
  assert.equal(negative.unit,'V');
});
test('series resistor drops each match KVL',()=>{
  const doc=presetCircuit('series');
  near(reading(doc,'R1:a','R1:b').value,4.5);
  near(reading(doc,'R2:a','R2:b').value,4.5);
  near(reading(doc,'R1:b','R2:a').value,0);
});
test('parallel resistor voltage is supply voltage',()=>{
  const doc=presetCircuit('parallel');
  near(reading(doc,'R1:a','R1:b').value,9);
  near(reading(doc,'R2:a','R2:b').value,9);
});
test('meter sees open-switch 9 V and closed-switch 0 V',()=>{
  const doc=presetCircuit('switch');
  near(reading(doc,'S1:a','S1:b').value,9);
  doc.switches[0].closed=true;
  near(reading(doc,'S1:a','S1:b').value,0);
});
test('reversed LED voltage probe displays signed reverse potential',()=>{
  const doc=presetCircuit('reverse-led');
  const x=reading(doc,'D1:a','D1:b');
  assert.equal(x.status,'ok');
  assert.ok(x.value<0);
});
test('LED forward voltage probe reads the piecewise model voltage',()=>{
  const doc=presetCircuit('led');
  near(reading(doc,'D1:a','D1:b').value,2+20*3/350);
});
test('floating parts do not receive invented voltage readings',()=>{
  const doc=presetCircuit('open');
  const x=reading(doc,'R1:a','GND');
  assert.equal(x.status,'floating');
  assert.equal(x.value,null);
});
test('invalid probes are rejected, not guessed from arbitrary inputs',()=>{
  const doc=presetCircuit('led');
  assert.throws(()=>reading(doc,'D999:a','GND'),RangeError);
  assert.throws(()=>traceContinuity(doc,'<script>','GND'),RangeError);
});
test('shorted circuit has unavailable voltage and current',()=>{
  const doc=presetCircuit('series');
  doc.wires.push({a:'V+',b:'GND'});
  const solved=solveCircuit(doc);
  assert.equal(solved.status,'short');
  assert.equal(solved.terminalVoltages['V+'],null);
  assert.equal(measureVoltage(doc,solved,'V+','GND').status,'unavailable');
  assert.equal(inspectBranchCurrent(doc,solved,'R1').status,'unavailable');
});
test('continuity follows wires and closed switches only',()=>{
  const doc=presetCircuit('switch');
  assert.equal(traceContinuity(doc,'V+','S1:a').value,true);
  assert.equal(traceContinuity(doc,'S1:a','S1:b').value,false);
  assert.equal(traceContinuity(doc,'V+','GND').value,false);
  doc.switches[0].closed=true;
  assert.equal(traceContinuity(doc,'S1:a','S1:b').value,true);
  assert.equal(traceContinuity(doc,'V+','R1:a').value,true);
  assert.equal(traceContinuity(doc,'V+','GND').value,false);
});
test('continuity does not classify resistor or LED as an ideal wire',()=>{
  const doc=presetCircuit('led');
  assert.equal(traceContinuity(doc,'R1:a','R1:b').value,false);
  assert.equal(traceContinuity(doc,'D1:a','D1:b').value,false);
  assert.equal(traceContinuity(doc,'V+','R1:a').value,true);
});
test('continuity detects an ideal short, without powering the circuit',()=>{
  const doc=presetCircuit('series');
  doc.wires.push({a:'V+',b:'GND'});
  assert.equal(traceContinuity(doc,'V+','GND').value,true);
  const solved=solveCircuit(doc);
  assert.equal(solved.status,'short');
});
test('resistor branch-current inspection is signed from a to b',()=>{
  const doc=presetCircuit('series');
  const x=inspectBranchCurrent(doc,solveCircuit(doc),'R1');
  assert.equal(x.status,'ok');near(x.value,.0045);
  doc.wires=[
    {a:'V+',b:'R1:b'},{a:'R1:a',b:'R2:b'},
    {a:'R2:a',b:'GND'}
  ];
  const reversed=inspectBranchCurrent(doc,solveCircuit(doc),'R1');
  near(reversed.value,-.0045);
});
test('LED branch current uses forward-direction sign and reports reverse as zero',()=>{
  const doc=presetCircuit('led');
  near(inspectBranchCurrent(doc,solveCircuit(doc),'D1').value,3/350);
  const reverse=presetCircuit('reverse-led');
  near(inspectBranchCurrent(reverse,solveCircuit(reverse),'D1').value,0);
});
test('ideal switch current cannot be uniquely measured',()=>{
  const doc=presetCircuit('switch');
  const result=inspectBranchCurrent(doc,solveCircuit(doc),'S1');
  assert.equal(result.status,'unavailable');
  assert.match(result.details,/ideal switch/i);
});
test('floating branches have no current reading',()=>{
  const doc=presetCircuit('open');
  const x=inspectBranchCurrent(doc,solveCircuit(doc),'R1');
  assert.equal(x.status,'floating');
  assert.equal(x.value,null);
});
test('unknown current component is rejected',()=>{
  const doc=presetCircuit('series');
  assert.throws(()=>inspectBranchCurrent(doc,solveCircuit(doc),'R99'),RangeError);
});
test('terminal choices follow the actual circuit component set',()=>{
  const doc=presetCircuit('led');const options=meterTerminals(doc);
  assert.deepEqual(options,['V+','GND','R1:a','R1:b','D1:a','D1:b']);
});
test('floating but source-connected branch has defined source-side voltage',()=>{
  const doc=presetCircuit('series');
  doc.wires=[{a:'V+',b:'R1:a'}];
  const result=solveCircuit(doc);
  near(measureVoltage(doc,result,'R1:a','GND').value,9);
  const floating=measureVoltage(doc,result,'R2:a','GND');
  assert.equal(floating.status,'floating');
});
