import test from 'node:test';
import assert from 'node:assert/strict';
import { createMission } from '../academy-engine.mjs';
import {
  MYSTERY_CASE_COUNT, MYSTERY_CATALOG, MIN_UNIQUE_MEASUREMENTS,
  createMysteryCase, getFaultedRepairDocument, getCaseDiagnosis,
  takeMysteryMeasurement, evidenceProgress, judgeMysteryDiagnosis,
  gradeMysteryRepair, mysteryScore
} from '../mystery-engine.mjs';

const near=(a,b,eps=1e-8)=>assert.ok(typeof a==='number'&&Math.abs(a-b)<eps,
  'Expected '+a+' to be close to '+b);
const request=(mode,red,black,part)=>({mode,red,black,part});

test('eight sealed work orders do not expose repairs or diagnosed fault names',()=>{
  assert.equal(MYSTERY_CASE_COUNT,8);
  assert.equal(MYSTERY_CATALOG.length,8);
  assert.deepEqual(MYSTERY_CATALOG.map(c=>c.id),'ABCDEFGH'.split(''));
  for(let i=0;i<8;i++){
    const x=createMysteryCase(369,i);
    const keys=Object.keys(x);
    assert.equal(keys.includes('initial'),false);
    assert.equal(keys.includes('reference'),false);
    assert.equal(keys.includes('diagnosis'),false);
    assert.equal(keys.includes('hint'),false);
    assert.ok(x.report&&x.task&&x.title);
    assert.ok(x.terminals.includes('V+')&&x.terminals.includes('GND'));
  }
});
test('seeded faulty scenarios are reproducible and isolate the original doc',()=>{
  for(const seed of [0,369,98217,4294967295]){
    for(let i=0;i<MYSTERY_CASE_COUNT;i++){
      assert.deepEqual(getFaultedRepairDocument(seed,i),getFaultedRepairDocument(seed,i));
      const m=getCaseDiagnosis(seed,i);
      assert.equal(gradeMysteryRepair(seed,i,m.reference).ok,true,
        'Unexpected unrepairable mystery at seed '+seed+' case '+i);
      assert.equal(gradeMysteryRepair(seed,i,getFaultedRepairDocument(seed,i)).ok,false,
        'Mystery case '+i+' at seed '+seed+' should start faulty');
    }
  }
});
test('invalid seeds and case indices fail closed',()=>{
  for(const seed of [-1,4294967296,NaN,Infinity,'369'])
    assert.throws(()=>createMysteryCase(seed,0),RangeError);
  for(const index of [-1,8,1.2,NaN])
    assert.throws(()=>createMysteryCase(369,index),RangeError);
});
test('meter samples only model results and never returns original circuit',()=>{
  const x=takeMysteryMeasurement(369,0,request('voltage','V+','GND'));
  assert.equal(x.mode,'voltage');
  assert.equal(x.readout,'9.000 V');
  assert.equal(x.status,'ok');
  assert.equal(x.nonSource,false);
  assert.equal('document' in x,false);
  assert.equal('wires' in x,false);
  assert.equal('diagnosis' in x,false);
  assert.equal(Object.isFrozen(x),true);
});
test('reversed voltage probes yield opposite signs but share evidence key',()=>{
  const a=takeMysteryMeasurement(369,0,request('voltage','V+','GND'));
  const b=takeMysteryMeasurement(369,0,request('voltage','GND','V+'));
  assert.equal(a.key,b.key);
  assert.equal(a.readout,'9.000 V');
  assert.equal(b.readout,'-9.000 V');
});
test('internal probes can read an open switch versus a closed switch',()=>{
  const x=takeMysteryMeasurement(369,2,request('voltage','S1:a','S1:b'));
  assert.equal(x.readout,'9.000 V');
  assert.equal(x.nonSource,true);
  const continuity=takeMysteryMeasurement(369,2,request('continuity','S1:a','S1:b'));
  assert.equal(continuity.readout,'OPEN');
});
test('a disconnected branch produces honest unresolved or inactive results',()=>{
  const x=takeMysteryMeasurement(369,1,request('current',null,null,'R2'));
  assert.ok(x.status==='floating'||x.status==='ok');
  assert.ok(x.readout==='—'||x.readout==='0.000 mA');
});
test('current inspection reads a resistor without presenting a schematic',()=>{
  const x=takeMysteryMeasurement(369,4,request('current',null,null,'R1'));
  assert.equal(x.status,'ok');
  assert.ok(x.readout.endsWith(' mA'));
  assert.equal(x.nonSource,true);
  assert.equal(x.part,'R1');
});
test('source short rejects invented voltage but continuity exposes real connection',()=>{
  const v=takeMysteryMeasurement(369,6,request('voltage','V+','GND'));
  assert.equal(v.readout,'—');
  assert.equal(v.status,'unavailable');
  const c=takeMysteryMeasurement(369,6,request('continuity','V+','GND'));
  assert.equal(c.readout,'CONNECTED');
  assert.equal(c.status,'connected');
});
test('LED reverse and low supply cases produce distinct useful measurements',()=>{
  const reversed=takeMysteryMeasurement(369,3,request('voltage','D1:a','D1:b'));
  assert.equal(reversed.status,'ok');
  assert.ok(reversed.readout.startsWith('-'));
  const undervoltage=takeMysteryMeasurement(369,5,request('current',null,null,'D1'));
  assert.equal(undervoltage.readout,'0.000 mA');
});
test('instrument rejects unknown modes, components and probes',()=>{
  assert.throws(()=>takeMysteryMeasurement(369,0,{mode:'oscilloscope'}),RangeError);
  assert.throws(()=>takeMysteryMeasurement(369,0,request('voltage','R999:a','GND')),RangeError);
  assert.throws(()=>takeMysteryMeasurement(369,0,request('current',null,null,'DROP TABLE')),RangeError);
  assert.throws(()=>takeMysteryMeasurement(369,0,null),TypeError);
});
test('recording duplicates, reversed leads and only source tests cannot unlock',()=>{
  const source=takeMysteryMeasurement(369,0,request('voltage','V+','GND'));
  const inverse=takeMysteryMeasurement(369,0,request('voltage','GND','V+'));
  const continuity=takeMysteryMeasurement(369,0,request('continuity','V+','GND'));
  assert.equal(evidenceProgress([source,inverse]).count,1);
  assert.equal(evidenceProgress([source,inverse]).ready,false);
  assert.equal(evidenceProgress([source,continuity]).ready,false);
  assert.equal(evidenceProgress([source,continuity]).distinctNonSource,0);
});
test('two distinct measurements, including an internal test point, unlock diagnosis',()=>{
  const source=takeMysteryMeasurement(369,0,request('voltage','V+','GND'));
  const internal=takeMysteryMeasurement(369,0,request('current',null,null,'R1'));
  const progress=evidenceProgress([source,internal]);
  assert.equal(MIN_UNIQUE_MEASUREMENTS,2);
  assert.equal(progress.count,2);
  assert.equal(progress.ready,true);
  assert.equal(judgeMysteryDiagnosis(369,0,'open',[source,internal]).allowed,true);
  assert.equal(judgeMysteryDiagnosis(369,0,'open',[source,internal]).correct,true);
  assert.equal(judgeMysteryDiagnosis(369,0,'switch',[source,internal]).correct,false);
});
test('diagnosis cannot be revealed with zero measurements or blank choice',()=>{
  const source=takeMysteryMeasurement(369,0,request('voltage','V+','GND'));
  const internal=takeMysteryMeasurement(369,0,request('current',null,null,'R1'));
  assert.equal(judgeMysteryDiagnosis(369,0,'open',[]).allowed,false);
  assert.equal(judgeMysteryDiagnosis(369,0,'open',[source]).allowed,false);
  assert.equal(judgeMysteryDiagnosis(369,0,'',[source,internal]).allowed,false);
});
test('evidence is a strict typed array',()=>{
  assert.throws(()=>evidenceProgress('voltage'),TypeError);
  assert.equal(evidenceProgress([null,{},42]).ready,false);
});
test('wrong repair cannot pass even when diagnosis was correct',()=>{
  const faulty=getFaultedRepairDocument(369,0);
  assert.equal(gradeMysteryRepair(369,0,faulty).ok,false);
  const extra=structuredClone(getCaseDiagnosis(369,0).reference);
  extra.wires.push({a:'V+',b:'GND'});
  assert.equal(gradeMysteryRepair(369,0,extra).ok,false);
});
test('all eight cases have a distinct diagnosis target in this curriculum',()=>{
  const diagnoses=Array.from({length:MYSTERY_CASE_COUNT},(_,i)=>getCaseDiagnosis(369,i).correctId);
  assert.deepEqual(diagnoses,['open','partial','switch','reverse',
    'overcurrent','threshold','short','double']);
});
test('scoring rewards evidence, correct diagnosis and valid repair',()=>{
  assert.equal(mysteryScore({correctDiagnosis:true,evidenceCount:3}),100);
  assert.equal(mysteryScore({correctDiagnosis:true,evidenceCount:2}),80);
  assert.equal(mysteryScore({correctDiagnosis:false,evidenceCount:3}),70);
  assert.equal(mysteryScore({correctDiagnosis:true,evidenceCount:3,hintUsed:true}),90);
  assert.equal(mysteryScore({correctDiagnosis:false,evidenceCount:2,hintUsed:true,failedChecks:99}),25);
  assert.throws(()=>mysteryScore({evidenceCount:-1}),RangeError);
  assert.throws(()=>mysteryScore({failedChecks:1.5}),RangeError);
});
test('malformed data cannot be accepted as a valid repair',()=>{
  assert.equal(gradeMysteryRepair(369,0,{}).ok,false);
  const wrong=getFaultedRepairDocument(369,0);
  wrong.parts[0].id='<script>';
  assert.equal(gradeMysteryRepair(369,0,wrong).ok,false);
});
