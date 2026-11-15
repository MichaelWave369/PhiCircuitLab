import test from 'node:test';
import assert from 'node:assert/strict';
import {presetCircuit} from '../wiring-solver.mjs';
import {DEFAULT_SCOPE_CONFIG} from '../scope-engine.mjs';
import {
  WORKSTATION_STORAGE_KEY,MAX_WORKSTATION_PROJECTS,MAX_WORKSTATION_NOTES,
  MAX_WORKSTATION_IMPORT_BYTES,newWorkstationLibrary,validateWorkstationLibrary,
  activeProject,createWorkstationProject,duplicateWorkstationProject,
  renameWorkstationProject,selectWorkstationProject,deleteWorkstationProject,
  updateWorkstationCircuit,updateWorkstationScope,
  addWorkstationNote,deleteWorkstationNote,
  exportWorkstationBundle,importWorkstationBundle,projectName
} from '../workstation-engine.mjs';

const fresh=()=>newWorkstationLibrary();
const clone=x=>JSON.parse(JSON.stringify(x));
test('v1.0 Workstation starts with a validated local project',()=>{
  const state=fresh();
  assert.equal(WORKSTATION_STORAGE_KEY,'phi-circuit-lab-workstation-v1');
  assert.equal(state.version,1);
  assert.equal(state.activeId,'p1');
  assert.equal(state.projects.length,1);
  assert.equal(activeProject(state).circuit.parts.length,2);
  assert.equal(activeProject(state).scope.waveform,'step');
  assert.deepEqual(validateWorkstationLibrary(state),state);
});
test('projects create independent stable IDs and become active',()=>{
  let state=fresh();
  state=createWorkstationProject(state,'  LED bench ');
  assert.deepEqual(state.projects.map(p=>p.id),['p1','p2']);
  assert.equal(state.activeId,'p2');
  assert.equal(activeProject(state).name,'LED bench');
  state=createWorkstationProject(state,'Scope signals');
  assert.equal(state.activeId,'p3');
  state=selectWorkstationProject(state,'p1');
  assert.equal(activeProject(state).name,'My Electronics Bench');
});
test('renaming applies only to active project',()=>{
  let state=createWorkstationProject(fresh(),'Secondary');
  state=renameWorkstationProject(state,'   My RC \n Lab   ');
  assert.equal(activeProject(state).name,'My RC Lab');
  assert.equal(state.projects[0].name,'My Electronics Bench');
});
test('project names reject empty, nontext, controls and too-long strings',()=>{
  for(const bad of ['', '  ','a'.repeat(61),null,42,undefined,'\x00']) {
    assert.throws(()=>projectName(bad));
  }
  assert.equal(projectName('  testing   circuits '),'testing circuits');
});
test('projects enforce capacity with no accidental corruption',()=>{
  let state=fresh();
  for(let i=1;i<MAX_WORKSTATION_PROJECTS;i++)
    state=createWorkstationProject(state,'Circuit '+i);
  assert.equal(state.projects.length,12);
  assert.throws(()=>createWorkstationProject(state,'One too many'),RangeError);
  assert.throws(()=>duplicateWorkstationProject(state),RangeError);
  assert.equal(state.projects.length,12);
});
test('duplicating copies circuit, scope and notebook but not object references',()=>{
  let state=fresh();
  state=addWorkstationNote(state,'manual','Observation about 5 V');
  state=duplicateWorkstationProject(state);
  assert.deepEqual(state.projects.map(p=>p.id),['p1','p2']);
  assert.match(activeProject(state).name,/copy$/);
  assert.deepEqual(state.projects[0].circuit,state.projects[1].circuit);
  assert.deepEqual(state.projects[0].scope,state.projects[1].scope);
  assert.deepEqual(state.projects[0].notes,state.projects[1].notes);
  state=addWorkstationNote(state,'scope','Another observation');
  assert.equal(state.projects[0].notes.length,1);
  assert.equal(state.projects[1].notes.length,2);
});
test('cannot delete last project; deleting selected chooses surviving project',()=>{
  assert.throws(()=>deleteWorkstationProject(fresh()),RangeError);
  let state=createWorkstationProject(fresh(),'Temporary');
  state=deleteWorkstationProject(state);
  assert.equal(state.activeId,'p1');
  assert.equal(state.projects.length,1);
  assert.equal(state.nextProjectId,3);
  state=createWorkstationProject(state,'Another');
  assert.equal(state.activeId,'p3');
});
test('unknown project cannot be selected',()=>{
  assert.throws(()=>selectWorkstationProject(fresh(),'p9999'),RangeError);
});
test('circuit edits are per-project and do not mutate provided input',()=>{
  let state=fresh();
  const circuit=presetCircuit('led');
  const original=clone(circuit);
  state=updateWorkstationCircuit(state,circuit);
  assert.deepEqual(circuit,original);
  assert.equal(activeProject(state).circuit.leds.length,1);
  state=createWorkstationProject(state,'Parallel');
  state=updateWorkstationCircuit(state,presetCircuit('parallel'));
  assert.equal(activeProject(state).circuit.parts.length,2);
  state=selectWorkstationProject(state,'p1');
  assert.equal(activeProject(state).circuit.leds.length,1);
});
test('scope updates are isolated from other projects and external config',()=>{
  let state=fresh();
  const config={...DEFAULT_SCOPE_CONFIG,waveform:'square',dutyPercent:25,resistanceOhms:2200};
  state=updateWorkstationScope(state,config);
  assert.equal(activeProject(state).scope.dutyPercent,25);
  state=createWorkstationProject(state,'Another');
  assert.equal(activeProject(state).scope.dutyPercent,50);
  state=selectWorkstationProject(state,'p1');
  assert.equal(activeProject(state).scope.resistanceOhms,2200);
  assert.equal(DEFAULT_SCOPE_CONFIG.dutyPercent,50);
});
test('invalid circuit and scope updates are rejected',()=>{
  assert.throws(()=>updateWorkstationCircuit(fresh(),{version:1,parts:[]}));
  assert.throws(()=>updateWorkstationScope(fresh(),{waveform:'sine'}));
  assert.deepEqual(activeProject(fresh()).scope,DEFAULT_SCOPE_CONFIG);
});
test('manual meter and scope observations are typed and preserved',()=>{
  let state=fresh();
  state=addWorkstationNote(state,'manual','Kirchhoff current law');
  state=addWorkstationNote(state,'meter','Red V+ / black GND = 9.000 V');
  state=addWorkstationNote(state,'scope','At tau capacitor is 3.161 V');
  assert.deepEqual(activeProject(state).notes.map(n=>n.source),['manual','meter','scope']);
  assert.deepEqual(activeProject(state).notes.map(n=>n.id),['n1','n2','n3']);
  assert.equal(activeProject(state).nextNoteId,4);
});
test('notes are deleted by their stable ID without reusing IDs',()=>{
  let state=fresh();
  state=addWorkstationNote(state,'manual','First');
  state=addWorkstationNote(state,'scope','Second');
  state=deleteWorkstationNote(state,'n1');
  assert.deepEqual(activeProject(state).notes.map(n=>n.id),['n2']);
  state=addWorkstationNote(state,'meter','Third');
  assert.deepEqual(activeProject(state).notes.map(n=>n.id),['n2','n3']);
  assert.throws(()=>deleteWorkstationNote(state,'n99'),RangeError);
});
test('notes enforce 500-character limit and reject invalid source',()=>{
  for(const value of ['', '   ','x'.repeat(501),23,'\u0000']) {
    assert.throws(()=>addWorkstationNote(fresh(),'manual',value));
  }
  assert.throws(()=>addWorkstationNote(fresh(),'user-script','Hello'),RangeError);
  const max=addWorkstationNote(fresh(),'manual','x'.repeat(500));
  assert.equal(activeProject(max).notes[0].text.length,500);
});
test('notes cannot exceed 60 entries per project',()=>{
  let state=fresh();
  for(let i=0;i<MAX_WORKSTATION_NOTES;i++)
    state=addWorkstationNote(state,'manual','Reading '+i);
  assert.equal(activeProject(state).notes.length,60);
  assert.throws(()=>addWorkstationNote(state,'manual','Overflow'),RangeError);
});
test('versioned JSON roundtrip preserves multiple full projects',()=>{
  let state=fresh();
  state=updateWorkstationCircuit(state,presetCircuit('led'));
  state=addWorkstationNote(state,'meter','D1 8.571 mA');
  state=createWorkstationProject(state,'Periodic square experiment');
  state=updateWorkstationScope(state,{...DEFAULT_SCOPE_CONFIG,waveform:'square',dutyPercent:40});
  state=addWorkstationNote(state,'scope','Changed duty cycle');
  const exportText=exportWorkstationBundle(state);
  assert.ok(exportText.endsWith('\n'));
  assert.deepEqual(importWorkstationBundle(exportText),state);
});
test('versioned import strips untrusted extra keys but keeps user text as data',()=>{
  const data=fresh();
  data.extra='could be a payload';
  data.projects[0].evil='<img src=x onerror=alert(1)>';
  data.projects[0].notes=[{id:'n1',source:'manual',text:'<script>alert(1)</script>',extra:99}];
  data.projects[0].nextNoteId=2;
  const validated=importWorkstationBundle(JSON.stringify(data));
  assert.equal(Object.hasOwn(validated,'extra'),false);
  assert.equal(Object.hasOwn(validated.projects[0],'evil'),false);
  assert.equal(Object.hasOwn(validated.projects[0].notes[0],'extra'),false);
  assert.equal(validated.projects[0].notes[0].text,'<script>alert(1)</script>');
});
test('malformed and oversized import payloads are rejected',()=>{
  assert.throws(()=>importWorkstationBundle('{malformed'),SyntaxError);
  assert.throws(()=>importWorkstationBundle('x'.repeat(MAX_WORKSTATION_IMPORT_BYTES+1)),RangeError);
  assert.throws(()=>importWorkstationBundle(42),RangeError);
  assert.throws(()=>importWorkstationBundle(JSON.stringify({...fresh(),version:2})),RangeError);
});
test('import rejects missing active project, duplicates and invalid IDs',()=>{
  const data=fresh();
  const badActive=clone(data);badActive.activeId='p12345';
  assert.throws(()=>validateWorkstationLibrary(badActive),RangeError);
  const dupe=clone(data);dupe.projects.push(clone(dupe.projects[0]));
  assert.throws(()=>validateWorkstationLibrary(dupe),RangeError);
  const badId=clone(data);badId.projects[0].id='__proto__';
  assert.throws(()=>validateWorkstationLibrary(badId),RangeError);
});
test('import rejects fraudulent notebook ordering and duplicate IDs',()=>{
  const base=fresh();
  const bad=clone(base);
  bad.projects[0].notes=[{id:'n1',source:'manual',text:'hello'}];
  assert.throws(()=>validateWorkstationLibrary(bad),RangeError);
  bad.projects[0].nextNoteId=2;
  bad.projects[0].notes.push(clone(bad.projects[0].notes[0]));
  assert.throws(()=>validateWorkstationLibrary(bad),RangeError);
  bad.projects[0].notes[1].id='n2';
  assert.throws(()=>validateWorkstationLibrary(bad),RangeError);
});
test('schema remains independent of Challenge Academy and Mystery storage keys',()=>{
  const state=fresh();
  assert.ok(!JSON.stringify(state).includes('phi-circuit-lab-wiring-v1'));
  assert.ok(!JSON.stringify(state).includes('phi-circuit-lab-academy-v1'));
  assert.ok(!JSON.stringify(state).includes('phi-circuit-lab-mystery-v1'));
  assert.ok(!JSON.stringify(state).includes('phi-circuit-lab-scope-v1'));
});
test('exported portfolio has only validated project data and zero runtime callbacks',()=>{
  const state=fresh();
  const data=JSON.parse(exportWorkstationBundle(state));
  assert.deepEqual(Object.keys(data),['version','activeId','nextProjectId','projects']);
  assert.deepEqual(Object.keys(data.projects[0]),
    ['id','name','circuit','scope','notes','nextNoteId']);
});
