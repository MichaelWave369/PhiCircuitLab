import test from 'node:test';
import assert from 'node:assert/strict';
import { resistorNetwork, voltageDivider, rcTransient } from '../advanced-circuits.mjs';

const near = (actual, expected, epsilon=1e-10) =>
  assert.ok(Math.abs(actual-expected) <= epsilon, 'expected '+actual+' to be near '+expected);

test('series equivalent resistance and branch currents', () => {
  const x = resistorNetwork(6,600,300,'series');
  near(x.equivalentOhms,900);
  near(x.totalCurrentA,6/900);
  near(x.current1A,x.totalCurrentA);
  near(x.current2A,x.totalCurrentA);
  near(x.voltage1V,4);
  near(x.voltage2V,2);
  near(x.totalPowerW,x.power1W+x.power2W);
});
test('parallel resistors share voltage and add branch currents', () => {
  const x = resistorNetwork(6,600,300,'parallel');
  near(x.equivalentOhms,200);
  near(x.totalCurrentA,.03);
  near(x.current1A,.01);
  near(x.current2A,.02);
  near(x.voltage1V,6);
  near(x.voltage2V,6);
  near(x.totalPowerW,x.power1W+x.power2W);
});
test('series and parallel equivalent resistance at equal values', () => {
  near(resistorNetwork(5,1000,1000,'series').equivalentOhms,2000);
  near(resistorNetwork(5,1000,1000,'parallel').equivalentOhms,500);
});
test('zero voltage produces no current and zero power', () => {
  for (const mode of ['series','parallel']) {
    const x = resistorNetwork(0,100,330,mode);
    near(x.totalCurrentA,0);
    near(x.totalPowerW,0);
  }
});
test('rejects invalid network inputs', () => {
  assert.throws(() => resistorNetwork(4,0,100),RangeError);
  assert.throws(() => resistorNetwork(4,-1,100),RangeError);
  assert.throws(() => resistorNetwork(Infinity,100,100),RangeError);
  assert.throws(() => resistorNetwork(4,100,100,'triangle'),RangeError);
});
test('unloaded divider equation', () => {
  const x = voltageDivider(9,2000,1000);
  near(x.outputV,3);
  near(x.currentSourceA,.003);
  near(x.currentBottomA,.003);
  near(x.currentLoadA,0);
  near(x.topDropV,6);
});
test('divider load lowers the output voltage', () => {
  const unloaded = voltageDivider(9,2000,1000);
  const x = voltageDivider(9,2000,1000,1000);
  near(x.effectiveBottomOhms,500);
  near(x.outputV,1.8);
  near(x.currentSourceA,.0036);
  near(x.currentLoadA,.0018);
  near(x.currentBottomA,.0018);
  assert.ok(x.outputV < unloaded.outputV);
});
test('loaded divider satisfies current and power conservation', () => {
  const x = voltageDivider(12,1000,2000,1000);
  near(x.currentSourceA,x.currentBottomA+x.currentLoadA);
  near(12*x.currentSourceA,x.topPowerW+x.bottomPowerW+x.loadPowerW);
});
test('zero input produces zero divider output', () => {
  near(voltageDivider(0,100,100,100).outputV,0);
});
test('rejects invalid divider inputs', () => {
  assert.throws(() => voltageDivider(5,0,100),RangeError);
  assert.throws(() => voltageDivider(5,100,100,0),RangeError);
  assert.throws(() => voltageDivider(-1,100,100),RangeError);
  assert.throws(() => voltageDivider(5,100,NaN),RangeError);
});
test('RC time constant is resistance times capacitance', () => {
  near(rcTransient(5,1000,100,.1).tauSeconds,.1);
});
test('charging begins at 0 V, with initial positive current', () => {
  const x = rcTransient(5,1000,100,0,'charge');
  near(x.capacitorV,0);
  near(x.currentA,.005);
});
test('charging at one tau is 63.2 percent', () => {
  const x = rcTransient(5,1000,100,.1,'charge');
  near(x.capacitorV / x.supplyV,1-Math.exp(-1));
});
test('discharging starts at full voltage, with reverse current', () => {
  const x = rcTransient(5,1000,100,0,'discharge');
  near(x.capacitorV,5);
  near(x.currentA,-.005);
});
test('discharge after one tau retains 36.8 percent', () => {
  const x = rcTransient(5,1000,100,.1,'discharge');
  near(x.capacitorV/5,Math.exp(-1));
});
test('RC capacitor energy is half C V squared', () => {
  const x = rcTransient(5,1000,100,0,'discharge');
  near(x.storedEnergyJ,0.5*100e-6*25);
});
test('at five tau charge is close to final voltage', () => {
  const x = rcTransient(5,1000,100,.5,'charge');
  assert.ok(x.capacitorV > 4.96 && x.capacitorV < 5);
});
test('rejects invalid RC model parameters', () => {
  assert.throws(() => rcTransient(5,0,100,.1),RangeError);
  assert.throws(() => rcTransient(5,1000,0,.1),RangeError);
  assert.throws(() => rcTransient(5,1000,100,-1),RangeError);
  assert.throws(() => rcTransient(5,1000,100,.1,'other'),RangeError);
  assert.throws(() => rcTransient(5,1000,100,Infinity),RangeError);
});
