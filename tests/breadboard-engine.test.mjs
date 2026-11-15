import test from 'node:test';
import assert from 'node:assert/strict';
import {solveCircuit,validateCircuit} from '../wiring-solver.mjs';
import {
  BOARD_COLS,BOARD_ROWS,BOARD_HOLES,BREADBOARD_STORAGE_KEY,
  blankBreadboard,validateBreadboard,createBreadboardExample,
  breadboardToCircuit,analyzeBreadboard,
  measureBreadboardVoltage,traceBreadboardContinuity,
  addBoardJumper,addBoardPart,editBoardPart,removeBoardItem,setBoardSupply
} from '../breadboard-engine.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
const near=(got,target,tolerance=1e-7)=>assert.ok(
  typeof got==='number'&&Math.abs(got-target)<=tolerance,
  'Expected '+got+' ≈ '+target);
const connected=(doc,a,b)=>traceBreadboardContinuity(doc,a,b).connected;
const powered=(doc)=>analyzeBreadboard(doc).result;
test('training breadboard has 12 columns, 10 strips and two distinct rails',()=>{
  assert.equal(BOARD_COLS,12);
  assert.equal(BOARD_ROWS,'ABCDEFGHIJ');
  assert.equal(BOARD_HOLES.length,144);
  assert.equal(new Set(BOARD_HOLES).size,144);
  assert.ok(BOARD_HOLES.includes('A1'));
  assert.ok(BOARD_HOLES.includes('E12'));
  assert.ok(BOARD_HOLES.includes('J12'));
  assert.ok(BOARD_HOLES.includes('P1'));
  assert.ok(BOARD_HOLES.includes('N12'));
  assert.equal(BREADBOARD_STORAGE_KEY,'phi-circuit-lab-breadboard-v1');
});
test('all A–E holes in a column share one internal strip',()=>{
  const doc=blankBreadboard();
  for(let c=1;c<=12;c++)
    for(const row of 'ABCDE')assert.equal(connected(doc,'A'+c,row+c),true);
  assert.equal(connected(doc,'A3','B4'),false);
});
test('all F–J holes in a column share a second internal strip',()=>{
  const doc=blankBreadboard();
  for(let c=1;c<=12;c++)
    for(const row of 'FGHIJ')assert.equal(connected(doc,'F'+c,row+c),true);
  assert.equal(connected(doc,'J3','F4'),false);
});
test('central trench isolates E and F at the same column',()=>{
  const doc=blankBreadboard();
  for(let c=1;c<=12;c++)
    assert.equal(connected(doc,'E'+c,'F'+c),false);
  const bridged=addBoardJumper(doc,'E3','F3');
  assert.equal(connected(bridged,'E3','F3'),true);
  assert.equal(connected(doc,'E3','F3'),false);
});
test('power rails are each continuous but separate from each other',()=>{
  const doc=blankBreadboard();
  for(let c=1;c<=12;c++){
    assert.equal(connected(doc,'P1','P'+c),true);
    assert.equal(connected(doc,'N1','N'+c),true);
    assert.equal(connected(doc,'P'+c,'N'+c),false);
    assert.equal(connected(doc,'P'+c,'A'+c),false);
    assert.equal(connected(doc,'N'+c,'J'+c),false);
  }
});
test('rails are NOT powered until individually wired to supply jacks',()=>{
  const bare=blankBreadboard();
  assert.equal(connected(bare,'V+','P1'),false);
  assert.equal(connected(bare,'GND','N12'),false);
  assert.equal(measureBreadboardVoltage(bare,'P1','N1').status,'unavailable');
  const one=addBoardJumper(bare,'V+','P12');
  assert.equal(connected(one,'V+','P1'),true);
  assert.equal(connected(one,'GND','N1'),false);
  assert.equal(measureBreadboardVoltage(one,'P5','N5').status,'unavailable');
  const both=addBoardJumper(one,'GND','N3');
  const volts=measureBreadboardVoltage(both,'P5','N11');
  assert.equal(volts.status,'ok');
  near(volts.voltageV,5);
});
test('one series resistor crossing trench carries 9 mA at 9 V / 1k',()=>{
  const doc=createBreadboardExample('resistor');
  const x=powered(doc);
  assert.equal(x.status,'ok');
  near(x.sourceCurrentA,.009);
  assert.equal(x.parts[0].state,'active');
  near(x.parts[0].voltageV,9);
  near(measureBreadboardVoltage(doc,'A3','J3').voltageV,9);
  near(measureBreadboardVoltage(doc,'J3','A3').voltageV,-9);
});
test('resistor legs alone are never direct continuity connections',()=>{
  const doc=createBreadboardExample('resistor');
  assert.equal(connected(doc,'E3','F3'),false);
  assert.equal(powered(doc).status,'ok');
});
test('LED example conducts modeled forward current through series limiter',()=>{
  const doc=createBreadboardExample('led');
  const x=powered(doc);
  assert.equal(x.status,'ok');
  assert.equal(x.leds.length,1);
  assert.equal(x.leds[0].state,'on');
  assert.ok(x.leds[0].currentA>.004&&x.leds[0].currentA<.015);
  near(x.leds[0].currentA,x.parts[0].currentA);
  assert.equal(connected(doc,'E5','F5'),false);
  assert.equal(doc.parts[0].ohms,330);
});
test('reversed LED across trench does not conduct',()=>{
  const x=powered(createBreadboardExample('reverse-led'));
  assert.equal(x.leds[0].state,'off');
  near(x.sourceCurrentA,0);
});
test('switch preset begins open and only conducts when contact closes',()=>{
  const doc=createBreadboardExample('switch');
  assert.equal(powered(doc).status,'open');
  assert.equal(connected(doc,'E3','F3'),false);
  const closed=editBoardPart(doc,'S1',{closed:true});
  assert.equal(connected(closed,'E3','F3'),true);
  near(powered(closed).sourceCurrentA,.009);
  assert.equal(connected(doc,'E3','F3'),false);
});
test('parallel resistor preset adds branch currents and honors different values',()=>{
  const doc=createBreadboardExample('parallel');
  const result=powered(doc);
  assert.equal(result.status,'ok');
  near(result.parts[0].currentA,.009);
  near(result.parts[1].currentA,.0045);
  near(result.sourceCurrentA,.0135);
});
test('power rails short only when truly joined by ideal conductive path',()=>{
  const doc=createBreadboardExample('resistor');
  assert.equal(powered(doc).status,'ok');
  const short=addBoardJumper(doc,'P6','N6');
  assert.equal(powered(short).status,'short');
  assert.equal(powered(short).sourceCurrentA,null);
  assert.equal(measureBreadboardVoltage(short,'P1','N1').status,'unavailable');
  assert.equal(connected(short,'V+','GND'),true);
  assert.equal(powered(doc).status,'ok');
});
test('jumpers joining strips do not accidentally join unrelated columns',()=>{
  let doc=blankBreadboard();
  doc=addBoardJumper(doc,'E2','F7');
  assert.equal(connected(doc,'A2','J7'),true);
  assert.equal(connected(doc,'A3','J7'),false);
  assert.equal(connected(doc,'J2','A7'),false);
});
test('resistors in the same strip are physically bypassed',()=>{
  let doc=createBreadboardExample('resistor');
  doc.parts[0].a='A3';
  doc.parts[0].b='E3';
  assert.equal(powered(doc).parts[0].state,'bypassed');
  assert.equal(powered(doc).status,'open');
});
test('remove one source jumper and the circuit becomes open',()=>{
  let doc=createBreadboardExample('resistor');
  doc=removeBoardItem(doc,'wire',0);
  assert.equal(powered(doc).status,'open');
  assert.equal(connected(doc,'V+','P1'),false);
});
test('component placement defaults and associated editing are validated',()=>{
  let doc=blankBreadboard();
  doc=addBoardPart(doc,'resistor','E3','F3');
  doc=addBoardPart(doc,'switch','E5','F5');
  doc=addBoardPart(doc,'led','E7','F7');
  assert.deepEqual(doc.parts[0],{id:'R1',a:'E3',b:'F3',ohms:1000});
  assert.equal(doc.switches[0].closed,false);
  assert.equal(doc.leds[0].color,'red');
  doc=editBoardPart(doc,'R1',{ohms:330});
  doc=editBoardPart(doc,'D1',{color:'green'});
  doc=editBoardPart(doc,'S1',{closed:true});
  near(doc.parts[0].ohms,330);
  assert.equal(doc.leds[0].color,'green');
  assert.equal(doc.switches[0].closed,true);
  assert.equal(validateBreadboard(doc).parts.length,1);
});
test('flipping LED reverses anode/cathode, but keeps its physical holes',()=>{
  const base=createBreadboardExample('led');
  const flipped=editBoardPart(base,'D1',{flip:true});
  assert.equal(flipped.leds[0].a,base.leds[0].b);
  assert.equal(flipped.leds[0].b,base.leds[0].a);
  assert.equal(powered(flipped).leds[0].state,'off');
  assert.equal(powered(base).leds[0].state,'on');
  assert.deepEqual(editBoardPart(flipped,'D1',{flip:true}),base);
});
test('component removal frees holes and leaves unrelated wiring untouched',()=>{
  let doc=createBreadboardExample('led');
  const originalWires=clone(doc.wires);
  doc=removeBoardItem(doc,'led','D1');
  assert.equal(doc.leds.length,0);
  assert.deepEqual(doc.wires,originalWires);
  doc=addBoardPart(doc,'led','E5','F5');
  assert.equal(doc.leds[0].id,'D1');
  doc=removeBoardItem(doc,'part','R1');
  assert.equal(doc.parts.length,0);
});
test('component occupied holes and identical terminals are rejected',()=>{
  let doc=createBreadboardExample('resistor');
  assert.throws(()=>addBoardPart(doc,'led','E3','J3'),RangeError);
  assert.throws(()=>addBoardPart(doc,'resistor','E4','E4'),RangeError);
  assert.throws(()=>addBoardPart(doc,'led','V+','E3'),RangeError);
  assert.throws(()=>addBoardPart(doc,'resistor','X1','A1'),RangeError);
  assert.equal(doc.parts.length,1);
});
test('parts cannot exceed solver component limits or jumper count',()=>{
  let doc=blankBreadboard();
  for(let i=1;i<=8;i++)doc=addBoardPart(doc,'resistor','A'+i,'F'+i);
  assert.throws(()=>addBoardPart(doc,'resistor','A9','F9'),RangeError);
  for(let i=1;i<=4;i++)doc=addBoardPart(doc,'switch','B'+(i+8),'G'+(i+8));
  assert.throws(()=>addBoardPart(doc,'switch','C1','H1'),RangeError);
  let led=blankBreadboard();
  for(let i=1;i<=3;i++)led=addBoardPart(led,'led','A'+i,'F'+i);
  assert.throws(()=>addBoardPart(led,'led','A4','F4'),RangeError);
  let wires=blankBreadboard();
  for(let i=1;i<=12;i++)wires=addBoardJumper(wires,'P'+i,'A'+i);
  for(let i=1;i<=12;i++)wires=addBoardJumper(wires,'N'+i,'F'+i);
  for(let i=1;i<=12;i++)wires=addBoardJumper(wires,'A'+i,'F'+i);
  for(let i=1;i<=4;i++)wires=addBoardJumper(wires,'B'+i,'G'+i);
  assert.equal(wires.wires.length,40);
  assert.throws(()=>addBoardJumper(wires,'B5','G5'),RangeError);
});
test('supply and LED color editing observe model thresholds and ranges',()=>{
  const led=createBreadboardExample('led');
  const noPower=setBoardSupply(led,0);
  assert.equal(powered(noPower).leds[0].state,'off');
  const blue=editBoardPart(led,'D1',{color:'blue'});
  assert.ok(powered(blue).leds[0].currentA<powered(led).leds[0].currentA);
  assert.throws(()=>setBoardSupply(led,25),RangeError);
  assert.throws(()=>editBoardPart(led,'R1',{ohms:-1}),RangeError);
  assert.throws(()=>editBoardPart(led,'D1',{color:'ultraviolet'}),RangeError);
});
test('jumpers reject duplicate, reversed duplicate and invalid contacts',()=>{
  const base=blankBreadboard();
  let doc=addBoardJumper(base,'A1','F1');
  assert.throws(()=>addBoardJumper(doc,'A1','F1'),RangeError);
  assert.throws(()=>addBoardJumper(doc,'F1','A1'),RangeError);
  assert.throws(()=>addBoardJumper(doc,'A1','A1'),RangeError);
  assert.throws(()=>addBoardJumper(doc,'X1','F1'),RangeError);
  assert.throws(()=>addBoardJumper(doc,'P0','A1'),RangeError);
});
test('generic circuit converter retains schema, currents and model warnings',()=>{
  for(const kind of ['blank','resistor','led','reverse-led','switch','parallel']){
    const board=createBreadboardExample(kind);
    const circuit=breadboardToCircuit(board);
    assert.deepEqual(validateCircuit(circuit),circuit);
    assert.ok(circuit.wires.length<=40);
    const direct=solveCircuit(circuit);
    const via=analyzeBreadboard(board).result;
    assert.deepEqual(direct,via);
  }
});
test('hole probing returns voltage only for resolved physical nets',()=>{
  const doc=createBreadboardExample('resistor');
  const x=measureBreadboardVoltage(doc,'A3','F3');
  assert.equal(x.status,'ok');near(x.voltageV,9);
  const y=measureBreadboardVoltage(doc,'A4','G4');
  assert.equal(y.status,'unavailable');
  assert.throws(()=>measureBreadboardVoltage(doc,'R999','GND'),RangeError);
});
test('continuity follows closed switches but not resistors or LEDs',()=>{
  const doc=createBreadboardExample('switch');
  assert.equal(connected(doc,'E3','F3'),false);
  assert.equal(connected(editBoardPart(doc,'S1',{closed:true}),'E3','F3'),true);
  assert.equal(connected(createBreadboardExample('led'),'E3','F3'),false);
  assert.equal(connected(createBreadboardExample('led'),'E5','F5'),false);
});
test('invalid source, parts, IDs and imported documents fail closed',()=>{
  const invalids=[
    null,{},[],{...blankBreadboard(),version:2},
    {...blankBreadboard(),supplyV:NaN},
    {...blankBreadboard(),supplyV:'5'},
    {...blankBreadboard(),wires:[{a:'A1',b:'A1'}]},
    {...blankBreadboard(),wires:[{a:'P13',b:'N1'}]},
    {...blankBreadboard(),parts:[{id:'R0',a:'A1',b:'F1',ohms:1000}]},
    {...blankBreadboard(),switches:[{id:'S1',a:'A1',b:'F1',closed:'true'}]},
    {...blankBreadboard(),leds:[{id:'D1',a:'A1',b:'F1',color:'orange'}]},
  ];
  for(const bad of invalids)assert.throws(()=>validateBreadboard(bad));
});
test('import sanitizes untrusted extras but preserves valid circuit behavior',()=>{
  const base=createBreadboardExample('resistor');
  const altered=clone(base);
  altered.script='<img onerror=alert(1)>';
  altered.parts[0].html='<script>alert(1)</script>';
  const clean=validateBreadboard(altered);
  assert.equal('script' in clean,false);
  assert.equal('html' in clean.parts[0],false);
  near(powered(clean).sourceCurrentA,.009);
});
test('validation never mutates original documents',()=>{
  const base=createBreadboardExample('led'),before=JSON.stringify(base);
  validateBreadboard(base);analyzeBreadboard(base);breadboardToCircuit(base);
  measureBreadboardVoltage(base,'P1','N1');
  traceBreadboardContinuity(base,'P1','P12');
  assert.equal(JSON.stringify(base),before);
});
test('invalid component editing cannot modify physical topology',()=>{
  const doc=createBreadboardExample('led');
  const original=JSON.stringify(doc);
  assert.throws(()=>editBoardPart(doc,'NOT_REAL',{ohms:5}),RangeError);
  assert.throws(()=>editBoardPart(doc,'R1',{closed:true}),RangeError);
  assert.throws(()=>editBoardPart(doc,'D1',{unknown:7}),RangeError);
  assert.throws(()=>removeBoardItem(doc,'wire',99),RangeError);
  assert.equal(JSON.stringify(doc),original);
});
