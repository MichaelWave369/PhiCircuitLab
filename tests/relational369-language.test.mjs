import test from "node:test";
import assert from "node:assert/strict";
import {
  parseREL369, jointOperator, createRELRuntime,
  stepRELRuntime, runREL369, REL_EXAMPLES
} from "../relational369-language.mjs";
import { synthesizeRelations, candidatePrograms } from "../relational369-discovery.mjs";

const close = (a,b,tol=1e-10) => assert.ok(Math.abs(a-b)<tol, "Expected " + a + " ≈ " + b);

test("complete relational parser builds three states and relation AST", () => {
  const ast = parseREL369(REL_EXAMPLES.xor);
  assert.deepEqual(ast.initial, [0.8,0.2,0.5]);
  assert.deepEqual(ast.rules.map(r=>r.kind), ["XOR","REMEMBER"]);
  assert.equal(ast.rules[0].type,"triad");
  assert.equal(ast.rules[0].to,2);
});

test("parser refuses malformed, unsafe and unbounded programs", () => {
  const start = "STATE A 0\nSTATE B 0\nSTATE C 0\n";
  for (const extra of [
    "RELATE A -> C CUSTOM 0.9",
    "RELATE A <-> B EXCITE 0.4",
    "RELATE A -> A EXCITE 0.5",
    "RELATE A -> B SYNC 0.5",
    "RELATE A -> B REMEMBER 0.6",
    "TRIAD A A -> C XOR 0.7",
    "TRIAD A B -> C XOR 9",
    "RELATE C -> C REMEMBER 0.5\nRELATE C -> C REMEMBER 0.3",
    "STATE A 0.5",
    "eval(process.exit())"
  ]) assert.throws(()=>parseREL369(start + extra), /Line |duplicate/);
  assert.throws(()=>parseREL369("STATE A 0\nSTATE B 0\n"), /declare each/);
  assert.throws(()=>parseREL369("x".repeat(4097)), /4096/);
  assert.throws(()=>parseREL369(start + "RELATE A -> B EXCITE 0.5\n".repeat(25)), /maximum 24/);
  assert.throws(()=>parseREL369(start + "\n".repeat(50)), /exceeds 48/);
});

test("fuzzy XOR and other joint operators yield correct Boolean values", () => {
  for (const [a,b] of [[0,0],[0,1],[1,0],[1,1]]) {
    close(jointOperator("XOR",a,b),a^b);
    close(jointOperator("AND",a,b),a&b);
    close(jointOperator("OR",a,b),a|b);
  }
  close(jointOperator("MEAN",0.2,0.6),0.4);
});

test("simultaneous SYNC conserves sum, stays bounded and is deterministic", () => {
  const ast = parseREL369(REL_EXAMPLES.synchronize);
  const initial = createRELRuntime(ast);
  const one = runREL369(initial,60);
  const two = runREL369(initial,60);
  close(one.states.reduce((a,b)=>a+b,0), 1.1);
  assert.deepEqual(one,two);
  assert.equal(initial.tick,0);
  one.states.forEach(x=>assert.ok(x>=0 && x<=1));
});

test("a higher-order relation changes C but does not rewrite A or B", () => {
  const ast=parseREL369("STATE A 1\nSTATE B 0\nSTATE C 0.5\nTRIAD A B -> C XOR 1");
  const next=stepRELRuntime(createRELRuntime(ast));
  assert.deepEqual(next.states.slice(0,2),[1,0]);
  close(next.states[2],0.625);
  assert.equal(next.lastReceipt.events.length,1);
});

test("memory stores history and recall acts after an external perturbation", () => {
  const ast = parseREL369("STATE A 0\nSTATE B 0\nSTATE C 1\nRELATE C -> C REMEMBER 0.1\nRELATE C -> C RECALL 1");
  const base = createRELRuntime(ast);
  const perturbed = { ...base, states:[0,0,0] };
  const next=stepRELRuntime(perturbed);
  close(next.states[2],0.25);
  close(next.memory[2],0.9);
  close(base.states[2],1);
});

test("different source order yields same simultaneous semantics", () => {
  const preface="STATE A 1\nSTATE B 0.5\nSTATE C 0\n";
  const rules=[
    "RELATE A -> B EXCITE 0.8",
    "RELATE C -> B INHIBIT 0.9",
    "TRIAD A B -> C AND 0.7"
  ];
  const x=stepRELRuntime(createRELRuntime(parseREL369(preface+rules.join("\n"))));
  const y=stepRELRuntime(createRELRuntime(parseREL369(preface+rules.reverse().join("\n"))));
  assert.deepEqual(x.states,y.states);
});

test("constrained synthesis evaluates finite candidates with held-out scores", () => {
  assert.equal(candidatePrograms().length,80);
  const found=synthesizeRelations("XOR");
  assert.equal(found.totalCandidates,80);
  assert.equal(found.trainingCases,4);
  assert.equal(found.holdoutCases,16);
  assert.equal(found.groups["higher-order"].candidates,16);
  assert.equal(found.groups.pairwise.candidates,64);
  assert.match(found.groups["higher-order"].code,/TRIAD A B -> C XOR/);
  assert.ok(found.groups["higher-order"].trainingMSE < found.groups.pairwise.trainingMSE);
  assert.ok(Number.isFinite(found.groups["higher-order"].holdoutMSE));
  assert.deepEqual(found,synthesizeRelations("XOR"));
});

test("synthesis search across targets, invalid targets and step caps", () => {
  for (const target of ["AND","OR","MEAN"]) {
    const found=synthesizeRelations(target,12);
    assert.ok(found.groups["higher-order"].holdoutMSE >= 0);
    assert.ok(found.groups.pairwise.trainingMSE >= 0);
  }
  assert.throws(()=>synthesizeRelations("SUPER"),RangeError);
  assert.throws(()=>synthesizeRelations("XOR",100),RangeError);
  assert.throws(()=>runREL369(createRELRuntime(parseREL369(REL_EXAMPLES.xor)),1001),RangeError);
});

test("all language presets remain executable", () => {
  for (const code of Object.values(REL_EXAMPLES)) {
    const ast=parseREL369(code);
    const rt=runREL369(createRELRuntime(ast),50);
    assert.equal(rt.tick,50);
    rt.states.forEach(x=>assert.ok(Number.isFinite(x) && x>=0 && x<=1));
  }
});
