import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCOPE_CONFIG, SCOPE_SAMPLES, validateScopeConfig,
  scopeTauSeconds, sourceEdges, simulateScope, scopeSampleAt,
  scopeCursorPair, scopeCsv
} from '../scope-engine.mjs';
import {rcTransient} from '../advanced-circuits.mjs';

const near=(got,expected,tol=1e-9)=>{
  assert.ok(Number.isFinite(got)&&Math.abs(got-expected)<=tol,
    'Expected '+got+' ≈ '+expected+' ± '+tol);
};
const settings=overrides=>({...DEFAULT_SCOPE_CONFIG,...overrides});
test('default sample count, config and ideal time constant',()=>{
  assert.equal(SCOPE_SAMPLES,501);
  const data=simulateScope(settings());
  near(data.tauSeconds,.1);
  near(data.durationSeconds,.8);
  assert.equal(data.samples.length,501);
  near(data.samples[0].timeSeconds,0);
  near(data.samples[500].timeSeconds,.8);
  assert.equal(data.edges.length,0);
});
test('at t=0 capacitor remains at initial voltage while source is already high',()=>{
  const x=scopeSampleAt(settings(),0);
  near(x.sourceV,5);
  near(x.capacitorV,0);
  near(x.resistorV,5);
  near(x.currentA,.005);
});
test('at one RC time constant a step reaches 63.212% of the way',()=>{
  const cfg=settings();
  const at=scopeSampleAt(cfg,scopeTauSeconds(cfg));
  near(at.capacitorV,5*(1-Math.exp(-1)));
  near(at.currentA,5*Math.exp(-1)/1000);
});
test('long-time step approaches supply without exceeding it',()=>{
  const cfg=settings({windowTau:24});
  const data=simulateScope(cfg);
  const last=data.samples.at(-1);
  assert.ok(last.capacitorV>4.999999999);
  assert.ok(last.capacitorV<=5);
  near(last.currentA,0,1e-10);
  near(last.sourceV-last.capacitorV,last.resistorV,1e-12);
});
test('repeated scalar reading matches sampled trace at exact sample times',()=>{
  const cfg=settings({waveform:'square',periodTau:2.5,dutyPercent:30,windowTau:13});
  const trace=simulateScope(cfg);
  for(let i=0;i<trace.samples.length;i+=23){
    const p=trace.samples[i];
    const scalar=scopeSampleAt(cfg,p.timeSeconds);
    near(p.capacitorV,scalar.capacitorV,1e-11);
    near(p.currentA,scalar.currentA,1e-11);
    near(p.sourceV,scalar.sourceV,1e-11);
  }
});
test('exact analytic step agrees with existing RC teaching bench',()=>{
  const cfg=settings({windowTau:12});
  for(const multiplier of [0,.01,.5,1,2,3,5,11]){
    const t=scopeTauSeconds(cfg)*multiplier;
    const x=scopeSampleAt(cfg,t);
    const old=rcTransient(5,1000,100,t,'charge');
    near(x.capacitorV,old.capacitorV,1e-12);
    near(x.currentA,old.currentA,1e-12);
  }
});
test('initially charged capacitor discharges exponentially into zero source',()=>{
  const cfg=settings({supplyV:0,initialV:5});
  const x=scopeSampleAt(cfg,.1);
  near(x.capacitorV,5*Math.exp(-1));
  near(x.resistorV,-5*Math.exp(-1));
  near(x.currentA,-.005*Math.exp(-1));
  near(x.energyJ,.5*.0001*x.capacitorV*x.capacitorV);
  const old=rcTransient(5,1000,100,.1,'discharge');
  near(x.capacitorV,old.capacitorV);
  near(x.currentA,old.currentA);
});
test('initial capacitor voltage may be above source and yields reverse current',()=>{
  const cfg=settings({supplyV:3,initialV:10});
  const start=scopeSampleAt(cfg,0);
  near(start.currentA,-.007);
  const one=scopeSampleAt(cfg,.1);
  near(one.capacitorV,3+7*Math.exp(-1));
});
test('zero source and zero initial state stay at zero',()=>{
  const trace=simulateScope(settings({supplyV:0,initialV:0,waveform:'square'}));
  for(const p of trace.samples){
    near(p.capacitorV,0);near(p.resistorV,0);near(p.currentA,0);near(p.energyJ,0);
  }
});
test('pulse falling edge is integrated with continuous capacitor voltage',()=>{
  const cfg=settings({waveform:'pulse',pulseWidthTau:2});
  const before=scopeSampleAt(cfg,.2-1e-8);
  const at=scopeSampleAt(cfg,.2);
  const after=scopeSampleAt(cfg,.2+1e-8);
  const expected=5*(1-Math.exp(-2));
  near(at.capacitorV,expected,1e-10);
  near(at.sourceV,0);
  near(at.resistorV,-expected);
  assert.ok(Math.abs(after.capacitorV-before.capacitorV)<1e-5);
  assert.ok(after.capacitorV<at.capacitorV);
});
test('pulse after falling edge exhibits proper exponential discharge',()=>{
  const cfg=settings({waveform:'pulse',pulseWidthTau:2});
  const at=scopeSampleAt(cfg,.3);
  near(at.capacitorV,5*(1-Math.exp(-2))*Math.exp(-1),1e-10);
  assert.ok(at.currentA<0);
});
test('pulse beyond visible window does not produce an off edge',()=>{
  const cfg=settings({waveform:'pulse',windowTau:2,pulseWidthTau:12});
  assert.equal(sourceEdges(cfg).length,0);
  near(scopeSampleAt(cfg,.2).sourceV,5);
});
test('square waveform has exact falling and rising edges',()=>{
  const cfg=settings({waveform:'square',periodTau:4,dutyPercent:50,windowTau:8});
  const edges=sourceEdges(cfg);
  near(edges[0].timeSeconds,.2);
  near(edges[1].timeSeconds,.4);
  near(edges[2].timeSeconds,.6);
  near(edges[3].timeSeconds,.8);
  assert.deepEqual(edges.map(e=>e.levelAfterV),[0,5,0,5]);
});
test('square periodic settled state and capacitor continuity at edges',()=>{
  const cfg=settings({waveform:'square',periodTau:4,dutyPercent:50,windowTau:24});
  const nearEdge=scopeSampleAt(cfg,.2);
  const before=scopeSampleAt(cfg,.2-1e-9);
  const after=scopeSampleAt(cfg,.2+1e-9);
  assert.equal(nearEdge.sourceV,0);
  assert.ok(Math.abs(before.capacitorV-after.capacitorV)<1e-7);
  assert.ok(nearEdge.currentA<0);
  const samples=simulateScope(cfg).samples;
  assert.ok(samples.at(-1).capacitorV>0&&samples.at(-1).capacitorV<5);
  assert.ok(samples.every(x=>x.capacitorV>=0&&x.capacitorV<=5));
});
test('short duty cycle is not silently missed by integration',()=>{
  const cfg=settings({waveform:'square',periodTau:1,dutyPercent:10,windowTau:10});
  const at=scopeSampleAt(cfg,.01);
  near(at.capacitorV,5*(1-Math.exp(-.1)),1e-10);
  near(at.sourceV,0);
  const later=scopeSampleAt(cfg,.1);
  assert.ok(later.capacitorV>0);
});
test('period and duty cycle change physics of the trace',()=>{
  const slow=settings({waveform:'square',periodTau:8,dutyPercent:50,windowTau:8});
  const fast=settings({waveform:'square',periodTau:1,dutyPercent:50,windowTau:8});
  const a=scopeSampleAt(slow,.2),b=scopeSampleAt(fast,.2);
  assert.notEqual(a.capacitorV,b.capacitorV);
});
test('energy is always 0.5 C V² and no imaginary resistance dissipation',()=>{
  const cfg=settings({waveform:'pulse',pulseWidthTau:1});
  for(const p of simulateScope(cfg).samples){
    near(p.energyJ,.5*cfg.capacitanceMicroF*1e-6*p.capacitorV*p.capacitorV,1e-12);
    near(p.resistorV,p.currentA*cfg.resistanceOhms,1e-11);
  }
});
test('RC scaling preserves normalized transient shape while shifting time',()=>{
  const a=settings({resistanceOhms:1000,capacitanceMicroF:100});
  const b=settings({resistanceOhms:2000,capacitanceMicroF:100});
  near(scopeSampleAt(a,.1).capacitorV,scopeSampleAt(b,.2).capacitorV);
  near(scopeTauSeconds(b),2*scopeTauSeconds(a));
});
test('10–90% time is textbook 2.197 × tau',()=>{
  const x=simulateScope(settings());
  near(x.riseTime1090Seconds,Math.log(9)*x.tauSeconds);
  near(x.timeTo632Seconds,x.tauSeconds);
});
test('two cursors report signed time and voltage differences',()=>{
  const trace=simulateScope(settings());
  const x=scopeCursorPair(trace,.25,.65);
  near(x.a.timeSeconds,.2);
  near(x.b.timeSeconds,.52);
  near(x.deltaTimeSeconds,.32);
  assert.ok(x.deltaCapacitorV>0);
  const y=scopeCursorPair(trace,.65,.25);
  near(y.deltaTimeSeconds,-.32);
  near(y.deltaCapacitorV,-x.deltaCapacitorV);
});
test('scope csv has header, 501 samples and numeric scientific columns',()=>{
  const trace=simulateScope(settings());
  const csv=scopeCsv(trace);
  const lines=csv.trim().split('\n');
  assert.equal(lines.length,SCOPE_SAMPLES+1);
  assert.equal(lines[0],'time_s,source_v,capacitor_v,resistor_v,current_a,energy_j');
  for(const line of [lines[1],lines[150],lines[501]]){
    const nums=line.split(',').map(Number);
    assert.equal(nums.length,6);
    assert.ok(nums.every(Number.isFinite));
  }
});
test('scope schema sanitizes hostile extraneous fields',()=>{
  const cfg=settings({evil:'<script>alert(1)</script>'});
  const clean=validateScopeConfig(cfg);
  assert.equal(clean.evil,undefined);
  assert.deepEqual(clean,DEFAULT_SCOPE_CONFIG);
});
test('scope config refuses invalid and nonfinite values',()=>{
  assert.throws(()=>validateScopeConfig(null),TypeError);
  assert.throws(()=>validateScopeConfig([]),TypeError);
  for(const waveform of ['sine','triangle','<script>','PWM',null]){
    assert.throws(()=>validateScopeConfig(settings({waveform})),RangeError);
  }
  for(const [field,value] of [
    ['supplyV',Infinity],['supplyV',-1],['supplyV',13],
    ['resistanceOhms',0],['resistanceOhms',99],['resistanceOhms',1000001],
    ['capacitanceMicroF',0],['capacitanceMicroF',1001],
    ['initialV',-2],['initialV',13],['windowTau',1],['windowTau',25],
    ['pulseWidthTau',0],['periodTau',0],['dutyPercent',9],['dutyPercent',91]
  ])assert.throws(()=>validateScopeConfig(settings({[field]:value})),RangeError,
    field+' should reject '+value);
});
test('probe rejects out-of-range times and cursor fractions',()=>{
  assert.throws(()=>scopeSampleAt(settings(),-.1),RangeError);
  assert.throws(()=>scopeSampleAt(settings(),1),RangeError);
  const trace=simulateScope(settings());
  assert.throws(()=>scopeCursorPair(trace,-.01,.5),RangeError);
  assert.throws(()=>scopeCursorPair(trace,.5,1.01),RangeError);
  assert.throws(()=>scopeCursorPair(trace,NaN,.5),RangeError);
});
test('fine time steps remain numerically accurate, even with tiny tau',()=>{
  const cfg=settings({resistanceOhms:100,capacitanceMicroF:1});
  const tau=scopeTauSeconds(cfg);
  assert.ok(tau>0);
  const v=scopeSampleAt(cfg,tau*1e-5).capacitorV;
  near(v,5*(1-Math.exp(-1e-5)),1e-12);
});
test('scope traces can be calculated without mutating original settings',()=>{
  const config=settings();
  const original=JSON.stringify(config);
  simulateScope(config);scopeSampleAt(config,.1);
  assert.equal(JSON.stringify(config),original);
});
