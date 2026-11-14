import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateOhms, simulateLed, logicGate } from '../circuits.mjs';

test('5 volts across 1 kiloohm is 5 mA', () => {
  const x = simulateOhms(5,1000);
  assert.equal(x.currentA, 0.005);
  assert.equal(x.currentMa, 5);
  assert.equal(x.powerW, 0.025);
});
test('doubling resistance halves current', () => {
  assert.equal(simulateOhms(10,2000).currentA,simulateOhms(5,1000).currentA);
});
test('zero voltage produces zero current', () => {
  assert.equal(simulateOhms(0,330).currentMa,0);
});
test('zero resistance is rejected', () => {
  assert.throws(() => simulateOhms(5,0), RangeError);
});
test('NaN input is rejected', () => {
  assert.throws(() => simulateOhms(NaN,330), RangeError);
});
test('LED with insufficient supply produces no current', () => {
  const x = simulateLed(1,330,2);
  assert.equal(x.currentMa,0);
  assert.equal(x.status,'off');
});
test('red LED with 330 ohms has approximately 9.09 mA', () => {
  const x = simulateLed(5,330,2);
  assert.ok(Math.abs(x.currentMa-9.090909)<1e-5);
  assert.equal(x.status,'nominal');
});
test('overcurrent is flagged', () => {
  assert.equal(simulateLed(12,100,2).status,'caution');
});
test('high resistor dissipation is flagged', () => {
  assert.equal(simulateLed(12,220,2).status,'caution');
});
test('LED resistor dissipation uses I squared R', () => {
  const x = simulateLed(5,330,2);
  assert.ok(Math.abs(x.resistorW-(x.currentA**2*330))<1e-9);
});
for (const gate of ['AND','OR','XOR','NAND','NOR','XNOR']) {
  test(gate+' truth table matches known outputs', () => {
    const expected = {
      AND:[0,0,0,1], OR:[0,1,1,1], XOR:[0,1,1,0],
      NAND:[1,1,1,0], NOR:[1,0,0,0], XNOR:[1,0,0,1]
    }[gate];
    [[0,0],[0,1],[1,0],[1,1]].forEach(([a,b],i) => assert.equal(logicGate(gate,a,b),expected[i]));
  });
}
test('logic gate rejects invalid input', () => {
  assert.throws(() => logicGate('AND',2,0),RangeError);
  assert.throws(() => logicGate('OTHER',0,0),RangeError);
});
