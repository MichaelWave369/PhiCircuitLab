import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS, getLayout, analyzeCircuit, netlistFor, validateLayouts } from '../ancient-layouts.mjs';

test('three source-backed layouts have valid component positions', () => {
  assert.equal(validateLayouts(), true);
  assert.deepEqual(Object.keys(LAYOUTS).sort(), ['ezekiel','solomon','teotihuacan']);
  for (const layout of Object.values(LAYOUTS)) {
    assert.ok(layout.sources.every(source => /^https:\/\//.test(source.url)));
    assert.ok(layout.claim.length > 60);
    assert.ok(layout.evidence);
  }
});
test('ancient architecture models make distinct provenance claims', () => {
  assert.match(getLayout('solomon').claim, /60 × 20 cubits/);
  assert.match(getLayout('ezekiel').claim, /500 × 500 cubits/);
  assert.match(getLayout('teotihuacan').claim, /Moon.*northern/);
});
test('the LED circuit uses an explicitly idealized 2 V drop', () => {
  const sim = analyzeCircuit({ voltage: 5, resistance: 330, closed: true });
  assert.ok(Math.abs(sim.currentMa - (3000 / 330)) < 1e-10);
  assert.ok(Math.abs(sim.resistorPowerW - (3 / 330) ** 2 * 330) < 1e-10);
  assert.equal(sim.ledOn, true);
  assert.equal(sim.warning, '');
});
test('opening the switch or insufficient source voltage prevents current', () => {
  assert.equal(analyzeCircuit({ voltage: 5, resistance: 330, closed: false }).currentMa, 0);
  assert.equal(analyzeCircuit({ voltage: 1.5, resistance: 330, closed: true }).currentMa, 0);
});
test('the model warns about excessive current', () => {
  const sim = analyzeCircuit({ voltage: 9, resistance: 330, closed: true });
  assert.ok(sim.currentMa > 20);
  assert.match(sim.warning, /Above 20 mA/);
});
test('invalid resistor and voltage inputs are rejected', () => {
  assert.throws(() => analyzeCircuit({ voltage: 5, resistance: 0 }), RangeError);
  assert.throws(() => analyzeCircuit({ voltage: 25, resistance: 330 }), RangeError);
  assert.throws(() => analyzeCircuit({ voltage: NaN, resistance: 330 }), RangeError);
});
test('same netlist connectivity on every plan: geometry is not electrical proof', () => {
  const sets = ['solomon','ezekiel','teotihuacan'].map(id => netlistFor(id, { voltage: 5, resistance: 470, closed: true }));
  for (const set of sets) {
    assert.deepEqual(set.parts.map(x => x.ref), ['V1','SW1','R1','D1']);
    assert.equal(set.parts[0].positive, set.parts[1].from);
    assert.equal(set.parts[1].to, set.parts[2].from);
    assert.equal(set.parts[2].to, set.parts[3].anode);
    assert.equal(set.parts[3].cathode, set.parts[0].negative);
    assert.match(set.disclaimer, /not evidence of ancient electrical technology/);
  }
  assert.equal(sets[0].calculated.currentMa, sets[1].calculated.currentMa);
  assert.equal(sets[1].calculated.currentMa, sets[2].calculated.currentMa);
});
