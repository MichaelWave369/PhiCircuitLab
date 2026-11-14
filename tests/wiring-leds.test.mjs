import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEDS, presetCircuit, solveCircuit, validateCircuit } from '../wiring-solver.mjs';
import { LED_FORWARD_V, LED_SLOPE_OHMS } from '../wiring-diode-solver.mjs';
const near=(actual,expected,eps=1e-8)=>
  assert.ok(actual!==null&&Math.abs(actual-expected)<=eps,'Expected '+actual+' to be ≈ '+expected);
const wire=(a,b)=>({a,b});
const resistor=(id,ohms,x=350,y=175)=>({id,ohms,x,y});
const led=(id,color='red',x=630,y=175)=>({id,color,x,y});
const circuit=(parts,leds,wires,supplyV=5,switches=[])=>({version:1,supplyV,parts,leds,wires,switches});

test('default LED assumptions are explicit teaching values',()=>{
  assert.deepEqual(LED_FORWARD_V,{red:2,green:2.2,blue:3.2});
  assert.equal(LED_SLOPE_OHMS,20);
});
test('red LED with 330 ohm resistor and 5 V conducts in correct direction',()=>{
  const x=solveCircuit(presetCircuit('led'));
  const expected=(5-2)/(330+20);
  assert.equal(x.status,'ok');
  near(x.sourceCurrentA,expected);
  near(x.parts[0].currentA,expected);
  near(x.leds[0].currentA,expected);
  near(x.leds[0].voltageV,2+20*expected);
  near(x.parts[0].voltageV,330*expected);
  assert.equal(x.leds[0].state,'on');
  near(x.parts[0].powerW+x.leds[0].powerW,5*expected);
  assert.equal(x.notices.some(n=>n.includes('20 mA')),false);
});
test('reverse-wired LED blocks current, with a reverse-bias warning',()=>{
  const x=solveCircuit(presetCircuit('reverse-led'));
  assert.equal(x.status,'open');
  near(x.sourceCurrentA,0);
  assert.equal(x.leds[0].state,'reverse');
  assert.ok(x.leds[0].voltageV<0);
  assert.ok(x.notices.some(n=>n.includes('Reverse-biased')));
});
test('below forward threshold stays off, no conduction',()=>{
  const doc=presetCircuit('led');doc.supplyV=1.5;
  const x=solveCircuit(doc);
  assert.equal(x.status,'open');
  near(x.sourceCurrentA,0);
  assert.equal(x.leds[0].state,'off');
});
test('equal to threshold is non-conducting boundary',()=>{
  const doc=presetCircuit('led');doc.supplyV=2;
  const x=solveCircuit(doc);
  near(x.sourceCurrentA,0);
  assert.equal(x.leds[0].state,'off');
});
test('at zero volts no LED conducts',()=>{
  const doc=presetCircuit('led');doc.supplyV=0;
  const x=solveCircuit(doc);
  near(x.sourceCurrentA,0);
  assert.equal(x.status,'open');
});
test('the no-resistor preset is explicitly dangerous',()=>{
  const x=solveCircuit(presetCircuit('led-unlimited'));
  assert.equal(x.status,'ok');
  near(x.sourceCurrentA,(5-2)/20);
  assert.ok(x.notices.some(n=>n.includes('No resistor limits')));
  assert.ok(x.notices.some(n=>n.includes('20 mA')));
});
test('LED color affects forward threshold and current',()=>{
  const colors=['red','green','blue'];
  const currents=colors.map(color=>{
    const doc=presetCircuit('led');doc.leds[0].color=color;
    const x=solveCircuit(doc);
    return x.leds[0].currentA;
  });
  assert.ok(currents[0]>currents[1]&&currents[1]>currents[2]);
  near(currents[2],(5-3.2)/(330+20));
});
test('a diode with wrong polarity behind a switch stays blocked',()=>{
  const doc=presetCircuit('reverse-led');
  doc.switches=[{id:'S1',closed:true,x:490,y:300}];
  doc.wires.push(wire('R1:a','S1:a'),wire('S1:b','GND'));
  const x=solveCircuit(doc);
  assert.equal(x.leds[0].state,'reverse');
});
test('opening a switch interrupts the LED circuit',()=>{
  const doc=presetCircuit('led');
  doc.switches=[{id:'S1',closed:false,x:480,y:300}];
  doc.wires=doc.wires.filter(w=>!(w.a==='R1:b'&&w.b==='D1:a'));
  doc.wires.push(wire('R1:b','S1:a'),wire('S1:b','D1:a'));
  assert.equal(solveCircuit(doc).status,'open');
  doc.switches[0].closed=true;
  const x=solveCircuit(doc);
  assert.equal(x.status,'ok');
  near(x.sourceCurrentA,3/350);
});
test('two LEDs in series require both forward drops',()=>{
  const doc=circuit([resistor('R1',330,310,140)],
    [led('D1','red',520,140),led('D2','red',690,140)],
    [wire('V+','R1:a'),wire('R1:b','D1:a'),
      wire('D1:b','D2:a'),wire('D2:b','GND')]);
  const x=solveCircuit(doc);
  assert.equal(x.status,'ok');
  near(x.sourceCurrentA,(5-4)/(330+20+20));
  assert.ok(x.leds.every(d=>d.state==='on'));
  near(x.parts[0].powerW+x.leds.reduce((t,d)=>t+d.powerW,0),5*x.sourceCurrentA);
});
test('two identical LED branches draw twice the current',()=>{
  const doc=circuit([resistor('R1',330,310,130),resistor('R2',330,310,320)],
    [led('D1','red',640,130),led('D2','red',640,320)],
    [wire('V+','R1:a'),wire('V+','R2:a'),
      wire('R1:b','D1:a'),wire('R2:b','D2:a'),
      wire('D1:b','GND'),wire('D2:b','GND')]);
  const x=solveCircuit(doc);
  assert.equal(x.status,'ok');
  near(x.sourceCurrentA,2*3/350);
  near(x.leds[0].currentA,x.leds[1].currentA);
});
test('a floating LED does not invent its potential or current',()=>{
  const doc=circuit([], [led('D1')], []);
  const x=solveCircuit(doc);
  assert.equal(x.status,'open');
  assert.equal(x.leds[0].state,'floating');
  assert.equal(x.leds[0].voltageV,null);
  assert.equal(x.leds[0].currentA,null);
});
test('an LED with both leads shorted together is bypassed',()=>{
  const doc=presetCircuit('led');
  doc.wires.push(wire('D1:a','D1:b'));
  const x=solveCircuit(doc);
  assert.equal(x.status,'open');
  assert.equal(x.leds[0].state,'bypassed');
  assert.ok(x.notices.some(n=>n.includes('bypassed')));
});
test('the ideal short check overrides LED numerical simulation',()=>{
  const doc=presetCircuit('led');
  doc.wires.push(wire('V+','GND'));
  const x=solveCircuit(doc);
  assert.equal(x.status,'short');
  assert.equal(x.sourceCurrentA,null);
  assert.equal(x.leds[0].state,'unresolved');
});
test('adding LED support does not change legacy resistor or switch circuits',()=>{
  const doc=presetCircuit('series');delete doc.leds;
  const x=solveCircuit(doc);
  near(x.sourceCurrentA,.0045);
  assert.deepEqual(x.leds,[]);
  const sw=presetCircuit('switch');delete sw.leds;sw.switches[0].closed=true;
  near(solveCircuit(sw).sourceCurrentA,.009);
});
test('import preserves legacy JSON and adds empty LED collection',()=>{
  const doc=presetCircuit('series');delete doc.leds;delete doc.switches;
  const sanitized=validateCircuit(doc);
  assert.deepEqual(sanitized.leds,[]);
  assert.deepEqual(sanitized.switches,[]);
});
test('import rejects unsupported colors',()=>{
  const doc=presetCircuit('led');doc.leds[0].color='ultraviolet';
  assert.throws(()=>validateCircuit(doc),RangeError);
});
test('import rejects non-string LED color and HTML-like IDs',()=>{
  const doc=presetCircuit('led');doc.leds[0].color={red:true};
  assert.throws(()=>validateCircuit(doc),RangeError);
  doc.leds[0].color='red';doc.leds[0].id='D1" onclick="evil()';
  assert.throws(()=>validateCircuit(doc),RangeError);
});
test('import rejects invalid coordinates, duplicate IDs and LED count',()=>{
  const doc=presetCircuit('led');doc.leds[0].x=-1;
  assert.throws(()=>validateCircuit(doc),RangeError);
  doc.leds=[led('D1'),led('D1')];
  assert.throws(()=>validateCircuit(doc),RangeError);
  doc.leds=Array.from({length:MAX_LEDS+1},(_,i)=>led('D'+(i+1)));
  assert.throws(()=>validateCircuit(doc),RangeError);
});
test('import rejects wires addressing nonexistent LED terminals',()=>{
  const doc=presetCircuit('led');
  doc.wires.push(wire('R1:a','D9:b'));
  assert.throws(()=>validateCircuit(doc),RangeError);
});
test('import strips unknown or hostile LED fields',()=>{
  const doc=presetCircuit('led');doc.leds[0].html='<script>attack()</script>';
  const clean=validateCircuit(doc);
  assert.equal(clean.leds[0].html,undefined);
});
test('import rejects nonarray LEDs and invalid supply',()=>{
  const doc=presetCircuit('led');doc.leds={};
  assert.throws(()=>validateCircuit(doc),RangeError);
  doc.leds=[led('D1')];doc.supplyV=Number.NaN;
  assert.throws(()=>validateCircuit(doc),RangeError);
});
